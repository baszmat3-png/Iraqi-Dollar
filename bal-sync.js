/* bal-sync.js — الرصيد المرجعي على السيرفر (نقاط · جواهر · دولار) مع مزامنة لحظية بين كل الأجهزة
 *
 *  GET  /api/bal/get                 → {ok,pts,gems,usd}   الرصيد الحقيقي الآن (هوية: x-e + x-h)
 *  POST /api/bal/push {op,dp,dg,du}  → {ok,pts,gems,usd,dup}
 *        يضيف «فرقاً» (+/−) أحدثه الجهاز محلياً (استلام عائد، شراء، تحويل...) على رصيد السيرفر ذرّياً.
 *        كل عملية لها معرّف op فريد: إعادة الإرسال بعد انقطاع الشبكة لا تُحسب مرتين.
 *
 *  لا يوجد أي كتابة لرصيد «مطلق» من الأجهزة: الجهاز يرسل فروقاً فقط، فلا يستطيع جهاز قديم أو متأخر
 *  أن يمسح شحن الإدارة أو يضاعفه. وكل تغيير على الرصيد (من أي مصدر) يُبثّ فوراً لكل أجهزة الحساب
 *  عبر live-bal.js (حدث bal) فيسحب كل جهاز الرصيد الجديد بالحال.
 */
module.exports = (app, express, { pool, wrap, fail }) => {
  const parse = express.json({ limit: '4kb' });
  const ready = pool.query(
    `CREATE TABLE IF NOT EXISTS bal_ops(email TEXT NOT NULL, op TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(email, op))`
  ).catch((e) => console.error('bal_ops:', e.message));
  setInterval(() => { pool.query(`DELETE FROM bal_ops WHERE at < NOW() - INTERVAL '3 days'`).catch(() => {}); }, 6 * 3600 * 1000).unref();

  // حدّ معدّل بسيط لكل حساب (لا يعتمد على IP لأن شبكات الجوال تشترك بنفس العنوان)
  const hits = new Map();
  const limited = (k, max) => {
    const t = Date.now(), a = (hits.get(k) || []).filter((x) => t - x < 60000);
    a.push(t); hits.set(k, a);
    if (hits.size > 20000) hits.clear();
    return a.length > max;
  };

  const dec = (s) => { try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); } };
  async function who(req) {
    const b = req.body || {};
    const e = dec(req.get('x-e') || b.e || req.query.e).trim().toLowerCase().slice(0, 120);
    const h = String(req.get('x-h') || b.h || '').slice(0, 200);
    const au = req.app.locals.authEmail;
    const ok = au && e && h ? await au(e, h) : '';
    if (!ok || ok !== e) fail(401, 'سجّل الدخول');
    return ok;
  }
  const out = (r) => ({ ok: true, pts: Number(r.pts) || 0, gems: Number(r.gems) || 0, usd: Number(r.usd) || 0 });

  app.get('/api/bal/get', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const em = await who(req);
    if (limited('g:' + em, 240)) fail(429, 'محاولات كثيرة');
    const r = (await pool.query(`SELECT pts, gems, usd FROM sync_accounts WHERE LOWER(email)=$1`, [em])).rows[0];
    if (!r) fail(404, 'الحساب غير موجود');
    res.json(out(r));
  }));

  app.post('/api/bal/push', parse, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const em = await who(req);
    if (limited('p:' + em, 240)) fail(429, 'محاولات كثيرة');
    const b = req.body || {};
    const op = String(b.op || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 60);
    if (op.length < 6) fail(400, 'معرّف العملية غير صحيح');
    const cap = (v, m) => { v = Number(v); return Number.isFinite(v) ? Math.max(-m, Math.min(m, v)) : 0; };
    let dp = Math.round(cap(b.dp, 1e12)), dg = Math.round(cap(b.dg, 1e12)), du = Math.round(cap(b.du, 1e9) * 100) / 100;
    await ready;
    const c = await pool.connect();
    let row, dup = false, clipped = false;
    try {
      await c.query('BEGIN');
      const ins = await c.query(`INSERT INTO bal_ops(email, op) VALUES($1, $2) ON CONFLICT DO NOTHING`, [em, op]);
      if (ins.rowCount && (dp || dg || du)) {
        // حارس حفظ القيمة: الفرق الموجب يُقبل فقط ضمن ما يعرفه الخادم (تعدين/إحالة/جوائز/استرداد مصروف فعلاً)
        const G = app.locals.balGuard;
        if (G) { const g = await G.apply(c, em, dp, dg, du, 'push'); dp = g.dp; dg = g.dg; du = g.du; clipped = !!g.clipped; }
        row = (await c.query(
          `UPDATE sync_accounts SET pts=GREATEST(0, COALESCE(pts,0)+$2), gems=GREATEST(0, COALESCE(gems,0)+$3), usd=GREATEST(0, COALESCE(usd,0)+$4)
           WHERE LOWER(email)=$1 RETURNING pts, gems, usd`, [em, dp, dg, du])).rows[0];
      } else {
        dup = !ins.rowCount;
        row = (await c.query(`SELECT pts, gems, usd FROM sync_accounts WHERE LOWER(email)=$1`, [em])).rows[0];
      }
      if (!row) { await c.query('ROLLBACK'); fail(404, 'الحساب غير موجود'); }
      await c.query('COMMIT');
    } catch (e) { try { await c.query('ROLLBACK'); } catch (x) { /* تم */ } throw e; } finally { c.release(); }
    if (!dup) { try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (e) { /* اختياري */ } }
    res.json({ ...out(row), dup, clipped });
  }));

  console.log('bal-sync: رصيد مرجعي + فروقات لحظية جاهز');
};

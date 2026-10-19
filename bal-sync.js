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
module.exports = (app, express, { pool, wrap, fail, ctl }) => {
  const parse = express.json({ limit: '4kb' });
  const ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS bal_ops(email TEXT NOT NULL, op TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(email, op))`);
    for (const c of ['dp', 'dg', 'du']) await pool.query(`ALTER TABLE bal_ops ADD COLUMN IF NOT EXISTS ${c} NUMERIC NOT NULL DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bal_ops_email_at ON bal_ops(email, at)`);
    // محاولات رفع رصيد فوق السقف (للمراجعة من لوحة الإدارة)
    await pool.query(`CREATE TABLE IF NOT EXISTS bal_flags(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, asked_p NUMERIC, asked_g NUMERIC, asked_u NUMERIC, given_p NUMERIC, given_g NUMERIC, given_u NUMERIC, at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  })().catch((e) => console.error('bal_ops:', e.message));
  setInterval(() => { pool.query(`DELETE FROM bal_ops WHERE at < NOW() - INTERVAL '3 days'`).catch(() => {}); }, 6 * 3600 * 1000).unref();

  // حدّ معدّل بسيط لكل حساب (لا يعتمد على IP لأن شبكات الجوال تشترك بنفس العنوان)
  const hits = new Map();
  const limited = (k, max) => {
    const t = Date.now(), a = (hits.get(k) || []).filter((x) => t - x < 60000);
    a.push(t); hits.set(k, a);
    if (hits.size > 20000) hits.clear();
    return a.length > max;
  };

  /* ===== سقف الزيادة (نقاط/جواهر/دولار) خلال 24 ساعة =====
   * الجهاز يرسل فروقاً فقط، والسيرفر لا يثق بها بلا حد: الزيادة الموجبة المتراكمة خلال 24 ساعة لا تتجاوز سقفاً يُشتق من
   * عدادات الحساب المسجّلة على السيرفر (العائد اليومي) + هامش للألعاب والجوائز. الفائض لا يُضاف ويُسجَّل في bal_flags للمراجعة.
   * الخصم (الشراء/التحويل) غير مقيَّد. */
  const CTD = [50, 100, 100, 500, 500, 1000, 5000, 10000, 100000];
  async function dailyYield(c, em) {
    let base = 100; const daily = CTD.slice();
    try {
      const r = (await c.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0], cf = r && r.val && r.val.cfg;
      if (cf) { if (Number(cf.base) > 0) base = Number(cf.base); CTD.forEach((_, i) => { const o = cf.ct && cf.ct[i]; if (o && Number(o[1]) > 0) daily[i] = Number(o[1]); }); }
    } catch (e) { /* افتراضي */ }
    let y = base;
    try {
      const a = (await c.query(`SELECT cl FROM sync_accounts WHERE LOWER(email)=$1`, [em])).rows[0], now = Date.now();
      (Array.isArray(a && a.cl) ? a.cl : []).forEach((x) => { if (x && Number(x.e) > now && daily[Number(x.i)]) y += daily[Number(x.i)]; });
    } catch (e) { /* بلا عدادات */ }
    return y;
  }
  const CAP_G = 50000, CAP_U = 500, CAP_OP_P = 5e7, CAP_OP_G = 5e5, CAP_OP_U = 5000;

  // يحدّد المسموح به من الزيادات الموجبة (خلال 24 ساعة) ويسجّل الفائض؛ يُستخدم من هذا المسار ومن دمج الإصدارات القديمة (l/k)
  async function budget(c, em, op, dp, dg, du) {
    const used = (await c.query(`SELECT COALESCE(SUM(GREATEST(dp,0)),0) p, COALESCE(SUM(GREATEST(dg,0)),0) g, COALESCE(SUM(GREATEST(du,0)),0) u FROM bal_ops WHERE email=$1 AND at > NOW() - INTERVAL '24 hours' AND op<>$2`, [em, op])).rows[0];
    const y = await dailyYield(pool, em), capP = Math.max(300000, 4 * y);
    const ask = [dp, dg, du];
    if (dp > 0) dp = Math.max(0, Math.min(dp, capP - Number(used.p)));
    if (dg > 0) dg = Math.max(0, Math.min(dg, CAP_G - Number(used.g)));
    if (du > 0) du = Math.max(0, Math.min(du, Math.round((CAP_U - Number(used.u)) * 100) / 100));
    if (dp !== ask[0] || dg !== ask[1] || du !== ask[2]) {
      await c.query(`INSERT INTO bal_flags(email,asked_p,asked_g,asked_u,given_p,given_g,given_u) VALUES($1,$2,$3,$4,$5,$6,$7)`, [em, ask[0], ask[1], ask[2], dp, dg, du]);
    }
    return [dp, dg, du];
  }
  app.locals.balBudget = async (c, em, dp, dg, du) => {
    const op = 'm:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await ready;
    const r = (dp > 0 || dg > 0 || du > 0) ? await budget(c, em, op, dp, dg, du) : [dp, dg, du];
    await c.query(`INSERT INTO bal_ops(email, op, dp, dg, du) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [em, op, r[0], r[1], r[2]]);
    return r;
  };

  const dec = (s) => { try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); } };
  async function who(req) {
    const b = req.body || {};
    const e = dec(req.get('x-e') || b.e || req.query.e).trim().toLowerCase().slice(0, 120);
    const h = String(req.get('x-h') || b.h || req.query.h || '').slice(0, 200);
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
    let dp = Math.round(cap(b.dp, CAP_OP_P)), dg = Math.round(cap(b.dg, CAP_OP_G)), du = Math.round(cap(b.du, CAP_OP_U) * 100) / 100;
    await ready;
    const c = await pool.connect();
    let row, dup = false;
    try {
      await c.query('BEGIN');
      const ins = await c.query(`INSERT INTO bal_ops(email, op) VALUES($1, $2) ON CONFLICT DO NOTHING`, [em, op]);
      if (ins.rowCount && (dp > 0 || dg > 0 || du > 0)) {
        await c.query(`SELECT 1 FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [em]);
        [dp, dg, du] = await budget(c, em, op, dp, dg, du);
      }
      if (ins.rowCount) await c.query(`UPDATE bal_ops SET dp=$3, dg=$4, du=$5 WHERE email=$1 AND op=$2`, [em, op, dp, dg, du]);
      if (ins.rowCount && (dp || dg || du)) {
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
    res.json({ ...out(row), dup });
  }));

  // للإدارة: محاولات رفع رصيد فوق السقف (آخر 7 أيام)
  if (ctl) app.get('/api/ctl/bal-flags', ...ctl, wrap(async (_req, res) => {
    await ready;
    const r = await pool.query(`SELECT id, email, asked_p, asked_g, asked_u, given_p, given_g, given_u, at FROM bal_flags WHERE at > NOW() - INTERVAL '7 days' ORDER BY id DESC LIMIT 200`);
    res.json({ flags: r.rows.map((x) => ({ ...x, asked_p: Number(x.asked_p), asked_g: Number(x.asked_g), asked_u: Number(x.asked_u), given_p: Number(x.given_p), given_g: Number(x.given_g), given_u: Number(x.given_u) })) });
  }));

  console.log('bal-sync: رصيد مرجعي + فروقات لحظية جاهز');
};

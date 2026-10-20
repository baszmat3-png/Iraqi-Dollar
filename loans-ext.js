/**
 * loans-ext.js — الاستدانة (الأقساط) على السيرفر بالكامل
 *  POST /api/loans/state   {e,h}            : حدّ الاستدانة والمتاح + قروضي + طلباتي
 *  POST /api/loans/request {e,h,amt,months} : طلب استدانة (يُراجَع من الإدارة)
 *  POST /api/loans/pay     {e,h,id,n}       : سداد n أقساط (خصم من السيرفر)
 *  GET  /api/ctl/loans                      : لوحة الإدارة: الطلبات/النشطة/المسددة
 *  POST /api/ctl/loans/decide {id,ok}       : موافقة (تُضاف النقاط الصافية) أو رفض
 *  POST /api/ctl/loans/notify {id|late:1}   : تنبيه المتأخرين
 * القواعد: الحد = قيمة العدادات الفعّالة (بالنقاط) × dLim%؛ المتاح = الحد − المتبقي − الطلبات المعلّقة (≤ dmax)؛
 * القسط = ceil(المبلغ×(1+dRate%×أشهر)/أشهر)، الأول يُخصم مقدماً (الصافي = المبلغ − القسط)، موعد كل قسط بعد 30 يوماً.
 * التأخر عن الموعد + مهلة dGrace يوماً → حظر الحساب تلقائياً، ويُرفع الحظر تلقائياً عند سداد المتأخر.
 * العداد الذي على صاحبه قرض نشط لا يُعرض للبيع (app.locals.hasLoan).
 */
const YIELD0 = [50, 100, 100, 500, 500, 1000, 5000, 10000, 100000];
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const MONTH = 30 * 864e5;

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '8kb' });
  const ready = (async () => {
    await q(`CREATE TABLE IF NOT EXISTS loans(
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, name TEXT, amt BIGINT NOT NULL, months INT NOT NULL, inst BIGINT NOT NULL, total BIGINT NOT NULL, net BIGINT NOT NULL,
      lim BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', paid INT NOT NULL DEFAULT 0, t0 BIGINT, due BIGINT, decided_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ)`);
    await q(`CREATE INDEX IF NOT EXISTS loans_email_idx ON loans(email, status)`);
    await q(`CREATE TABLE IF NOT EXISTS loan_blocks(email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  })().catch((e) => console.error('loans schema:', e.message));
  app.use(['/api/loans', '/api/ctl/loans'], (_req, _res, next) => ready.then(() => next(), next));

  async function cfg(c) {
    let v = {};
    try { const r = (await (c || pool).query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0]; v = (r && r.val && r.val.cfg) || {}; } catch (_) { /* افتراضي */ }
    const n = (x, d, lo, hi) => { x = Number(x); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return { ct: v.ct || {}, dLim: n(v.dLim, 50, 0, 100), dRate: n(v.dRate, 5, 0, 100), dGrace: n(v.dGrace, 0, 0, 60), dmax: n(v.dmax, 1000000, 0, 1e12), hdebt: !!v.hdebt };
  }
  const yOf = (C, i) => { const o = C.ct[i]; return o && Number(o[1]) > 0 ? Number(o[1]) : (YIELD0[i] || 0); };
  const calc = (amt, m, C) => { const inst = Math.ceil(amt * (1 + C.dRate / 100 * m) / m); return { inst, total: inst * m, net: amt - inst }; };
  const limitPts = (C, cl, now) => Math.floor((Array.isArray(cl) ? cl : []).reduce((s, c) => s + (c && Number(c.e) > now ? yOf(C, Number(c.i)) * 300 : 0), 0) * C.dLim / 100);
  const shape = (L) => ({ id: Number(L.id), amt: Number(L.amt), months: L.months, inst: Number(L.inst), total: Number(L.total), net: Number(L.net), lim: Number(L.lim), st: L.status, paid: L.paid, t0: Number(L.t0) || 0, due: Number(L.due) || 0, t: new Date(L.created_at).getTime() });

  async function account(c, e, h, lock, allowBlockedDebt) {
    e = txt(e, 200).toLowerCase(); h = txt(h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const a = (await c.query(`SELECT email,name,pts,blk,demo,cl FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2${lock ? ' FOR UPDATE' : ''}`, [e, h])).rows[0];
    if (!a) fail(401, 'غير مسجّل الدخول');
    if (a.demo) fail(403, 'الحساب التجريبي لا يستخدم الاستدانة');
    if (a.blk) {
      const lb = allowBlockedDebt ? (await c.query(`SELECT 1 FROM loan_blocks WHERE email=$1`, [e])).rows[0] : null;
      if (!lb) fail(403, 'الحساب موقوف');
    }
    return a;
  }
  async function summary(c, email, a, C, now) {
    const rows = (await c.query(`SELECT * FROM loans WHERE email=$1 ORDER BY id DESC LIMIT 100`, [email])).rows.map(shape);
    const act = rows.filter((x) => x.st === 'active'), pend = rows.filter((x) => x.st === 'pending');
    const owed = act.reduce((t, x) => t + x.amt * (x.months - x.paid) / x.months, 0), pendAmt = pend.reduce((t, x) => t + x.amt, 0);
    const lim = limitPts(C, a.cl, now), av = Math.max(0, Math.min(C.dmax, Math.floor(lim - owed - pendAmt)));
    return { lim, owed: Math.round(owed), pend: pendAmt, av, act, reqs: rows.filter((x) => x.st !== 'active' || false), all: rows, blocked: false };
  }
  app.locals.hasLoan = async (email) => { try { return !!(await q(`SELECT 1 FROM loans WHERE email=$1 AND status='active' LIMIT 1`, [String(email).toLowerCase()])).rows[0]; } catch (_) { return false; } };

  app.post('/api/loans/state', jsonBody, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const b = req.body || {}, a = await account(pool, b.e, b.h, false, true), email = String(a.email).toLowerCase();
    const C = await cfg(), now = Date.now(), s = await summary(pool, email, a, C, now);
    const blocked = !!(await q(`SELECT 1 FROM loan_blocks WHERE email=$1`, [email])).rows[0];
    res.json({ ok: true, lim: s.lim, owed: s.owed, pend: s.pend, av: s.av, db: s.act, reqs: s.all.filter((x) => x.st === 'pending' || x.st === 'rejected' || x.st === 'closed').slice(0, 30), blocked,
      cfg: { dLim: C.dLim, dRate: C.dRate, dGrace: C.dGrace, dmax: C.dmax }, now });
  }));

  app.post('/api/loans/request', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, amt = Math.floor(Number(b.amt)), months = Math.floor(Number(b.months));
    if (!(amt >= 1) || !(months >= 2 && months <= 12)) fail(400, 'مبلغ أو مدة غير صالحة');
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const a = await account(cl, b.e, b.h, true, false), email = String(a.email).toLowerCase();
      const C = await cfg(cl); if (C.hdebt) fail(403, 'الاستدانة متوقفة مؤقتاً');
      const now = Date.now(), s = await summary(cl, email, a, C, now);
      if (!s.lim) fail(400, 'تحتاج عداداً فعّالاً للاستدانة');
      if (amt > s.av) fail(400, 'المبلغ أكبر من المتاح: ' + s.av.toLocaleString('en'));
      if (s.all.filter((x) => x.st === 'pending').length >= 3) fail(400, 'لديك طلبات معلّقة كثيرة، انتظر مراجعتها');
      const c2 = calc(amt, months, C); if (c2.net < 1) fail(400, 'المبلغ صغير جداً');
      const id = (await cl.query(`INSERT INTO loans(email,name,amt,months,inst,total,net,lim) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [email, a.name, amt, months, c2.inst, c2.total, c2.net, s.lim])).rows[0].id;
      await cl.query('COMMIT'); out = { ok: true, id: Number(id), inst: c2.inst, total: c2.total, net: c2.net };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    res.json(out);
  }));

  async function maybeUnblock(cl, email, now, C) {
    const late = (await cl.query(`SELECT 1 FROM loans WHERE email=$1 AND status='active' AND paid<months AND due+$2<$3 LIMIT 1`, [email, C.dGrace * 864e5, now])).rows[0];
    if (late) return false;
    const lb = await cl.query(`DELETE FROM loan_blocks WHERE email=$1 RETURNING email`, [email]);
    if (lb.rows.length) await cl.query(`UPDATE sync_accounts SET blk=FALSE WHERE LOWER(email)=$1`, [email]);
    return lb.rows.length > 0;
  }

  app.post('/api/loans/pay', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, id = parseInt(b.id, 10);
    if (!id) fail(400, 'قرض غير صالح');
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const a = await account(cl, b.e, b.h, true, true), email = String(a.email).toLowerCase();
      const L = (await cl.query(`SELECT * FROM loans WHERE id=$1 AND email=$2 FOR UPDATE`, [id, email])).rows[0];
      if (!L || L.status !== 'active') fail(404, 'القرض غير موجود');
      const Lm = Number(L.months), Lp = Number(L.paid), n = Math.max(1, Math.min(Math.floor(Number(b.n)) || 1, Lm - Lp)), cost = n * Number(L.inst);
      const dec = await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1 AND COALESCE(pts,0)>=$2 RETURNING pts`, [email, cost]);
      if (!dec.rows.length) fail(402, 'رصيد النقاط غير كافٍ، المطلوب ' + cost.toLocaleString('en'));
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [email, cost]);
      const paid = Lp + n, closed = paid >= Lm, t0 = Number(L.t0);
      await cl.query(`UPDATE loans SET paid=$2, due=$3, status=$4, closed_at=CASE WHEN $4='closed' THEN NOW() ELSE NULL END WHERE id=$1`, [id, paid, t0 + paid * MONTH, closed ? 'closed' : 'active']);
      if (app.locals.revenue) await app.locals.revenue(cl, 'loan_in', cost, 'loan:' + id, 'سداد ' + n + ' قسط');
      const C = await cfg(cl), unb = await maybeUnblock(cl, email, Date.now(), C);
      await cl.query('COMMIT'); out = { ok: true, bal: Number(dec.rows[0].pts), paid, closed, unblocked: unb };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ }
    res.json(out);
  }));

  /* ---------- الإدارة ---------- */
  app.get('/api/ctl/loans', ...ctl, wrap(async (_req, res) => {
    const rows = (await q(`SELECT l.*, a.name AS aname FROM loans l LEFT JOIN sync_accounts a ON LOWER(a.email)=l.email ORDER BY l.id DESC LIMIT 500`)).rows;
    const cls = new Map((await q(`SELECT LOWER(email) e, cl FROM sync_accounts WHERE LOWER(email)=ANY($1)`, [[...new Set(rows.map((r) => r.email))]])).rows.map((r) => [r.e, r.cl]));
    const now = Date.now(), C = await cfg();
    const mk = (r) => Object.assign(shape(r), { u: r.email, n: r.aname || r.name || r.email, rec: Number(r.net), cn: (Array.isArray(cls.get(r.email)) ? cls.get(r.email) : []).filter((c) => c && Number(c.e) > now).map((c) => Number(c.i)), late: r.status === 'active' && r.paid < r.months && Number(r.due) + C.dGrace * 864e5 < now });
    const all = rows.map(mk);
    res.json({ ok: true, req: all.filter((x) => x.st === 'pending' || x.st === 'rejected').reverse(), act: all.filter((x) => x.st === 'active'), hist: all.filter((x) => x.st === 'closed').map((x) => ({ u: x.u, n: x.n, amt: x.amt, total: x.total, months: x.months, at: x.t })) });
  }));
  app.post('/api/ctl/loans/decide', ...ctl, jsonBody, wrap(async (req, res) => {
    const id = parseInt((req.body || {}).id, 10), ok = !!(req.body || {}).ok;
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const L = (await cl.query(`SELECT * FROM loans WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!L || L.status !== 'pending') fail(409, 'الطلب غير موجود أو تمت معالجته');
      if (ok) {
        const a = (await cl.query(`SELECT blk,demo,cl FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [L.email])).rows[0];
        if (!a || a.blk || a.demo) fail(409, 'الحساب غير صالح للاستدانة');
        const C = await cfg(cl), now = Date.now(), lim = limitPts(C, a.cl, now);
        const owed = Number((await cl.query(`SELECT COALESCE(SUM(amt*(months-paid)::float8/months),0) o FROM loans WHERE email=$1 AND status='active'`, [L.email])).rows[0].o);
        if (Number(L.amt) > lim - owed + 1) fail(409, 'حد الاستدانة الحالي للحساب لا يغطي المبلغ (تغيّرت عداداته)');
        await cl.query(`UPDATE loans SET status='active', paid=1, t0=$2, due=$3, decided_by='admin' WHERE id=$1`, [id, now, now + MONTH]);
        const net = Number(L.net);
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [L.email, net]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [L.email, net]);
        await cl.query(`INSERT INTO app_revenue(kind,pts,ref,note) VALUES('loan_out',$1,$2,$3)`, [-Number(L.amt), 'loan:' + id, 'صرف استدانة ' + L.email.slice(0, 60)]).catch(() => {});
        if (app.locals.revenue) await app.locals.revenue(cl, 'loan_in', Number(L.inst), 'loan:' + id, 'القسط الأول');
      } else await cl.query(`UPDATE loans SET status='rejected', decided_by='admin' WHERE id=$1`, [id]);
      await cl.query('COMMIT'); out = { ok: true, st: ok ? 'active' : 'rejected', email: L.email, amt: Number(L.amt), net: Number(L.net) };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ }
    try { if (app.locals.notify) app.locals.notify(out.email, out.st === 'active' ? 'تمت الموافقة على الاستدانة' : 'تم رفض طلب الاستدانة', out.st === 'active' ? 'أُضيف ' + out.net.toLocaleString('en') + ' نقطة إلى رصيدك بعد خصم القسط الأول. موعد القسط القادم بعد 30 يوماً.' : 'نأسف، لم تتم الموافقة على طلب استدانة ' + out.amt.toLocaleString('en') + ' نقطة.', 'loan'); } catch (_) { /* اختياري */ }
    res.json(out);
  }));
  app.post('/api/ctl/loans/notify', ...ctl, jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, now = Date.now(), C = await cfg();
    const rows = b.late ? (await q(`SELECT * FROM loans WHERE status='active' AND paid<months AND due+$1<$2`, [C.dGrace * 864e5, now])).rows : (await q(`SELECT * FROM loans WHERE id=$1 AND status='active'`, [parseInt(b.id, 10) || 0])).rows;
    rows.forEach((L) => { try { if (app.locals.notify) app.locals.notify(L.email, 'تنبيه: قسط الاستدانة', (Number(L.due) < now ? 'قسطك متأخر. ' : '') + 'يرجى تسديد قسط ' + Number(L.inst).toLocaleString('en') + ' نقطة لتجنب حظر الحساب.', 'loan'); } catch (_) { /* اختياري */ } });
    res.json({ ok: true, n: rows.length });
  }));

  // حظر المتأخرين تلقائياً (كل 5 دقائق)
  async function enforce() {
    try {
      await ready; const C = await cfg(), now = Date.now();
      const late = (await q(`SELECT DISTINCT email FROM loans WHERE status='active' AND paid<months AND due+$1<$2`, [C.dGrace * 864e5, now])).rows;
      for (const r of late) {
        const a = (await q(`SELECT blk FROM sync_accounts WHERE LOWER(email)=$1`, [r.email])).rows[0];
        if (a && !a.blk) { await q(`UPDATE sync_accounts SET blk=TRUE WHERE LOWER(email)=$1`, [r.email]); await q(`INSERT INTO loan_blocks(email) VALUES($1) ON CONFLICT DO NOTHING`, [r.email]); }
      }
    } catch (e) { console.error('loans enforce:', e.message); }
  }
  setTimeout(enforce, 20000); const iv = setInterval(enforce, 5 * 60 * 1000); if (iv.unref) iv.unref();
};

/**
 * ctr-market-ext.js — متجر العدادات الحقيقي (السيرفر هو المرجع)
 *  GET  /api/ctr/market            : العروض المفتوحة (+ عروضي إن أُرسلت x-e/x-h)
 *  GET  /api/ctr/quote?ci=&exp=    : تقييم عداد حسب المدة المتبقية + الحد الأقصى + رسوم العرض
 *  POST /api/ctr/list   {e,h,ci,exp,price}  : عرض عداد للبيع (يُسحب من حسابه، وتُخصم رسوم العرض 8% نقاطاً وتذهب للتطبيق)
 *  POST /api/ctr/cancel {e,h,id}   : إلغاء عرض (يعود العداد بمدته؛ من رسوم العرض يُستبقى cxFee% من السعر (5% افتراضياً) ويُردّ الباقي)
 *  POST /api/ctr/buy    {e,h,id}   : شراء — يُخصم السعر من المشتري ويُضاف للبائع ويستلم المشتري العداد بمدته المتبقية فوراً
 * التقييم: سعر الكتالوج × (المتبقي ÷ 365 يوماً، يتحدّث يومياً)؛ الحد الأقصى للعرض = التقييم + cfg.mk% (افتراضي 20).
 */
const YIELD0 = [50, 100, 100, 500, 500, 1000, 5000, 10000, 100000];
const LIFE_DAYS = 365, DAY = 864e5, LIFE_MS = LIFE_DAYS * DAY;
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = (app, express, deps) => {
  const { pool, wrap, fail, ctl } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '10kb' });
  const ready = (async () => {
    for (let t = 0; t < 10; t++) {
      try {
        await q(`CREATE TABLE IF NOT EXISTS ctr_market(
          id BIGSERIAL PRIMARY KEY, seller_email TEXT NOT NULL, seller_name TEXT, ci INT NOT NULL, exp BIGINT NOT NULL,
          price BIGINT NOT NULL, fee BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open',
          buyer_email TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ)`);
        await q(`ALTER TABLE ctr_market ADD COLUMN IF NOT EXISTS ratio DOUBLE PRECISION`);
        await q(`CREATE TABLE IF NOT EXISTS ctr_dc_use(code TEXT NOT NULL, email TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(code,email))`);
        await q(`CREATE INDEX IF NOT EXISTS ctr_market_open ON ctr_market(status, created_at DESC)`);
        return;
      } catch (e) { if (t === 9) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('ctr-market schema:', e.message));
  app.use('/api/ctr', (_req, _res, next) => ready.then(() => next(), next));

  async function cfg(c) {
    let v = {}, dcs = [];
    try { const r = (await (c || pool).query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0]; v = (r && r.val && r.val.cfg) || {}; dcs = (r && r.val && Array.isArray(r.val.dcs)) ? r.val.dcs : []; } catch (_) { /* افتراضي */ }
    const ct = v.ct || {};
    let o = {};
    try { const r2 = (await (c || pool).query(`SELECT val FROM sync_kv WHERE key='ctr_market_cfg'`)).rows[0]; o = (r2 && r2.val) || {}; } catch (_) { /* افتراضي */ }
    const mk = Number(o.mk != null ? o.mk : v.mk); const fee = Number(o.fee != null ? o.fee : v.cmFee); const cx = Number(o.cx != null ? o.cx : v.cxFee);
    return { cx: Number.isFinite(cx) && cx >= 0 ? Math.min(cx, 50) : 5, ct, dcs, hcl: !!v.hcl, coff: v.coff || {}, mk: Number.isFinite(mk) && mk >= 0 ? Math.min(mk, 100) : 20, fee: Number.isFinite(fee) && fee >= 0 ? Math.min(fee, 50) : 10 };
  }
  const yieldOf = (C, ci) => { const o = C.ct[ci]; return o && Number(o[1]) > 0 ? Number(o[1]) : YIELD0[ci]; };
  function value(C, ci, exp, now) {
    const base = yieldOf(C, ci) * 300;
    const rem = Math.max(0, Math.min(LIFE_MS, exp - now));
    const dleft = Math.ceil(rem / DAY); // السعر يتغير مرة كل يوم (بعدد الأيام الصحيحة المتبقية) لا كل دقيقة
    const valued = Math.max(1, Math.floor(base * dleft / LIFE_DAYS));
    return { base, valued, cap: Math.max(1, Math.floor(valued * (1 + C.mk / 100))), days: Math.ceil(rem / DAY), daily: yieldOf(C, ci) };
  }
  // السعر يتناقص يومياً مع تناقص المدة: السعر الحالي = قيمة العداد الآن × نسبة العرض (سعر العرض ÷ قيمته وقت العرض)
  const effPrice = (L, C, now) => { const r = Number(L.ratio) > 0 ? Number(L.ratio) : 1; return Math.max(1, Math.floor(value(C, Number(L.ci), Number(L.exp), now).valued * r)); };
  const cred = (req) => {
    const b = req.body || {};
    let e = b.e || req.get('x-e') || '';
    try { e = decodeURIComponent(String(e)); } catch (_) { /* كما هو */ } // الواجهة ترسل x-e مُرمَّزاً (%40)
    return { e: txt(e, 200).toLowerCase(), h: txt(b.h || req.get('x-h'), 200) };
  };
  const row = (L, C, now, me) => {
    const v = value(C, L.ci, Number(L.exp), now);
    const price = effPrice(L, C, now);
    return { id: Number(L.id), ci: Number(L.ci), exp: Number(L.exp), days: v.days, price, listed: Number(L.price), fee: Number(L.fee) || 0, valued: v.valued, base: v.base, daily: v.daily,
      pct: v.valued ? Math.round((price / v.valued - 1) * 100) : 0, seller: L.seller_name || String(L.seller_email).split('@')[0], mine: !!me && String(L.seller_email).toLowerCase() === me };
  };
  const kick = () => { try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ } };
  const sigOf = (l) => (Array.isArray(l) ? l : []);

  app.get('/api/ctr/quote', wrap(async (req, res) => {
    const ci = parseInt(req.query.ci, 10), exp = Math.round(Number(req.query.exp)), now = Date.now();
    if (!(ci >= 0 && ci < YIELD0.length) || !(exp > now)) fail(400, 'عداد غير صالح');
    const C = await cfg(), v = value(C, ci, exp, now);
    res.json({ ok: true, ...v, mkPct: C.mk, feePct: C.fee });
  }));

  app.get('/api/ctr/market', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now(), C = await cfg();
    const { e, h } = cred(req);
    let me = '';
    if (e && h) { const a = (await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h])).rows[0]; if (a) me = e; }
    const rs = (await q(`SELECT * FROM ctr_market WHERE status='open' AND exp>$1 ORDER BY id DESC LIMIT 200`, [now])).rows;
    const list = rs.map((L) => row(L, C, now, me));
    res.json({ ok: true, list: list.filter((x) => !x.mine), my: list.filter((x) => x.mine), mkPct: C.mk, feePct: C.fee, cxPct: C.cx });
  }));

  async function auth(cl, e, h) {
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const me = (await cl.query(`SELECT email,name,pts,blk,demo,cl FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2 FOR UPDATE`, [e, h])).rows[0];
    if (!me) fail(401, 'غير مسجّل الدخول');
    if (me.blk) fail(403, 'الحساب موقوف');
    if (me.demo) fail(403, 'الحساب التجريبي لا يمكنه استخدام السوق');
    return me;
  }
  const setCl = async (cl, email, list) => {
    const j = JSON.stringify(list);
    try { await cl.query(`UPDATE sync_accounts SET cl=$2::jsonb, ncl=$3, cl_at=NOW() WHERE LOWER(email)=$1`, [email, j, list.length]); }
    catch (_) { await cl.query(`UPDATE sync_accounts SET cl=$2::jsonb, cl_at=NOW() WHERE LOWER(email)=$1`, [email, j]); }
  };

  app.post('/api/ctr/list', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, { e, h } = cred(req);
    const ci = parseInt(b.ci, 10), exp = Math.round(Number(b.exp)), price = Math.round(Number(b.price)), now = Date.now();
    if (!(ci >= 0 && ci < YIELD0.length) || !(exp > now)) fail(400, 'عداد غير صالح');
    if (!(price >= 1)) fail(400, 'أدخل سعراً صحيحاً');
    if (app.locals.hasLoan && await app.locals.hasLoan(e)) fail(403, 'عدادك محجوز بسبب قرض غير مسدَّد — سدِّد الاستدانة أولاً ثم اعرضه للبيع');
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const me = await auth(cl, e, h);
      const C = await cfg(cl), v = value(C, ci, exp, now);
      if (v.days < 1) fail(400, 'انتهت مدة هذا العداد');
      if (price > v.cap) fail(400, 'لا يمكن العرض بأكثر من ' + v.cap.toLocaleString('en') + ' نقطة (قيمة العداد بحسب مدته + ' + C.mk + '%)');
      const own = sigOf(me.cl).slice(); const ix = own.findIndex((c) => c && Number(c.i) === ci && Math.round(Number(c.e)) === exp);
      if (ix < 0) fail(404, 'هذا العداد غير موجود في حسابك');
      const fee = Math.ceil(price * C.fee / 100);
      if (Number(me.pts) < fee) fail(402, 'رصيدك لا يكفي لرسوم العرض (' + fee.toLocaleString('en') + ' نقطة)');
      own.splice(ix, 1);
      await setCl(cl, e, own);
      if (fee > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1`, [e, fee]);
        await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [e, fee]);
        if (app.locals.revenue) await app.locals.revenue(cl, 'ctr_list_fee', fee, 'ctr', 'عداد ' + ci + ' بسعر ' + price);
      }
      const id = (await cl.query(`INSERT INTO ctr_market(seller_email,seller_name,ci,exp,price,fee,ratio) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [e, me.name || e.split('@')[0], ci, exp, price, fee, price / v.valued])).rows[0].id;
      await cl.query('COMMIT');
      out = { ok: true, id: Number(id), fee, days: v.days, bal: Number(me.pts) - fee, cl: own };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    kick(); res.json(out);
  }));

  app.post('/api/ctr/cancel', jsonBody, wrap(async (req, res) => {
    const id = parseInt((req.body || {}).id, 10), { e, h } = cred(req), now = Date.now();
    if (!id) fail(400, 'عرض غير صالح');
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const me = await auth(cl, e, h);
      const L = (await cl.query(`SELECT * FROM ctr_market WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!L || String(L.seller_email).toLowerCase() !== e) fail(404, 'العرض غير موجود');
      if (L.status !== 'open') fail(409, 'هذا العرض لم يعد متاحاً');
      const own = sigOf(me.cl).slice();
      if (Number(L.exp) > now) own.push({ i: Number(L.ci), e: Number(L.exp) });
      await setCl(cl, e, own);
      // رسوم الإلغاء: يُستبقى cx% من سعر العرض للتطبيق ويُردّ للبائع باقي رسوم العرض (مثلاً 10% رُسّمت: 5% تُخصم و5% تُستردّ)
      const C = await cfg(cl), kept = Math.min(Number(L.fee) || 0, Math.ceil(Number(L.price) * C.cx / 100)), refund = Math.max(0, (Number(L.fee) || 0) - kept);
      if (refund > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, refund]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, refund]);
        await cl.query(`INSERT INTO app_revenue(kind,pts,ref,note) VALUES('ctr_cancel_refund',$1,$2,$3)`, [-refund, 'ctr:' + id, 'استرداد جزء من رسوم عرض ملغى']).catch(() => {});
      }
      await cl.query(`UPDATE ctr_market SET status='cancelled', closed_at=NOW() WHERE id=$1`, [id]);
      await cl.query('COMMIT');
      out = { ok: true, cl: own, kept, refund };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    kick(); res.json(out);
  }));

  app.post('/api/ctr/buy', jsonBody, wrap(async (req, res) => {
    const id = parseInt((req.body || {}).id, 10), { e, h } = cred(req), now = Date.now();
    if (!id) fail(400, 'عرض غير صالح');
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const L0 = (await cl.query(`SELECT seller_email FROM ctr_market WHERE id=$1`, [id])).rows[0];
      if (!L0) fail(404, 'العرض غير موجود');
      const sE = String(L0.seller_email).toLowerCase();
      if (sE === e) fail(400, 'لا يمكنك شراء عدادك');
      // قفل الحسابين بترتيب ثابت لتجنّب التشابك
      const emails = [e, sE].sort();
      for (const m of emails) await cl.query(`SELECT 1 FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [m]);
      const me = await auth(cl, e, h);
      const L = (await cl.query(`SELECT * FROM ctr_market WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!L || L.status !== 'open') fail(409, 'تم بيع هذا العداد أو إلغاء عرضه');
      if (Number(L.exp) <= now) fail(409, 'انتهت مدة هذا العداد');
      const price = effPrice(L, await cfg(cl), now);
      if (Number(me.pts) < price) fail(402, 'رصيد النقاط غير كافٍ');
      const mine = sigOf(me.cl).filter((c) => c && Number(c.e) > now);
      if (mine.length >= 100) fail(400, 'وصلت للحد الأقصى من العدادات');
      mine.push({ i: Number(L.ci), e: Number(L.exp) });
      await setCl(cl, e, mine);
      const dec = await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1 AND COALESCE(pts,0)>=$2 RETURNING pts`, [e, price]);
      if (!dec.rows.length) fail(402, 'رصيد النقاط غير كافٍ');
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [e, price]);
      await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [sE, price]);
      await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [sE, price]);
      await cl.query(`UPDATE ctr_market SET status='sold', buyer_email=$2, closed_at=NOW() WHERE id=$1`, [id, e]);
      await cl.query('COMMIT');
      out = { ok: true, bal: Number(dec.rows[0].pts), cl: mine, ci: Number(L.ci), days: Math.ceil((Number(L.exp) - now) / DAY), price, sE, name: me.name || e.split('@')[0] };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    kick();
    try { if (app.locals.notify) app.locals.notify(out.sE, 'تم بيع عدادك', out.name + ' اشترى عدادك بسعر ' + out.price.toLocaleString('en') + ' نقطة — أُضيفت لرصيدك', 'ctr'); } catch (_) { /* اختياري */ }
    res.json({ ok: true, bal: out.bal, cl: out.cl, ci: out.ci, days: out.days, price: out.price });
  }));

  /* شراء عداد جديد من الكتالوج: السعر من السيرفر (إنتاجية العداد × 300 مع كود الخصم إن صحّ)، يُخصم ويُضاف العداد فوراً بمدة 360 يوماً */
  app.post('/api/ctr/buy-new', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, { e, h } = cred(req), ci = parseInt(b.ci, 10), now = Date.now();
    if (!(ci >= 0 && ci < YIELD0.length)) fail(400, 'عداد غير صالح');
    const code = txt(b.dc, 30).toUpperCase();
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const me = await auth(cl, e, h);
      const C = await cfg(cl);
      if (C.hcl) fail(403, 'شراء العدادات متوقف مؤقتاً');
      if (C.coff && C.coff[ci]) fail(403, 'هذا العداد غير متاح حالياً');
      let price = yieldOf(C, ci) * 300, used = '';
      if (code) {
        const d = C.dcs.find((x) => x && String(x.c).toUpperCase() === code);
        if (!d || d.on === 0 || d.sc !== 'c') fail(400, 'كود الخصم غير صحيح');
        if (Number(d.mx) > 0) { const n = Number((await cl.query(`SELECT COUNT(*)::int n FROM ctr_dc_use WHERE code=$1`, [code])).rows[0].n); if (n >= Number(d.mx)) fail(400, 'انتهى عدد استخدامات الكود'); }
        const ins = await cl.query(`INSERT INTO ctr_dc_use(code,email) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING code`, [code, e]);
        if (!ins.rows.length) fail(400, 'استخدمت هذا الكود من قبل');
        price = Math.max(1, Math.ceil(price * (1 - Math.max(0, Math.min(100, Number(d.p) || 0)) / 100))); used = code;
      }
      const mine = sigOf(me.cl).filter((c) => c && Number(c.e) > now);
      if (mine.length >= 100) fail(400, 'وصلت للحد الأقصى من العدادات');
      const dec = await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1 AND COALESCE(pts,0)>=$2 RETURNING pts`, [e, price]);
      if (!dec.rows.length) fail(402, 'رصيد النقاط غير كافٍ');
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [e, price]);
      mine.push({ i: ci, e: now + LIFE_MS });
      await setCl(cl, e, mine);
      await cl.query('COMMIT');
      out = { ok: true, bal: Number(dec.rows[0].pts), cl: mine, price, days: LIFE_DAYS };
      out.note = 'شراء بسعر ' + price + (used ? ' كود ' + used : '');
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    pool.query(`INSERT INTO ctr_log(email,op,idx,n,note) VALUES($1,'buy',$2,1,$3)`, [e, ci, out.note]).catch(() => {});
    delete out.note; kick(); res.json(out);
  }));

  /* ---------------- لوحة التحكم: «المتجر البيع» (مالك فقط) ---------------- */
  if (ctl) {
    app.get('/api/ctl/ctr-market', ...ctl, wrap(async (_req, res) => {
      const now = Date.now(), C = await cfg();
      const open = (await q(`SELECT m.*, (SELECT email FROM sync_accounts a WHERE LOWER(a.email)=LOWER(m.seller_email)) AS em FROM ctr_market m WHERE status='open' AND exp>$1 ORDER BY id DESC LIMIT 300`, [now])).rows.map((L) => {
        const v = value(C, Number(L.ci), Number(L.exp), now);
        return { id: Number(L.id), seller: L.seller_name || '', email: L.seller_email, ci: Number(L.ci), days: v.days, price: effPrice(L, C, now), listed: Number(L.price), valued: v.valued, fee: Number(L.fee), at: L.created_at };
      });
      const st = (await q(`SELECT status, COUNT(*)::int n, COALESCE(SUM(price),0)::bigint vol, COALESCE(SUM(fee),0)::bigint fee FROM ctr_market GROUP BY status`)).rows;
      const rv = (await q(`SELECT kind, COALESCE(SUM(pts),0)::bigint pts, COUNT(*)::int n FROM app_revenue WHERE kind IN ('ctr_list_fee','ctr_cancel_refund') GROUP BY kind`).catch(() => ({ rows: [] }))).rows;
      const recent = (await q(`SELECT id, seller_email, seller_name, buyer_email, ci, price, fee, status, created_at, closed_at FROM ctr_market WHERE status<>'open' ORDER BY id DESC LIMIT 60`)).rows;
      res.json({ ok: true, cfg: { fee: C.fee, cx: C.cx, mk: C.mk }, open, stats: st, revenue: rv, recent });
    }));
    app.post('/api/ctl/ctr-market/settings', ...ctl, jsonBody, wrap(async (req, res) => {
      const b = req.body || {}, n = (v, lo, hi) => { const x = Number(v); if (!Number.isFinite(x) || x < lo || x > hi) fail(400, 'قيمة غير صالحة'); return Math.round(x * 100) / 100; };
      const val = { fee: n(b.fee, 0, 50), cx: n(b.cx, 0, 50), mk: n(b.mk, 0, 100) };
      await q(`INSERT INTO sync_kv(key,val,updated_at) VALUES('ctr_market_cfg',$1,NOW()) ON CONFLICT (key) DO UPDATE SET val=EXCLUDED.val, updated_at=NOW()`, [JSON.stringify(val)]);
      res.json({ ok: true, cfg: val });
    }));
    app.post('/api/ctl/ctr-market/cancel', ...ctl, jsonBody, wrap(async (req, res) => {
      // إلغاء عرض من الإدارة: يعود العداد لصاحبه ويُردّ له كامل رسوم العرض (بلا استقطاع)
      const id = parseInt((req.body || {}).id, 10); if (!id) fail(400, 'عرض غير صالح');
      const cl = await pool.connect(); let out;
      try {
        await cl.query('BEGIN');
        const L = (await cl.query(`SELECT * FROM ctr_market WHERE id=$1 FOR UPDATE`, [id])).rows[0];
        if (!L || L.status !== 'open') fail(409, 'العرض غير متاح');
        const e = String(L.seller_email).toLowerCase();
        const me = (await cl.query(`SELECT cl FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [e])).rows[0];
        if (!me) fail(404, 'حساب البائع غير موجود');
        const own = sigOf(me.cl).slice(); if (Number(L.exp) > Date.now()) own.push({ i: Number(L.ci), e: Number(L.exp) });
        await setCl(cl, e, own);
        const refund = Number(L.fee) || 0;
        if (refund > 0) {
          await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, refund]);
          await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, refund]);
          await cl.query(`INSERT INTO app_revenue(kind,pts,ref,note) VALUES('ctr_cancel_refund',$1,$2,$3)`, [-refund, 'ctr:' + id, 'إلغاء إداري لعرض']).catch(() => {});
        }
        await cl.query(`UPDATE ctr_market SET status='cancelled', closed_at=NOW() WHERE id=$1`, [id]);
        await cl.query('COMMIT'); out = { ok: true, refund };
      } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
      kick(); res.json(out);
    }));
  }
};

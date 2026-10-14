/* المرحلة 2 — التجار + الصور الشخصية الدائمة (كلها على قاعدة البيانات) */
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const MAX_IMG = 600 * 1024;
const isImg = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_IMG;
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = (v, max = 1e12) => { v = Number(v); return Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0; };
const DAY_START = `date_trunc('day', NOW() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad'`;

exports.parsers = (app, express) => {
  app.use('/api/m', express.json({ limit: '1mb' })); // صور المتجر والصور الشخصية (بعد الضغط)
};

exports.routes = (app, { pool, wrap, ctl }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const uLim = rateLimit({ windowMs: 60 * 1000, limit: 1200, standardHeaders: true, legacyHeaders: false });
  const wLim = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false });

  const ready = (async () => {
    await q(`CREATE TABLE IF NOT EXISTS merchants(
      id SERIAL PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, province TEXT NOT NULL DEFAULT '',
      discount INT NOT NULL DEFAULT 10, daily_cap BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      image TEXT, details TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', landmark TEXT NOT NULL DEFAULT '',
      services TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', received BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS merchants_owner_idx ON merchants(LOWER(owner))`);
    await q(`CREATE TABLE IF NOT EXISTS merchant_tx(
      id BIGSERIAL PRIMARY KEY, merchant_id INT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      payer TEXT NOT NULL, payer_name TEXT, pts BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS merchant_tx_idx ON merchant_tx(merchant_id, id DESC)`);
    await q(`CREATE TABLE IF NOT EXISTS agent_profiles(email TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '', methods JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE TABLE IF NOT EXISTS avatars(email TEXT PRIMARY KEY, img TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  })().catch((e) => console.error('merchant-ext schema:', e.message));
  app.use('/api/m', (_req, _res, next) => ready.then(() => next(), next));

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email, name FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    return { email: String(r.rows[0].email).toLowerCase(), name: r.rows[0].name || e.split('@')[0] };
  }
  const cols = `id, owner, name, province, discount, daily_cap, status, details, address, landmark, services, phone, received, updated_at, created_at, (image IS NOT NULL AND image<>'') AS has_img`;
  const pub = (m) => ({
    id: m.id, name: m.name, province: m.province, discount: m.discount, details: m.details, address: m.address,
    landmark: m.landmark, services: m.services, phone: m.phone, cap: Number(m.daily_cap) || 0, owner: String(m.owner).toLowerCase(),
    img: m.has_img ? `/api/m/img/${m.id}?v=${new Date(m.updated_at).getTime()}` : '',
  });
  const today = async (id) => Number((await q(`SELECT COALESCE(SUM(pts),0) s FROM merchant_tx WHERE merchant_id=$1 AND created_at >= ${DAY_START}`, [id])).rows[0].s);
  const sendImg = (res, d, pubCache) => {
    const m = d && /^data:(image\/[a-z]+);base64,(.+)$/.exec(d);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]); res.set('Cache-Control', pubCache ? 'public, max-age=31536000, immutable' : 'no-store');
    res.end(Buffer.from(m[2], 'base64'));
  };

  // الوكيل: يحدد بنفسه طرق الدفع (علامة صح + الرقم) والوصف. التحقق من كونه وكيلاً من الإعدادات المنشورة
  app.post('/api/m/agent/save', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const cfg = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const ags = (cfg && cfg.val && Array.isArray(cfg.val.agents)) ? cfg.val.agents : [];
    if (!ags.some((o) => Array.isArray(o) && !o[6] && String(o[8] || '').toLowerCase() === u.email)) fail(403, 'حسابك غير مسجل كوكيل');
    const methods = (Array.isArray(req.body.methods) ? req.body.methods : []).slice(0, 12).map((x) => ({ n: txt(x && x.n, 40), on: x && x.on ? 1 : 0, v: txt(x && x.v, 60) })).filter((x) => x.n);
    await q(`INSERT INTO agent_profiles(email,description,methods,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT (email) DO UPDATE SET description=EXCLUDED.description, methods=EXCLUDED.methods, updated_at=NOW()`,
      [u.email, txt(req.body.description, 1500), JSON.stringify(methods)]);
    res.json({ ok: true });
  }));

  /* حالة المستخدم كل 5 ثوانٍ: قائمة التجار + متجري + إصدارات الصور الشخصية */
  app.post('/api/m/state', uLim, wrap(async (req, res) => {
    const u = await who(req.body);
    res.set('Cache-Control', 'no-store');
    const list = (await q(`SELECT ${cols} FROM merchants WHERE status='active' ORDER BY id`)).rows;
    const mine = (await q(`SELECT ${cols} FROM merchants WHERE LOWER(owner)=$1 ORDER BY id DESC LIMIT 1`, [u.email])).rows[0];
    let me = null;
    if (mine) {
      me = { ...pub(mine), status: mine.status, total: Number(mine.received) || 0, today: await today(mine.id), tx: [] };
      if (mine.status === 'active') me.tx = (await q(`SELECT payer_name n, pts, created_at t FROM merchant_tx WHERE merchant_id=$1 ORDER BY id DESC LIMIT 60`, [mine.id])).rows.map((r) => ({ n: r.n, pts: Number(r.pts), t: r.t }));
    }
    const av = {};
    (await q(`SELECT email, (EXTRACT(EPOCH FROM updated_at)*1000)::bigint v FROM avatars`)).rows.forEach((r) => { av[r.email] = Number(r.v); });
    const agents = {};
    (await q(`SELECT email, description d, methods m FROM agent_profiles`)).rows.forEach((r) => { agents[String(r.email).toLowerCase()] = { d: r.d, m: r.m }; });
    res.json({ ok: true, merchants: list.map(pub), me, av, agents });
  }));

  app.post('/api/m/apply', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const name = txt(req.body.name, 80);
    if (!name) fail(400, 'اسم المتجر مطلوب');
    const ex = (await q(`SELECT id FROM merchants WHERE LOWER(owner)=$1 AND status IN ('pending','active')`, [u.email])).rows[0];
    if (ex) return res.json({ ok: true, dup: true });
    const ins = await q(`INSERT INTO merchants(owner,name,province,discount) VALUES($1,$2,$3,$4) RETURNING id`, [u.email, name, txt(req.body.province, 40), Math.min(100, Math.round(num(req.body.discount, 100)) || 10)]);
    // رسوم الانضمام (200,000 دينار) تُحسب ربحاً في المالية ضمن «رسوم تجارة»
    await q(`INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,'in','trade',0,200000,$3,'auto') ON CONFLICT DO NOTHING`, ['trade:' + ins.rows[0].id, u.email, 'رسوم انضمام تاجر: ' + name]).catch(() => {});
    res.json({ ok: true });
  }));

  app.post('/api/m/profile', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const m = (await q(`SELECT id FROM merchants WHERE LOWER(owner)=$1 AND status='active'`, [u.email])).rows[0];
    if (!m) fail(403, 'لا تملك متجراً معتمداً');
    const b = req.body; let im = null;
    if (b.image) { if (!isImg(b.image)) fail(400, 'الصورة غير صالحة أو كبيرة'); im = b.image; }
    const nm = txt(b.name, 80), dc = Number(b.discount);
    if (!nm) fail(400, 'اسم المتجر مطلوب');
    if (!Number.isFinite(dc) || dc < 0 || dc > 100) fail(400, 'نسبة الخصم بين 0 و100');
    await q(`UPDATE merchants SET name=$8,discount=$9,details=$2,address=$3,landmark=$4,services=$5,phone=$6,image=COALESCE($7,image),updated_at=NOW() WHERE id=$1`,
      [m.id, txt(b.details, 600), txt(b.address, 200), txt(b.landmark, 200), txt(b.services, 400), txt(b.phone, 25), im, nm, Math.round(dc)]);
    res.json({ ok: true });
  }));

  app.get('/api/m/img/:id', wrap(async (req, res) => {
    const r = (await q(`SELECT image FROM merchants WHERE id=$1`, [parseInt(req.params.id, 10) || 0])).rows[0];
    sendImg(res, r && r.image, true);
  }));

  /* تحويل مستخدم → تاجر: السقف اليومي بالنقاط يُفرض هنا، والتاجر يستقبل فقط */
  app.post('/api/m/pay', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const id = parseInt(req.body.id, 10) || 0, pts = Math.floor(num(req.body.pts, 1e10));
    if (pts < 1) fail(400, 'أدخل عدد النقاط');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const m = (await c.query(`SELECT * FROM merchants WHERE id=$1 AND status='active' FOR UPDATE`, [id])).rows[0];
      if (!m) fail(404, 'المتجر غير متاح');
      const owner = String(m.owner).toLowerCase();
      if (owner === u.email) fail(400, 'لا يمكن لصاحب المتجر التحويل إلى متجره');
      const cap = Number(m.daily_cap) || 0;
      if (cap > 0) {
        const t = Number((await c.query(`SELECT COALESCE(SUM(pts),0) s FROM merchant_tx WHERE merchant_id=$1 AND created_at >= ${DAY_START}`, [id])).rows[0].s);
        if (t + pts > cap) fail(400, 'تجاوز السقف اليومي للمتجر. المتبقي اليوم: ' + Math.max(0, cap - t).toLocaleString('en-US') + ' نقطة');
      }
      await c.query(`INSERT INTO merchant_tx(merchant_id,payer,payer_name,pts) VALUES($1,$2,$3,$4)`, [id, u.email, u.name, pts]);
      await c.query(`UPDATE merchants SET received=received+$2 WHERE id=$1`, [id, pts]);
      await c.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [owner, pts]);
      await c.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [owner, pts]);
      await c.query(`INSERT INTO sync_cmds(body) VALUES($1)`, [JSON.stringify({ t: 'adj', sc: 'all', e: owner, d: { pts } })]);
      await c.query('COMMIT');
      res.json({ ok: true, name: m.name });
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }));

  /* الصور الشخصية: تُحفظ على السيرفر وتظهر للجميع */
  app.post('/api/m/avatar', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    if (!isImg(req.body.image)) fail(400, 'الصورة غير صالحة أو كبيرة');
    await q(`INSERT INTO avatars(email,img,updated_at) VALUES($1,$2,NOW()) ON CONFLICT (email) DO UPDATE SET img=EXCLUDED.img, updated_at=NOW()`, [u.email, req.body.image]);
    res.json({ ok: true, v: Date.now() });
  }));
  app.get('/api/m/avatar', wrap(async (req, res) => {
    const r = (await q(`SELECT img FROM avatars WHERE email=$1`, [txt(req.query.e, 200).toLowerCase()])).rows[0];
    sendImg(res, r && r.img, true);
  }));

  /* ---- لوحة التحكم (مفتاح الإدارة) ---- */
  app.get('/api/ctl/merchants', ...ctl, wrap(async (_req, res) => {
    const r = (await q(`SELECT ${cols} FROM merchants ORDER BY (status='pending') DESC, id DESC`)).rows;
    const out = [];
    for (const m of r) out.push({ ...pub(m), status: m.status, total: Number(m.received) || 0, today: await today(m.id) });
    res.json({ merchants: out });
  }));
  app.post('/api/ctl/merchants/save', ...ctl, wrap(async (req, res) => {
    const b = req.body, id = parseInt(b.id, 10) || 0;
    const st = ['pending', 'active', 'suspended'].includes(b.status) ? b.status : null;
    const r = await q(`UPDATE merchants SET status=COALESCE($2,status), daily_cap=COALESCE($3,daily_cap), discount=COALESCE($4,discount), name=COALESCE($5,name), province=COALESCE($6,province), updated_at=NOW() WHERE id=$1 RETURNING id`,
      [id, st, b.daily_cap == null || b.daily_cap === '' ? null : Math.floor(num(b.daily_cap)), b.discount == null || b.discount === '' ? null : Math.min(100, Math.floor(num(b.discount, 100))), b.name ? txt(b.name, 80) : null, b.province ? txt(b.province, 40) : null]);
    if (!r.rowCount) fail(404, 'غير موجود');
    res.json({ ok: true });
  }));
  app.post('/api/ctl/merchants/add', ...ctl, wrap(async (req, res) => {
    const b = req.body, owner = txt(b.owner, 200).toLowerCase(), name = txt(b.name, 80);
    if (!owner || !name) fail(400, 'أدخل بريد صاحب المتجر واسم المتجر');
    await q(`INSERT INTO merchants(owner,name,province,discount,daily_cap,status) VALUES($1,$2,$3,$4,$5,'active')`,
      [owner, name, txt(b.province, 40), Math.min(100, Math.floor(num(b.discount, 100))), Math.floor(num(b.daily_cap))]);
    res.json({ ok: true });
  }));
  app.post('/api/ctl/merchants/del', ...ctl, wrap(async (req, res) => {
    await q(`DELETE FROM merchants WHERE id=$1`, [parseInt(req.body.id, 10) || 0]);
    res.json({ ok: true });
  }));
};

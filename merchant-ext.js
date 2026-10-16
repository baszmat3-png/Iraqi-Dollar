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
    await q(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT ''`);
    await q(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS ref_code TEXT NOT NULL DEFAULT ''`);
    await q(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS fee BIGINT NOT NULL DEFAULT 0`);
    await q(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS reject_note TEXT NOT NULL DEFAULT ''`);
    await q(`CREATE TABLE IF NOT EXISTS merchant_tx(
      id BIGSERIAL PRIMARY KEY, merchant_id INT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      payer TEXT NOT NULL, payer_name TEXT, pts BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS merchant_tx_idx ON merchant_tx(merchant_id, id DESC)`);
    await q(`CREATE TABLE IF NOT EXISTS agent_profiles(email TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '', methods JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE TABLE IF NOT EXISTS avatars(email TEXT PRIMARY KEY, img TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS merchant_tx_payer_idx ON merchant_tx(LOWER(payer), created_at)`);
    // إعدادات الدفع للتاجر (الحد اليومي لكل مستخدم) تُعدَّل من لوحة التحكم
    await q(`CREATE TABLE IF NOT EXISTS mx_settings(k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    // طلبات شراء النقاط بالسعر الرسمي من الوكلاء (تصل للوحة التحكم وتُنفَّذ عند الموافقة)
    await q(`CREATE TABLE IF NOT EXISTS agent_buys(
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, agent_name TEXT NOT NULL DEFAULT '', pts BIGINT NOT NULL,
      rate NUMERIC(12,4) NOT NULL DEFAULT 120, iqd BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), decided_at TIMESTAMPTZ)`);
    await q(`CREATE INDEX IF NOT EXISTS agent_buys_email_idx ON agent_buys(email, id DESC)`);
    await q(`CREATE INDEX IF NOT EXISTS agent_buys_status_idx ON agent_buys(status)`);
  })().catch((e) => console.error('merchant-ext schema:', e.message));

  const DEFAULT_PAY_LIMIT = 1000000; // الحد اليومي الافتراضي لما يدفعه المستخدم الواحد للتجار (نقطة)
  const getPayLimit = async (c) => {
    const r = (await (c || pool).query(`SELECT v FROM mx_settings WHERE k='pay_limit'`)).rows[0];
    const n = r ? Number(r.v) : DEFAULT_PAY_LIMIT;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_PAY_LIMIT; // 0 = بلا حد
  };
  const paidToday = async (email, c) => Number((await (c || pool).query(`SELECT COALESCE(SUM(pts),0) s FROM merchant_tx WHERE LOWER(payer)=$1 AND created_at >= ${DAY_START}`, [email])).rows[0].s);
  const pubCfg = async () => { const r = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0]; return (r && r.val) || {}; };
  // الوكيل المعتمد من الإعدادات المنشورة (نفس مصدر التحقق في بقية المسارات)
  const agentRow = async (email) => {
    const v = await pubCfg(), ags = Array.isArray(v.agents) ? v.agents : [];
    return ags.find((o) => Array.isArray(o) && !o[6] && String(o[8] || '').toLowerCase() === email) || null;
  };
  app.use('/api/m', (_req, _res, next) => ready.then(() => next(), next));

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email, name FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    return { email: String(r.rows[0].email).toLowerCase(), name: r.rows[0].name || e.split('@')[0] };
  }
  const cols = `id, owner, name, province, area, ref_code, fee, reject_note, discount, daily_cap, status, details, address, landmark, services, phone, received, updated_at, created_at, (image IS NOT NULL AND image<>'') AS has_img`;
  const pub = (m) => ({
    id: m.id, name: m.name, province: m.province, area: m.area || '', discount: m.discount, details: m.details, address: m.address,
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
      me = { ...pub(mine), status: mine.status, fee: Number(mine.fee) || 0, note: mine.reject_note || '', total: Number(mine.received) || 0, today: await today(mine.id), tx: [] };
      if (mine.status === 'active') me.tx = (await q(`SELECT payer_name n, pts, created_at t FROM merchant_tx WHERE merchant_id=$1 ORDER BY id DESC LIMIT 60`, [mine.id])).rows.map((r) => ({ n: r.n, pts: Number(r.pts), t: r.t }));
    }
    const av = {};
    (await q(`SELECT email, (EXTRACT(EPOCH FROM updated_at)*1000)::bigint v FROM avatars`)).rows.forEach((r) => { av[r.email] = Number(r.v); });
    const agents = {};
    (await q(`SELECT email, description d, methods m FROM agent_profiles`)).rows.forEach((r) => { agents[String(r.email).toLowerCase()] = { d: r.d, m: r.m }; });
    // حالة الوكالة من الإعدادات المنشورة: مصدر ثابت يصل للمستخدم خلال 5 ثوانٍ حتى لو تعطّلت مزامنة الإعدادات العامة
    let agent = null, agp = null;
    try {
      const cfg = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0], v = cfg && cfg.val;
      const ags = v && Array.isArray(v.agents) ? v.agents : [];
      agent = ags.find((o) => Array.isArray(o) && !o[6] && String(o[8] || '').toLowerCase() === u.email) || null;
      if (agent && v.agx && v.agx[agent[0]] != null) agp = String(v.agx[agent[0]]);
    } catch (e) {}
    // حد الدفع اليومي للمستخدم + ما دفعه اليوم، وطلبات الوكيل لشراء النقاط وحالتها
    const mpLimit = await getPayLimit(), mpUsed = await paidToday(u.email);
    let abuys = [];
    if (agent) abuys = (await q(`SELECT id, pts, iqd, status, note, created_at t, decided_at d FROM agent_buys WHERE email=$1 ORDER BY id DESC LIMIT 8`, [u.email])).rows
      .map((r) => ({ id: Number(r.id), pts: Number(r.pts), iqd: Number(r.iqd), st: r.status, note: r.note || '', t: r.t, d: r.d }));
    res.json({ ok: true, merchants: list.map(pub), me, av, agents, agent, agentCode: agp, mpLimit, mpUsed, abuys });
  }));

  /* الوكيل يرسل طلب شراء نقاط بالسعر الرسمي إلى لوحة التحكم */
  app.post('/api/m/agent/buy', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const ag = await agentRow(u.email);
    if (!ag) fail(403, 'حسابك غير مسجل كوكيل');
    const pts = Math.floor(num(req.body.pts, 1e11));
    if (pts < 1) fail(400, 'أدخل عدد النقاط');
    const pend = Number((await q(`SELECT COUNT(*) n FROM agent_buys WHERE email=$1 AND status='pending'`, [u.email])).rows[0].n);
    if (pend >= 5) fail(429, 'لديك 5 طلبات قيد المراجعة، انتظر معالجتها أولاً');
    const c = (await pubCfg()).cfg || {}, rate = Number(c.agOff) > 0 ? Number(c.agOff) : 120;
    const iqd = Math.round(pts * rate / 1000);
    const r = await q(`INSERT INTO agent_buys(email, agent_name, pts, rate, iqd) VALUES($1,$2,$3,$4,$5) RETURNING id`, [u.email, txt(ag[0], 80), pts, rate, iqd]);
    res.json({ ok: true, id: Number(r.rows[0].id), iqd });
  }));

  /* بحث عن عضو من لوحة الوكيل بكود الإحالة أو البريد أو الاسم — يعيد الاسم والصورة والبريد */
  const lkLim = rateLimit({ windowMs: 60 * 1000, limit: 150, standardHeaders: true, legacyHeaders: false });
  app.post('/api/m/agent/lookup', lkLim, wrap(async (req, res) => {
    const u = await who(req.body);
    if (!(await agentRow(u.email))) fail(403, 'حسابك غير مسجل كوكيل');
    const s = txt(req.body.q, 60).toLowerCase();
    if (s.length < 2) return res.json({ ok: true, items: [] });
    const like = s.replace(/[\\%_]/g, '\\$&') + '%', cont = '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
    const rows = (await q(`SELECT a.email, a.name, a.uid, a.rcode,
        (SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) AS av
      FROM sync_accounts a
      WHERE LOWER(a.email)<>$1 AND NOT COALESCE(a.blk,false) AND NOT COALESCE(a.demo,false)
        AND ( UPPER(COALESCE(a.rcode,''))=UPPER($2) OR LOWER(a.email) LIKE $3 OR LOWER(COALESCE(a.name,'')) LIKE $4
              OR LOWER(a.email) IN (SELECT LOWER(email) FROM ref_owned WHERE code=UPPER($2)) )
      ORDER BY (UPPER(COALESCE(a.rcode,''))=UPPER($2)) DESC, (LOWER(a.email)=$2) DESC, a.name LIMIT 6`, [u.email, s, like, cont])).rows;
    res.json({ ok: true, items: rows.map((r) => ({ uid: r.uid || '', name: r.name || '', email: r.email, code: r.rcode || '', av: Number(r.av) || 0 })) });
  }));

  /* شحن عضو من لوحة الوكيل — يتم على السيرفر: يُخصم من الرسمي ثم السيولة ويُضاف لرصيد العضو فوراً */
  app.post('/api/m/agent/charge', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const pts = Math.floor(num(req.body.pts, 1e11));
    if (pts < 1) fail(400, 'أدخل عدد النقاط');
    const key = txt(req.body.target, 200).toLowerCase();
    if (!key) fail(400, 'اختر العضو أولاً');
    const c = await pool.connect();
    let cmds = [], out = null;
    try {
      await c.query('BEGIN');
      const tg = (await c.query(`SELECT email, name, blk FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [key])).rows[0];
      if (!tg) fail(404, 'العضو غير موجود');
      const tEmail = String(tg.email).toLowerCase();
      if (tEmail === u.email) fail(400, 'لا يمكنك شحن حسابك من لوحة الوكيل');
      if (tg.blk) fail(403, 'هذا الحساب موقوف');
      const kv = (await c.query(`SELECT val FROM sync_kv WHERE key='config' FOR UPDATE`)).rows[0];
      const cv = kv && kv.val, ags = cv && Array.isArray(cv.agents) ? cv.agents : [];
      const ix = ags.findIndex((o) => Array.isArray(o) && !o[6] && String(o[8] || '').toLowerCase() === u.email);
      if (ix < 0) fail(403, 'حسابك غير مسجل كوكيل');
      const ag = ags[ix], liq = Number(ag[4]) || 0, off = Number(ag[9]) || 0;
      if (pts > liq + off) fail(400, 'رصيدك لا يكفي، المتاح ' + (liq + off).toLocaleString('en-US'));
      const fo = Math.min(off, pts);
      ag[9] = off - fo; ag[4] = liq - (pts - fo);
      await c.query(`UPDATE sync_kv SET val=$1, updated_at=NOW() WHERE key='config'`, [JSON.stringify(cv)]);
      await c.query(`UPDATE sync_accounts SET pts=COALESCE(pts,0)+$2 WHERE LOWER(email)=$1`, [tEmail, pts]);
      await c.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [tEmail, pts]).catch(() => {});
      const bodies = [
        { t: 'adj', sc: 'all', e: tEmail, d: { pts }, gf: { r: 'شحن من الوكيل ' + String(ag[0] || ''), x: pts.toLocaleString('en-US') + ' نقطة' } },
        { t: 'agl', sc: 'all', e: u.email, v: Number(ag[4]), o: Number(ag[9]) },
      ];
      for (const b of bodies) { const r = await c.query(`INSERT INTO sync_cmds(body) VALUES($1) RETURNING id`, [JSON.stringify(b)]); cmds.push([Number(r.rows[0].id), b]); }
      await c.query(`INSERT INTO notices(email,body) VALUES($1,$2)`, [tEmail, '✅ تم شحن ' + pts.toLocaleString('en-US') + ' نقطة إلى رصيدك من الوكيل ' + String(ag[0] || '') + '.']);
      await c.query('COMMIT');
      out = { ok: true, liq: Number(ag[4]), off: Number(ag[9]), name: tg.name || '', email: tEmail, agent: String(ag[0] || '') };
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    try { if (app.locals.broadcastCmd) cmds.forEach(([id, b]) => app.locals.broadcastCmd(id, b)); } catch (e) {}
    q(`INSERT INTO agent_tx(uid,agent_email,agent_name,kind,pts,target_email,target_name,note) VALUES($1,$2,$3,'charge',$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [u.email + ':c:' + crypto.randomBytes(6).toString('hex'), u.email, out.agent, pts, out.email, out.name, 'شحن رصيد عضو']).catch(() => {});
    res.json(out);
  }));

  app.post('/api/m/apply', wLim, wrap(async (req, res) => {
    const u = await who(req.body), b = req.body;
    const name = txt(b.name, 80), phone = txt(b.phone, 25).replace(/[^\d+]/g, ''), province = txt(b.province, 40), area = txt(b.area, 80), landmark = txt(b.landmark, 160);
    if (!name) fail(400, 'اسم المتجر مطلوب');
    if (phone.replace(/\D/g, '').length < 9) fail(400, 'رقم الهاتف غير صحيح');
    if (!province) fail(400, 'اختر المحافظة');
    if (!area) fail(400, 'اكتب المنطقة');
    if (!landmark) fail(400, 'اكتب أقرب نقطة دالة');
    const ex = (await q(`SELECT id FROM merchants WHERE LOWER(owner)=$1 AND status IN ('pending','active')`, [u.email])).rows[0];
    if (ex) return res.json({ ok: true, dup: true });
    // الرسوم تُستقطع مقدماً من رصيد المستخدم على جهازه (تُسجَّل في المالية ضمن «رسوم تجارة» تلقائياً)
    await q(`INSERT INTO merchants(owner,name,province,area,landmark,phone,ref_code,fee,discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [u.email, name, province, area, landmark, phone, txt(b.ref_code, 20), Math.floor(num(b.fee, 1e10)), Math.min(100, Math.round(num(b.discount, 100)) || 10)]);
    res.json({ ok: true });
  }));

  // التاجر المعتمد يعدّل الوصف ونسبة الخصم فقط (بقية البيانات من لوحة التحكم)
  app.post('/api/m/profile', wLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const m = (await q(`SELECT id FROM merchants WHERE LOWER(owner)=$1 AND status='active'`, [u.email])).rows[0];
    if (!m) fail(403, 'لا تملك متجراً معتمداً');
    const dc = Number(req.body.discount);
    if (!Number.isFinite(dc) || dc < 0 || dc > 100) fail(400, 'نسبة الخصم بين 0 و100');
    await q(`UPDATE merchants SET discount=$2,details=$3,services=COALESCE($4,services),updated_at=NOW() WHERE id=$1`,
      [m.id, Math.round(dc), txt(req.body.details, 600), req.body.services == null ? null : txt(req.body.services, 400)]);
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
      // الحد اليومي للمستخدم (يحدده المدير من لوحة التحكم). القفل يمنع تجاوزه بطلبات متزامنة
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['mxpay:' + u.email]);
      const lim = await getPayLimit(c);
      if (lim > 0) {
        const used = await paidToday(u.email, c);
        if (used + pts > lim) fail(400, 'تجاوزت الحد اليومي للدفع للتجار (' + lim.toLocaleString('en-US') + ' نقطة). المتبقي لك اليوم: ' + Math.max(0, lim - used).toLocaleString('en-US') + ' نقطة');
      }
      const cap = Number(m.daily_cap) || 0;
      if (cap > 0) {
        const t = Number((await c.query(`SELECT COALESCE(SUM(pts),0) s FROM merchant_tx WHERE merchant_id=$1 AND created_at >= ${DAY_START}`, [id])).rows[0].s);
        if (t + pts > cap) fail(400, 'تجاوز السقف اليومي للمتجر. المتبقي اليوم: ' + Math.max(0, cap - t).toLocaleString('en-US') + ' نقطة');
      }
      await c.query(`INSERT INTO merchant_tx(merchant_id,payer,payer_name,pts) VALUES($1,$2,$3,$4)`, [id, u.email, u.name, pts]);
      await c.query(`UPDATE merchants SET received=received+$2 WHERE id=$1`, [id, pts]);
      await c.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [owner, pts]);
      await c.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [owner, pts]);
      const cmd = { t: 'adj', sc: 'all', e: owner, d: { pts } };
      const cid = (await c.query(`INSERT INTO sync_cmds(body) VALUES($1) RETURNING id`, [JSON.stringify(cmd)])).rows[0].id;
      await c.query('COMMIT');
      try { if (app.locals.broadcastCmd) app.locals.broadcastCmd(Number(cid), cmd); } catch (e) {} // وصول فوري لجهاز التاجر
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
    const nm = {}; (await q(`SELECT LOWER(email) e, name FROM sync_accounts`)).rows.forEach((x) => { nm[x.e] = x.name; });
    for (const m of r) out.push({ ...pub(m), status: m.status, ref_code: m.ref_code, fee: Number(m.fee) || 0, owner_name: nm[String(m.owner).toLowerCase()] || '', total: Number(m.received) || 0, today: await today(m.id) });
    res.json({ merchants: out, pay_limit: await getPayLimit() });
  }));
  // الحد اليومي لما يدفعه المستخدم الواحد للتجار (0 = بلا حد)
  app.post('/api/ctl/merchants/settings', ...ctl, wrap(async (req, res) => {
    const v = Math.floor(num(req.body.pay_limit, 1e12));
    await q(`INSERT INTO mx_settings(k,v,updated_at) VALUES('pay_limit',$1,NOW()) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v, updated_at=NOW()`, [String(v)]);
    res.json({ ok: true, pay_limit: v });
  }));

  /* ---- طلبات شراء النقاط من الوكلاء (لوحة التحكم) ---- */
  app.get('/api/ctl/agent-buys', ...ctl, wrap(async (_req, res) => {
    const rows = (await q(`SELECT b.id, b.email, b.agent_name, b.pts, b.rate, b.iqd, b.status, b.note, b.created_at, b.decided_at, a.name AS name, a.phone AS phone
      FROM agent_buys b LEFT JOIN sync_accounts a ON LOWER(a.email)=b.email
      ORDER BY (b.status='pending') DESC, b.id DESC LIMIT 120`)).rows;
    const pc = await pubCfg(), ags = Array.isArray(pc.agents) ? pc.agents : [];
    const iqd = Number((pc.cfg || {}).iqd) || 1620;
    res.json({ ok: true, usdRate: iqd, items: rows.map((r) => ({ id: Number(r.id), email: r.email, name: r.name || '', phone: r.phone || ((ags.find((o) => Array.isArray(o) && String(o[8] || '').toLowerCase() === String(r.email).toLowerCase()) || [])[2]) || '', agent: r.agent_name, pts: Number(r.pts), rate: Number(r.rate), iqd: Number(r.iqd), usd: Math.round(Number(r.iqd) / iqd * 100) / 100, status: r.status, note: r.note, at: r.created_at, decided: r.decided_at })) });
  }));

  app.post('/api/ctl/agent-buys/act', ...ctl, wrap(async (req, res) => {
    const id = parseInt(req.body.id, 10) || 0, approve = req.body.act === 'approve', note = txt(req.body.note, 200);
    const c = await pool.connect();
    let cmd = null, cid = null, row = null;
    try {
      await c.query('BEGIN');
      row = (await c.query(`SELECT * FROM agent_buys WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!row) fail(404, 'الطلب غير موجود');
      if (row.status !== 'pending') fail(409, 'تمت معالجة هذا الطلب مسبقاً');
      const email = String(row.email).toLowerCase(), pts = Number(row.pts);
      if (approve) {
        if (!(await agentRow(email))) fail(400, 'هذا الحساب لم يعد مسجلاً كوكيل');
        // «موافق» = شحن سيولة الوكيل (الإعدادات المنشورة هي مصدر لوحة الوكيل) بمقدار ما طلبه، ثم بثّ القيمة الجديدة لجهازه فوراً
        const kv = (await c.query(`SELECT val FROM sync_kv WHERE key='config' FOR UPDATE`)).rows[0];
        const cv = kv && kv.val, ags = cv && Array.isArray(cv.agents) ? cv.agents : [];
        const ix = ags.findIndex((o) => Array.isArray(o) && !o[6] && String(o[8] || '').toLowerCase() === email);
        if (ix < 0) fail(400, 'هذا الحساب لم يعد مسجلاً كوكيل');
        ags[ix][4] = (Number(ags[ix][4]) || 0) + pts;
        await c.query(`UPDATE sync_kv SET val=$1, updated_at=NOW() WHERE key='config'`, [JSON.stringify(cv)]);
        cmd = { t: 'agl', sc: 'all', e: email, v: Number(ags[ix][4]), o: Number(ags[ix][9]) || 0, add: pts }; // قيم مطلقة فلا تتكرر الإضافة
        cid = (await c.query(`INSERT INTO sync_cmds(body) VALUES($1) RETURNING id`, [JSON.stringify(cmd)])).rows[0].id;
        await c.query(`INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,'in','agent_pts',$3,$4,$5,'auto') ON CONFLICT DO NOTHING`,
          ['agbuy:' + id, email, pts, Number(row.iqd), 'بيع نقاط للوكيل ' + row.agent_name + ' بالسعر الرسمي']);
        await c.query(`UPDATE agent_buys SET status='approved', note=$2, decided_at=NOW() WHERE id=$1`, [id, note]);
        await c.query(`INSERT INTO notices(email,body) VALUES($1,$2)`, [row.email, '✅ تمت الموافقة على طلبك وأُضيفت ' + pts.toLocaleString('en-US') + ' نقطة إلى سيولتك.']);
      } else {
        await c.query(`UPDATE agent_buys SET status='rejected', note=$2, decided_at=NOW() WHERE id=$1`, [id, note]);
        await c.query(`INSERT INTO notices(email,body) VALUES($1,$2)`, [row.email, 'تم رفض طلب شراء ' + pts.toLocaleString('en-US') + ' نقطة' + (note ? ': ' + note : '') + '.']);
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    try { if (cmd && app.locals.broadcastCmd) app.locals.broadcastCmd(Number(cid), cmd); } catch (e) {} // وصول لحظي بدون انتظار المراقب
    res.json({ ok: true, status: approve ? 'approved' : 'rejected' });
  }));

  app.post('/api/ctl/merchants/save', ...ctl, wrap(async (req, res) => {
    const b = req.body, id = parseInt(b.id, 10) || 0;
    const prev = (await q(`SELECT * FROM merchants WHERE id=$1`, [id])).rows[0];
    if (!prev) fail(404, 'غير موجود');
    // رفض الطلب: تُعاد الرسوم المستقطعة مقدماً للمستخدم فوراً
    if (b.status === 'rejected') {
      if (prev.status === 'pending' && Number(prev.fee) > 0) {
        const fee = Number(prev.fee), owner = String(prev.owner).toLowerCase();
        await q(`UPDATE sync_accounts SET pts=COALESCE(pts,0)+$2 WHERE LOWER(email)=$1`, [owner, fee]);
        await q(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [owner, fee]).catch(() => {});
        await q(`INSERT INTO sync_cmds(body) VALUES($1)`, [JSON.stringify({ t: 'adj', sc: 'all', e: owner, d: { pts: fee }, by: 'srv' })]);
        const cfg = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0], c = (cfg && cfg.val && cfg.val.cfg) || {};
        const pr = (Number(c.agRate) > 0 ? Number(c.agRate) : 132) / 1000;
        await q(`INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,'out','trade',$3,$4,$5,'auto') ON CONFLICT DO NOTHING`,
          ['trade-refund:' + id, owner, fee, Math.round(fee * pr * 100) / 100, 'استرجاع رسوم طلب تجارة (رفض): ' + prev.name]).catch(() => {});
      }
      await q(`UPDATE merchants SET status='rejected',reject_note=$2,updated_at=NOW() WHERE id=$1`, [id, txt(b.note, 200)]);
      await q(`INSERT INTO notices(email,body) VALUES($1,$2)`, [prev.owner, 'تم رفض طلب التاجر' + (b.note ? ': ' + txt(b.note, 200) : '') + '. أُعيدت الرسوم إلى رصيدك.']).catch(() => {});
      return res.json({ ok: true });
    }
    const st = ['pending', 'active', 'suspended'].includes(b.status) ? b.status : null;
    await q(`UPDATE merchants SET status=COALESCE($2,status), daily_cap=COALESCE($3,daily_cap), discount=COALESCE($4,discount), name=COALESCE($5,name), province=COALESCE($6,province), updated_at=NOW() WHERE id=$1`,
      [id, st, b.daily_cap == null || b.daily_cap === '' ? null : Math.floor(num(b.daily_cap)), b.discount == null || b.discount === '' ? null : Math.min(100, Math.floor(num(b.discount, 100))), b.name ? txt(b.name, 80) : null, b.province ? txt(b.province, 40) : null]);
    if (st === 'active' && prev.status !== 'active') await q(`INSERT INTO notices(email,body) VALUES($1,$2)`, [prev.owner, '🎉 أنت تاجر الآن! تم اعتماد متجرك ' + prev.name]).catch(() => {});
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

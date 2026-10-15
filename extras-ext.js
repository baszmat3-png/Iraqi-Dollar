/* المرحلة 5 — شراء رموز الإحالة (رمز فريد يثبت في الحساب) + حملات التبرع للحالات المرضية */
const rateLimit = require('express-rate-limit');

const MAX_IMG = 1.5e6;
const img = (v) => (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) && v.length <= MAX_IMG ? v : null);
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const DON_MIN = 100, DON_MAX = 1000000;

exports.parsers = (app, express) => {
  // صورة الحملة أكبر من حد 50kb العام
  app.use('/api/ctl/campaigns/save', express.json({ limit: '3mb' }));
};

exports.routes = (app, { pool, wrap, ctl, SYNC }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, validate: false });

  const ddl = [
    `CREATE TABLE IF NOT EXISTS ref_owned(code TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, price BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS campaigns(id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '', img TEXT,
       goal BIGINT NOT NULL DEFAULT 0, raised BIGINT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS campaign_donations(id BIGSERIAL PRIMARY KEY, campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
       email TEXT NOT NULL, pts BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS campaign_don_idx ON campaign_donations(campaign_id, id DESC)`,
    `CREATE TABLE IF NOT EXISTS agent_tx(uid TEXT PRIMARY KEY, agent_email TEXT NOT NULL, agent_name TEXT, kind TEXT NOT NULL, pts BIGINT NOT NULL DEFAULT 0,
       target_email TEXT, target_name TEXT, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS agent_tx_idx ON agent_tx(LOWER(agent_email), created_at DESC)`,
  ];
  const ready = (async () => {
    for (let t = 0; t < 8; t++) {
      try { for (const s of ddl) await q(s); return; }
      catch (e) { if (t === 7) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('extras-ext schema:', e.message));
  app.use(['/api/refcode', '/api/campaigns', '/api/u/refcode', '/api/u/campaign', '/api/ctl/campaigns', '/api/u/agent', '/api/ctl/agents'], (_req, _res, next) => ready.then(() => next(), next));

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email, blk FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    if (r.rows[0].blk) fail(403, 'الحساب موقوف');
    return String(r.rows[0].email).toLowerCase();
  }

  /* ===== رموز الإحالة ===== */
  // الرموز المباعة + رمز المستخدم المشتَرى (إن وجد)
  app.get('/api/refcode/state', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const e = txt(req.query.e, 200).toLowerCase();
    const sold = (await q(`SELECT code FROM ref_owned`)).rows.map((r) => r.code);
    let mine = null;
    if (e) { const r = (await q(`SELECT code FROM ref_owned WHERE LOWER(email)=$1`, [e])).rows[0]; mine = r ? r.code : null; }
    res.json({ sold, mine });
  }));

  // شراء رمز: يُستبدل رمز الإحالة القديم فوراً ويثبّت في الحساب. السعر يؤخذ من إعدادات المتجر المنشورة.
  app.post('/api/u/refcode/buy', lim, wrap(async (req, res) => {
    const email = await who(req.body);
    const code = txt(req.body.code, 16).toUpperCase();
    if (!/^[A-Z0-9]{3,16}$/.test(code)) fail(400, 'رمز غير صالح');
    const cfg = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const list = (cfg && cfg.val && Array.isArray(cfg.val.rfc)) ? cfg.val.rfc : [];
    const item = list.find((c) => String(c[0]).toUpperCase() === code);
    if (!item || item[3] === 0) fail(404, 'الرمز غير متاح للبيع');
    const price = Math.floor(Number(item[1]) || 0);
    if (!(price > 0)) fail(400, 'سعر الرمز غير صالح');
    const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const taken = (await cl.query(`SELECT email FROM ref_owned WHERE code=$1 FOR UPDATE`, [code])).rows[0];
      if (taken && String(taken.email).toLowerCase() === email) { await cl.query('ROLLBACK'); return res.json({ ok: true, code, price: 0, already: true }); }
      if (taken) fail(409, 'هذا الرمز مباع بالفعل');
      const used = (await cl.query(`SELECT 1 FROM sync_accounts WHERE UPPER(rcode)=$1 AND LOWER(email)<>$2 LIMIT 1`, [code, email])).rows[0];
      if (used) fail(409, 'هذا الرمز مستخدم من حساب آخر');
      await cl.query(`DELETE FROM ref_owned WHERE LOWER(email)=$1`, [email]); // يُستبدل الرمز السابق
      await cl.query(`INSERT INTO ref_owned(code,email,price) VALUES($1,$2,$3)`, [code, email, price]);
      await cl.query(`UPDATE sync_accounts SET rcode=$2 WHERE LOWER(email)=$1`, [email, code]);
      await cl.query('COMMIT');
    } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e; }
    finally { cl.release(); }
    res.json({ ok: true, code, price });
  }));

  /* ===== حملات التبرع ===== */
  const pub = (r) => ({ id: Number(r.id), title: r.title, descr: r.descr, img: r.has_img ? `/api/campaigns/${r.id}/img?v=${new Date(r.updated_at).getTime()}` : '', goal: Number(r.goal) || 0, raised: Number(r.raised) || 0, donors: Number(r.donors) || 0 });

  app.get('/api/campaigns', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const r = await q(`SELECT c.id,c.title,c.descr,(c.img IS NOT NULL) AS has_img,c.goal,c.raised,c.updated_at,
        (SELECT COUNT(DISTINCT email) FROM campaign_donations d WHERE d.campaign_id=c.id) AS donors
      FROM campaigns c WHERE c.active ORDER BY c.id DESC LIMIT 50`);
    res.json({ items: r.rows.map(pub) });
  }));

  app.get('/api/campaigns/:id/img', wrap(async (req, res) => {
    const r = (await q(`SELECT img FROM campaigns WHERE id=$1`, [Number(req.params.id) || 0])).rows[0];
    const m = r && r.img && /^data:(image\/[a-z+]+);base64,(.*)$/s.exec(r.img);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]); res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  }));

  app.post('/api/u/campaign/donate', lim, wrap(async (req, res) => {
    const email = await who(req.body);
    const id = Number(req.body.id) || 0, pts = Math.floor(Number(req.body.pts) || 0);
    if (!(pts >= DON_MIN && pts <= DON_MAX)) fail(400, 'قيمة التبرع من 100 إلى 1,000,000 نقطة');
    const c = (await q(`UPDATE campaigns SET raised=raised+$2 WHERE id=$1 AND active RETURNING id,title,raised,goal`, [id, pts])).rows[0];
    if (!c) fail(404, 'الحملة غير متاحة');
    await q(`INSERT INTO campaign_donations(campaign_id,email,pts) VALUES($1,$2,$3)`, [id, email, pts]);
    res.json({ ok: true, title: c.title, raised: Number(c.raised), goal: Number(c.goal) });
  }));

  /* ===== لوحة التحكم ===== */
  app.get('/api/ctl/campaigns', ...ctl, wrap(async (_req, res) => {
    const r = await q(`SELECT c.id,c.title,c.descr,(c.img IS NOT NULL) AS has_img,c.goal,c.raised,c.active,c.updated_at,
        (SELECT COUNT(DISTINCT email) FROM campaign_donations d WHERE d.campaign_id=c.id) AS donors
      FROM campaigns c ORDER BY c.id DESC LIMIT 200`);
    res.json({ items: r.rows.map((x) => ({ ...pub(x), active: !!x.active })) });
  }));

  app.post('/api/ctl/campaigns/save', ...ctl, wrap(async (req, res) => {
    const id = Number(req.body.id) || 0, title = txt(req.body.title, 120), descr = txt(req.body.descr, 2000);
    const goal = Math.max(0, Math.floor(Number(req.body.goal) || 0)), active = req.body.active !== false;
    const im = img(req.body.img);
    if (!title) fail(400, 'اكتب اسم الحملة');
    if (id) {
      const r = await q(`UPDATE campaigns SET title=$2,descr=$3,goal=$4,active=$5,img=COALESCE($6,img),updated_at=NOW() WHERE id=$1 RETURNING id`, [id, title, descr, goal, active, im]);
      if (!r.rows[0]) fail(404, 'الحملة غير موجودة');
      return res.json({ ok: true, id });
    }
    if (!im) fail(400, 'أضف صورة للحالة');
    const r = await q(`INSERT INTO campaigns(title,descr,img,goal,active) VALUES($1,$2,$3,$4,$5) RETURNING id`, [title, descr, im, goal, active]);
    res.json({ ok: true, id: Number(r.rows[0].id) });
  }));

  app.post('/api/ctl/campaigns/del', ...ctl, wrap(async (req, res) => {
    await q(`DELETE FROM campaigns WHERE id=$1`, [Number(req.body.id) || 0]);
    res.json({ ok: true });
  }));
  /* ===== مراقبة الوكلاء ===== */
  const agentsCfg = async () => {
    const cfg = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const a = (cfg && cfg.val && Array.isArray(cfg.val.agents)) ? cfg.val.agents : [];
    return a.filter((o) => Array.isArray(o) && !o[6] && o[8]).map((o) => ({ name: String(o[0] || ''), email: String(o[8]).toLowerCase(), liq: Number(o[4]) || 0, off: Number(o[9]) || 0 }));
  };
  const isAgent = async (email) => (await agentsCfg()).find((a) => a.email === email);
  const KIND = { charge: 'شحن عضو (بيع نقاط)', addoff: 'إضافة للرصيد الرسمي', buy: 'طلب شراء نقاط بالسعر الرسمي', transfer_in: 'تحويل نقاط إليه من مستخدم' };

  // التطبيق يبلّغ عن حركات الوكيل (شحن عضو / إضافة رصيد رسمي / طلب شراء)
  app.post('/api/u/agent/log', lim, wrap(async (req, res) => {
    const email = await who(req.body);
    const ag = await isAgent(email);
    if (!ag) fail(403, 'حسابك غير مسجل كوكيل');
    const kind = txt(req.body.kind, 20);
    if (!['charge', 'addoff', 'buy'].includes(kind)) fail(400, 'نوع غير صالح');
    const pts = Math.floor(Number(req.body.pts) || 0);
    if (!(pts > 0 && pts <= 1e12)) fail(400, 'قيمة غير صالحة');
    const uid = email + ':' + (txt(req.body.uid, 40) || Date.now().toString(36));
    await q(`INSERT INTO agent_tx(uid,agent_email,agent_name,kind,pts,target_email,target_name,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [uid, email, ag.name, kind, pts, txt(req.body.to, 200).toLowerCase() || null, txt(req.body.toName, 120) || null, txt(req.body.note, 300) || null]);
    res.json({ ok: true });
  }));

  // أي تحويل نقاط بين المستخدمين: إن كان المستلم وكيلاً يُسجَّل كحركة وارد له
  app.post('/api/u/agent/xfer', lim, wrap(async (req, res) => {
    const email = await who(req.body);
    const to = txt(req.body.to, 120).toLowerCase(), pts = Math.floor(Number(req.body.pts) || 0);
    if (!to || !(pts > 0 && pts <= 1e12)) return res.json({ ok: true, agent: false });
    const ags = await agentsCfg();
    const rows = (await q(`SELECT email,name,rcode FROM sync_accounts WHERE LOWER(email)=$1 OR LOWER(name)=$1 OR UPPER(rcode)=UPPER($1)`, [to])).rows;
    const hit = rows.map((r) => ags.find((a) => a.email === String(r.email).toLowerCase())).find(Boolean);
    if (!hit || hit.email === email) return res.json({ ok: true, agent: false });
    const me = (await q(`SELECT name FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0];
    await q(`INSERT INTO agent_tx(uid,agent_email,agent_name,kind,pts,target_email,target_name,note) VALUES($1,$2,$3,'transfer_in',$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [email + ':x:' + (txt(req.body.uid, 40) || Date.now().toString(36)), hit.email, hit.name, pts, email, (me && me.name) || email, 'من ' + ((me && me.name) || email)]);
    res.json({ ok: true, agent: true });
  }));

  const wdOf = (email) => Object.values((SYNC && SYNC.wreq && SYNC.wreq()) || {}).filter((w) => w && String(w.u || '').toLowerCase() === email);

  app.get('/api/ctl/agents', ...ctl, wrap(async (_req, res) => {
    const ags = await agentsCfg();
    const st = (await q(`SELECT LOWER(agent_email) e, kind, COUNT(*)::int n, COALESCE(SUM(pts),0)::float8 pts, COUNT(DISTINCT target_email)::int m, MAX(created_at) last FROM agent_tx GROUP BY 1,2`)).rows;
    const bl = (await q(`SELECT LOWER(email) e, COALESCE(SUM(pts) FILTER (WHERE pts>0),0)::float8 plus, COALESCE(SUM(-pts) FILTER (WHERE pts<0),0)::float8 minus, COUNT(*)::int n FROM bal_log GROUP BY 1`).catch(() => ({ rows: [] }))).rows;
    const bal = (await q(`SELECT LOWER(email) e, name, pts, usd FROM sync_accounts`)).rows;
    const items = ags.map((a) => {
      const k = (kind) => st.find((r) => r.e === a.email && r.kind === kind) || { n: 0, pts: 0, m: 0 };
      const b = bl.find((r) => r.e === a.email) || { plus: 0, minus: 0, n: 0 };
      const acc = bal.find((r) => r.e === a.email);
      const wd = wdOf(a.email);
      const last = st.filter((r) => r.e === a.email).map((r) => +new Date(r.last)).sort((x, y) => y - x)[0] || 0;
      return {
        ...a, balance: acc ? Number(acc.pts) || 0 : 0, user: acc ? acc.name : '',
        sold: { n: k('charge').n, pts: k('charge').pts, members: k('charge').m },
        recv: { n: k('transfer_in').n, pts: k('transfer_in').pts, from: k('transfer_in').m },
        addoff: { n: k('addoff').n, pts: k('addoff').pts },
        buy: { n: k('buy').n, pts: k('buy').pts },
        admin: { plus: b.plus, minus: b.minus, n: b.n },
        wd: { n: wd.length, usd: wd.reduce((t, w) => t + (Number(w.a) || 0), 0), pending: wd.filter((w) => w.st === 'p').length },
        last,
      };
    });
    res.json({ items });
  }));

  app.get('/api/ctl/agents/log', ...ctl, wrap(async (req, res) => {
    const email = txt(req.query.email, 200).toLowerCase();
    if (!email) fail(400, 'البريد مطلوب');
    const out = [];
    (await q(`SELECT kind,pts,target_email,target_name,note,created_at FROM agent_tx WHERE LOWER(agent_email)=$1 ORDER BY created_at DESC LIMIT 300`, [email])).rows
      .forEach((r) => out.push({ t: +new Date(r.created_at), k: r.kind, label: KIND[r.kind] || r.kind, pts: Number(r.pts), who: r.target_name || r.target_email || '', note: r.note || '' }));
    (await q(`SELECT op,pts,usd,note,created_at FROM bal_log WHERE LOWER(email)=$1 ORDER BY id DESC LIMIT 100`, [email]).catch(() => ({ rows: [] }))).rows
      .forEach((r) => out.push({ t: +new Date(r.created_at), k: 'admin_' + r.op, label: 'تعديل رصيد من الإدارة (' + ({ add: 'شحن', sub: 'خصم', set: 'تعيين', zero: 'تصفير' }[r.op] || r.op) + ')', pts: Number(r.pts), who: 'الإدارة', note: r.note || '' }));
    wdOf(email).forEach((w) => out.push({ t: Number(w.t) || 0, k: 'wd', label: 'طلب سحب رصيد', pts: 0, usd: Number(w.a) || 0, who: w.m || '', note: 'الحالة: ' + ({ p: 'قيد المراجعة', a: 'موافق', d: 'مرفوض' }[w.st] || w.st || '') }));
    out.sort((a, b) => b.t - a.t);
    res.json({ items: out.slice(0, 400) });
  }));
};

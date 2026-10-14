/* المرحلة 1ب — الإدارة: المستخدمون + البلاغات + الدعم + الأسئلة الشائعة (كلها على قاعدة البيانات) */
const rateLimit = require('express-rate-limit');

const MAX_IMG = 1.5e6;
const img = (v) => (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) && v.length <= MAX_IMG ? v : null);
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.min(v, 1e12) : 0; };

exports.parsers = (app, express) => {
  // صور الدعم والبلاغات أكبر من حد 50kb العام، لذلك تُسجَّل قبله
  app.use(['/api/u/support/send', '/api/u/report'], express.json({ limit: '3mb' }));
  app.use('/api/ctl/support/reply', express.json({ limit: '3mb' }));
};

exports.routes = (app, { pool, wrap, ctl }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };

  [
    `CREATE TABLE IF NOT EXISTS support_msgs(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, from_admin BOOLEAN NOT NULL DEFAULT FALSE,
       body TEXT NOT NULL DEFAULT '', img TEXT, read_by_admin BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS support_msgs_email_idx ON support_msgs(LOWER(email), id)`,
    `CREATE TABLE IF NOT EXISTS reports(id BIGSERIAL PRIMARY KEY, reporter TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL,
       details TEXT NOT NULL DEFAULT '', shot TEXT, status TEXT NOT NULL DEFAULT 'open', note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS faq(id BIGSERIAL PRIMARY KEY, cat TEXT NOT NULL DEFAULT 'عام', q TEXT NOT NULL, a TEXT NOT NULL, sort INT NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS notices(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, body TEXT NOT NULL, seen BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  ].reduce((p, s) => p.then(() => q(s)), Promise.resolve()).catch((e) => console.error('admin-ext migrate', e));

  const uLim = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

  // المستخدم يُعرَّف بالبريد + بصمة كلمة المرور (نفس ما يخزّنه التطبيق) — المحظور يستطيع مراسلة الدعم
  async function who(b) {
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    return r.rows[0].email;
  }

  /* ---------------- جهة المستخدم ---------------- */
  app.get('/api/faq', wrap(async (_req, res) => {
    res.json({ items: (await q(`SELECT id,cat,q,a FROM faq ORDER BY sort,id`)).rows });
  }));

  app.post('/api/u/support/history', uLim, wrap(async (req, res) => {
    const e = await who(req.body);
    const r = await q(`SELECT id,from_admin,body,img,created_at FROM support_msgs WHERE LOWER(email)=LOWER($1) ORDER BY id`, [e]);
    res.json({ messages: r.rows });
  }));

  app.post('/api/u/support/send', uLim, wrap(async (req, res) => {
    const e = await who(req.body);
    const body = txt(req.body.body, 2000), im = img(req.body.img);
    if (!body && !im) fail(400, 'الرسالة فارغة');
    await q(`INSERT INTO support_msgs(email,from_admin,body,img) VALUES($1,FALSE,$2,$3)`, [e, body, im]);
    res.json({ ok: true });
  }));

  app.post('/api/u/report', uLim, wrap(async (req, res) => {
    const e = await who(req.body);
    const t = txt(req.body.target, 200), reason = txt(req.body.reason, 100), details = txt(req.body.details, 2000);
    if (!t || !reason) fail(400, 'اكتب الحساب المبلّغ عنه وسبب البلاغ');
    const a = (await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=LOWER($1) OR phone=$1 LIMIT 1`, [t])).rows[0];
    await q(`INSERT INTO reports(reporter,target,reason,details,shot) VALUES($1,$2,$3,$4,$5)`, [e, a ? a.email : t, reason, details, img(req.body.shot)]);
    res.json({ ok: true });
  }));

  app.post('/api/u/notices', uLim, wrap(async (req, res) => {
    const e = await who(req.body);
    const r = await q(`UPDATE notices SET seen=TRUE WHERE LOWER(email)=LOWER($1) AND NOT seen RETURNING id,body`, [e]);
    res.json({ notices: r.rows });
  }));

  /* ---------------- جهة الإدارة (X-Admin-Key) ---------------- */
  app.get('/api/ctl/counts', ...ctl, wrap(async (_req, res) => {
    const a = (await q(`SELECT COUNT(*)::int n FROM reports WHERE status='open'`)).rows[0].n;
    const b = (await q(`SELECT COUNT(*)::int n FROM support_msgs WHERE NOT from_admin AND NOT read_by_admin`)).rows[0].n;
    res.json({ reports: a, support: b });
  }));

  // المستخدمون
  app.get('/api/ctl/users', ...ctl, wrap(async (req, res) => {
    const s = txt(req.query.q, 100), like = '%' + s.replace(/[%_]/g, '') + '%';
    const r = await q(
      `SELECT email,name,phone,demo,pts,gems,usd,blk,kyc,last_seen FROM sync_accounts
       WHERE $1='' OR email ILIKE $2 OR name ILIKE $2 OR phone ILIKE $2 ORDER BY last_seen DESC NULLS LAST LIMIT 500`, [s, like]);
    const t = (await q(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE demo)::int demo, COUNT(*) FILTER (WHERE blk)::int blk FROM sync_accounts`)).rows[0];
    res.json({ total: t, users: r.rows.map((x) => ({ ...x, pts: Number(x.pts), gems: Number(x.gems), usd: Number(x.usd) })) });
  }));

  app.post('/api/ctl/users/act', ...ctl, wrap(async (req, res) => {
    const email = txt(req.body.email, 200).toLowerCase(), op = req.body.op;
    if (!email) fail(400, 'الحساب غير محدد');
    const w = `LOWER(email)=$1`;
    let r;
    if (op === 'delete') {
      if (req.body.confirm !== true) fail(400, 'يلزم تأكيد الحذف');
      r = await q(`DELETE FROM sync_accounts WHERE ${w}`, [email]);
    } else if (op === 'reset') {
      r = await q(`UPDATE sync_accounts SET pts=0,gems=0,usd=0 WHERE ${w}`, [email]);
    } else if (op === 'charge') {
      const p = num(req.body.pts), g = num(req.body.gems), u = num(req.body.usd);
      if (!p && !g && !u) fail(400, 'اكتب مبلغاً للشحن');
      r = await q(`UPDATE sync_accounts SET pts=COALESCE(pts,0)+$2,gems=COALESCE(gems,0)+$3,usd=COALESCE(usd,0)+$4 WHERE ${w}`, [email, p, g, u]);
    } else if (op === 'ban' || op === 'unban') {
      r = await q(`UPDATE sync_accounts SET blk=$2 WHERE ${w}`, [email, op === 'ban']);
    } else fail(400, 'عملية غير معروفة');
    if (!r.rowCount) fail(404, 'الحساب غير موجود');
    res.json({ ok: true });
  }));

  app.post('/api/ctl/users/purge-demo', ...ctl, wrap(async (req, res) => {
    if (req.body.confirm !== true) fail(400, 'يلزم التأكيد');
    const r = await q(`DELETE FROM sync_accounts WHERE demo=TRUE`); // الحسابات الحقيقية لا تُمس
    res.json({ ok: true, deleted: r.rowCount });
  }));

  // البلاغات
  app.get('/api/ctl/reports', ...ctl, wrap(async (req, res) => {
    const st = req.query.status === 'closed' ? 'closed' : 'open';
    const r = await q(
      `SELECT r.id,r.reporter,r.target,r.reason,r.details,r.shot,r.status,r.note,r.created_at,
              (SELECT COALESCE(blk,FALSE) FROM sync_accounts a WHERE LOWER(a.email)=LOWER(r.target)) AS target_blk
       FROM reports r WHERE ($1='open' AND r.status='open') OR ($1='closed' AND r.status<>'open') ORDER BY r.id DESC LIMIT 200`, [st]);
    res.json({ reports: r.rows });
  }));

  app.post('/api/ctl/reports/act', ...ctl, wrap(async (req, res) => {
    const id = Number(req.body.id), op = req.body.op, note = txt(req.body.note, 500);
    const rp = (await q(`SELECT * FROM reports WHERE id=$1`, [id])).rows[0];
    if (!rp) fail(404, 'البلاغ غير موجود');
    if (op === 'ban') {
      await q(`UPDATE sync_accounts SET blk=TRUE WHERE LOWER(email)=LOWER($1)`, [rp.target]);
      await q(`UPDATE reports SET status='banned',note=$2 WHERE id=$1`, [id, note]);
    } else if (op === 'warn') {
      await q(`INSERT INTO notices(email,body) VALUES($1,$2)`, [rp.target, note || 'تنبيه من الإدارة: وصلنا بلاغ ضد حسابك، يرجى الالتزام بشروط الاستخدام.']);
      await q(`UPDATE reports SET status='warned',note=$2 WHERE id=$1`, [id, note]);
    } else if (op === 'close') {
      await q(`UPDATE reports SET status='closed',note=$2 WHERE id=$1`, [id, note]);
    } else fail(400, 'عملية غير معروفة');
    res.json({ ok: true });
  }));

  // الدعم: المحادثة محفوظة دائماً ولا تُحذف
  app.get('/api/ctl/support/threads', ...ctl, wrap(async (_req, res) => {
    const r = await q(
      `SELECT DISTINCT ON (LOWER(m.email)) m.email, m.body, (m.img IS NOT NULL) AS has_img, m.from_admin, m.created_at,
        (SELECT COUNT(*)::int FROM support_msgs x WHERE LOWER(x.email)=LOWER(m.email) AND NOT x.from_admin AND NOT x.read_by_admin) AS unread,
        (SELECT name FROM sync_accounts a WHERE LOWER(a.email)=LOWER(m.email)) AS name
       FROM support_msgs m ORDER BY LOWER(m.email), m.id DESC`);
    r.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ threads: r.rows });
  }));

  app.get('/api/ctl/support/thread', ...ctl, wrap(async (req, res) => {
    const e = txt(req.query.e, 200);
    await q(`UPDATE support_msgs SET read_by_admin=TRUE WHERE LOWER(email)=LOWER($1) AND NOT from_admin`, [e]);
    res.json({ messages: (await q(`SELECT id,from_admin,body,img,created_at FROM support_msgs WHERE LOWER(email)=LOWER($1) ORDER BY id`, [e])).rows });
  }));

  app.post('/api/ctl/support/reply', ...ctl, wrap(async (req, res) => {
    const e = txt(req.body.e, 200), body = txt(req.body.body, 2000), im = img(req.body.img);
    if (!e || (!body && !im)) fail(400, 'الرسالة فارغة');
    await q(`INSERT INTO support_msgs(email,from_admin,body,img,read_by_admin) VALUES($1,TRUE,$2,$3,TRUE)`, [e, body, im]);
    res.json({ ok: true });
  }));

  // الأسئلة الشائعة
  app.post('/api/ctl/faq/save', ...ctl, wrap(async (req, res) => {
    const id = Number(req.body.id) || 0, cat = txt(req.body.cat, 60) || 'عام', Q = txt(req.body.q, 300), A = txt(req.body.a, 3000), sort = Number(req.body.sort) || 0;
    if (!Q || !A) fail(400, 'اكتب السؤال والجواب');
    if (id) await q(`UPDATE faq SET cat=$2,q=$3,a=$4,sort=$5 WHERE id=$1`, [id, cat, Q, A, sort]);
    else await q(`INSERT INTO faq(cat,q,a,sort) VALUES($1,$2,$3,$4)`, [cat, Q, A, sort]);
    res.json({ ok: true });
  }));

  app.post('/api/ctl/faq/del', ...ctl, wrap(async (req, res) => {
    await q(`DELETE FROM faq WHERE id=$1`, [Number(req.body.id)]);
    res.json({ ok: true });
  }));
};

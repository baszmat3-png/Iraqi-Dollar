/* news-ext.js — أخبار المستخدمين: نشر خبر (عنوان + صورة + وصف) + إعجاب + إدارة وحذف من لوحة التحكم
   الجداول: user_news , user_news_likes   (تُنشأ تلقائياً)
   المستخدم:  GET  /api/news/list?e=          قائمة الأخبار (الناشر: الاسم + الصورة + كود الإحالة)
              GET  /api/news/:id/img          صورة الخبر
              POST /api/u/news/publish        نشر خبر   {e,h,title,descr,img}
              POST /api/u/news/like           إعجاب/إلغاء {e,h,id}
              POST /api/u/news/delete         حذف خبر المستخدم نفسه {e,h,id}
   الإدارة:   GET  /api/ctl/news              كل الأخبار مع تفاصيل الناشر
              POST /api/ctl/news/delete       حذف خبر {id}
   كل تغيير يُبثّ فوراً للتطبيقات ولوحة التحكم عبر SSE (حدث store: k='news'). */
const rateLimit = require('express-rate-limit');

const MAX_IMG = 1.5e6;
const isImg = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_IMG;
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

exports.parsers = (app, express) => {
  app.use('/api/u/news/publish', express.json({ limit: '3mb' }));
};

exports.routes = (app, { pool, wrap, ctl }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, validate: false });
  const pubLim = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, validate: false });

  const ddl = [
    `CREATE TABLE IF NOT EXISTS user_news(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, title TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '', img TEXT,
       likes INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS user_news_idx ON user_news(id DESC)`,
    `CREATE TABLE IF NOT EXISTS user_news_likes(news_id BIGINT NOT NULL REFERENCES user_news(id) ON DELETE CASCADE, email TEXT NOT NULL, PRIMARY KEY(news_id,email))`,
    `CREATE TABLE IF NOT EXISTS avatars(email TEXT PRIMARY KEY, img TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  ];
  const ready = (async () => {
    for (let t = 0; t < 8; t++) {
      try { for (const s of ddl) await q(s); return; }
      catch (e) { if (t === 7) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('news-ext schema:', e.message));
  app.use(['/api/news', '/api/u/news', '/api/ctl/news'], (_req, _res, next) => ready.then(() => next(), next));

  const ping = (extra) => { try { if (app.locals.broadcastStore) app.locals.broadcastStore(Object.assign({ k: 'news' }, extra || {})); } catch (e) {} };

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'سجّل الدخول بحساب حقيقي أولاً');
    const r = await q(`SELECT email, blk, name FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'سجّل الدخول بحساب حقيقي أولاً');
    if (r.rows[0].blk) fail(403, 'الحساب موقوف');
    return { email: String(r.rows[0].email).toLowerCase(), name: r.rows[0].name };
  }

  const SELECT = `SELECT n.id, n.email, n.title, n.descr, (n.img IS NOT NULL) AS has_img, n.likes,
      (EXTRACT(EPOCH FROM n.created_at)*1000)::bigint AS ts,
      a.name, COALESCE(NULLIF(a.rcode,''), a.uid) AS rcode,
      (SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(n.email)) AS av`;
  const FROM = ` FROM user_news n LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(n.email)`;

  const shape = (r, mine, admin, me) => ({
    id: Number(r.id), title: r.title, descr: r.descr,
    img: r.has_img ? `/api/news/${r.id}/img` : '',
    likes: Number(r.likes) || 0, liked: !!(mine && mine.has(Number(r.id))),
    ts: Number(r.ts) || 0,
    own: !!(me && String(r.email).toLowerCase() === me),
    pub: { name: r.name || 'مستخدم', code: r.rcode || '', av: r.av ? Number(r.av) : 0 },
    ...(admin ? { email: r.email } : {}),
  });

  /* ---------- المستخدمون ---------- */
  app.get('/api/news/list', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const e = txt(req.query.e, 200).toLowerCase();
    const rows = (await q(`${SELECT}${FROM} ORDER BY n.id DESC LIMIT 60`)).rows;
    let mine = null;
    if (e && rows.length) {
      const l = (await q(`SELECT news_id FROM user_news_likes WHERE email=$1 AND news_id=ANY($2::bigint[])`, [e, rows.map((r) => r.id)])).rows;
      mine = new Set(l.map((x) => Number(x.news_id)));
    }
    res.json({ items: rows.map((r) => shape(r, mine, false, e)) });
  }));

  app.get('/api/news/:id/img', wrap(async (req, res) => {
    const r = (await q(`SELECT img FROM user_news WHERE id=$1`, [Number(req.params.id) || 0])).rows[0];
    const m = r && r.img && /^data:(image\/[a-z]+);base64,(.+)$/s.exec(r.img);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(m[2], 'base64'));
  }));

  app.get('/api/news/:id/avatar', wrap(async (req, res) => {
    const r = (await q(`SELECT v.img FROM user_news n JOIN avatars v ON v.email=LOWER(n.email) WHERE n.id=$1`, [Number(req.params.id) || 0])).rows[0];
    const m = r && r.img && /^data:(image\/[a-z]+);base64,(.+)$/s.exec(r.img);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(m[2], 'base64'));
  }));

  app.post('/api/u/news/publish', pubLim, wrap(async (req, res) => {
    const u = await who(req.body);
    const title = txt(req.body.title, 90), descr = txt(req.body.descr, 1500);
    if (title.length < 3) fail(400, 'اكتب عنواناً للخبر (3 أحرف على الأقل)');
    if (descr.length < 5) fail(400, 'اكتب وصفاً للخبر');
    let img = null;
    if (req.body.img) { if (!isImg(req.body.img)) fail(400, 'الصورة غير صالحة أو كبيرة'); img = req.body.img; }
    const r = await q(`INSERT INTO user_news(email,title,descr,img) VALUES($1,$2,$3,$4) RETURNING id`, [u.email, title, descr, img]);
    ping({ id: Number(r.rows[0].id) });
    res.json({ ok: true, id: Number(r.rows[0].id) });
  }));

  app.post('/api/u/news/like', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    const id = Number(req.body.id) || 0;
    const cl = await pool.connect();
    let liked = false, likes = 0;
    try {
      await cl.query('BEGIN');
      const n = (await cl.query(`SELECT id FROM user_news WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!n) fail(404, 'الخبر غير موجود');
      const del = await cl.query(`DELETE FROM user_news_likes WHERE news_id=$1 AND email=$2`, [id, u.email]);
      if (del.rowCount) liked = false;
      else { await cl.query(`INSERT INTO user_news_likes(news_id,email) VALUES($1,$2)`, [id, u.email]); liked = true; }
      likes = Number((await cl.query(`UPDATE user_news SET likes=(SELECT COUNT(*) FROM user_news_likes WHERE news_id=$1) WHERE id=$1 RETURNING likes`, [id])).rows[0].likes) || 0;
      await cl.query('COMMIT');
    } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e; }
    finally { cl.release(); }
    ping({ id, likes });
    res.json({ ok: true, liked, likes });
  }));

  app.post('/api/u/news/delete', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    const r = await q(`DELETE FROM user_news WHERE id=$1 AND LOWER(email)=$2`, [Number(req.body.id) || 0, u.email]);
    if (!r.rowCount) fail(404, 'الخبر غير موجود');
    ping({ del: Number(req.body.id) });
    res.json({ ok: true });
  }));

  /* ---------- لوحة التحكم ---------- */
  app.get('/api/ctl/news', ...ctl, wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const rows = (await q(`${SELECT}${FROM} ORDER BY n.id DESC LIMIT 300`)).rows;
    res.json({ items: rows.map((r) => shape(r, null, true)) });
  }));

  app.post('/api/ctl/news/delete', ...ctl, wrap(async (req, res) => {
    const id = Number(req.body && req.body.id) || 0;
    const r = await q(`DELETE FROM user_news WHERE id=$1`, [id]);
    if (!r.rowCount) fail(404, 'الخبر غير موجود');
    ping({ del: id });
    res.json({ ok: true });
  }));

  console.log('news-ext: أخبار المستخدمين جاهزة');
};

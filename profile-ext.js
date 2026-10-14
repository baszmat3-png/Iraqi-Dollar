/* المرحلة 2أ — الصورة الشخصية الدائمة (على قاعدة البيانات) تظهر لكل المستخدمين */
const rateLimit = require('express-rate-limit');

const MAX = 300e3; // حجم أقصى لنص الصورة
const okImg = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX;
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

exports.parsers = (app, express) => {
  app.use('/api/u/avatar', express.json({ limit: '500kb' }));
};

exports.routes = (app, { pool, wrap }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  q(`CREATE TABLE IF NOT EXISTS user_avatars(email TEXT PRIMARY KEY, img TEXT NOT NULL, v BIGINT NOT NULL DEFAULT 0)`)
    .catch((e) => console.error('profile-ext migrate', e));
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

  // نفس تعريف المستخدم في المرحلة 1ب: البريد + بصمة كلمة المرور
  async function who(b) {
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    return r.rows[0].email.toLowerCase();
  }

  // رفع/تغيير/حذف الصورة (img فارغة = حذف)
  app.post('/api/u/avatar', lim, wrap(async (req, res) => {
    const e = await who(req.body || {}), img = req.body.img;
    if (!img) { await q(`DELETE FROM user_avatars WHERE email=$1`, [e]); return res.json({ ok: true, v: 0 }); }
    if (!okImg(img)) fail(400, 'صورة غير صالحة أو كبيرة');
    const v = Date.now();
    await q(`INSERT INTO user_avatars(email,img,v) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET img=$2,v=$3`, [e, img, v]);
    res.json({ ok: true, v });
  }));

  // خريطة {بريد: نسخة} لمن لديه صورة (خفيفة، تُسحب كل 5 ثوانٍ)
  app.get('/api/avatars', wrap(async (_req, res) => {
    const r = await q(`SELECT email,v FROM user_avatars`);
    const m = {}; r.rows.forEach((x) => (m[x.email] = Number(x.v)));
    res.set('Cache-Control', 'no-store'); res.json({ map: m });
  }));

  // الصورة نفسها (قابلة للتخزين المؤقت بحسب النسخة v)
  app.get('/api/avatar', wrap(async (req, res) => {
    const e = txt(req.query.e, 200).toLowerCase();
    const r = (await q(`SELECT img FROM user_avatars WHERE email=$1`, [e])).rows[0];
    if (!r) return res.status(404).end();
    const m = /^data:(image\/[a-z+]+);base64,(.*)$/.exec(r.img);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]); res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  }));
};

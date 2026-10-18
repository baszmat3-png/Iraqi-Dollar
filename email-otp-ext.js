/* رمز تحقق البريد عند إنشاء الحساب — يُولَّد ويُتحقق منه في السيرفر فقط */
const crypto = require('crypto');
module.exports = function (app, { pool, wrap, fail, sha, EM, deliver }) {
  const P = 'signup_email', hits = new Map();
  const limit = (ip) => { const n = Date.now(), a = (hits.get(ip) || []).filter((t) => n - t < 6e5); a.push(n); hits.set(ip, a); if (a.length > 12) fail(429, 'محاولات كثيرة، انتظر قليلاً'); };
  const norm = (v) => String(v || '').trim().toLowerCase();

  app.post('/api/otp/email/start', wrap(async (req, res) => {
    limit(req.ip);
    const email = norm(req.body.email);
    if (!EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
    const rec = await pool.query(`SELECT 1 FROM otps WHERE phone=$1 AND purpose=$2 AND created_at > NOW() - INTERVAL '60 seconds'`, [email, P]);
    if (rec.rowCount) fail(429, 'انتظر 60 ثانية قبل إعادة الإرسال');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [email, P]);
    await pool.query(`INSERT INTO otps(purpose,phone,email,code_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '5 minutes')`, [P, email, email, sha(code)]);
    try { await deliver(email, code); }
    catch (e) {
      await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [email, P]);
      console.error('signup email otp failed:', e.message);
      fail(502, /timeout/i.test(e.message) ? 'تعذر الاتصال بخادم البريد، حاول لاحقاً' : 'تعذر إرسال الرمز إلى البريد');
    }
    res.json({ ok: true });
  }));

  app.post('/api/otp/email/check', wrap(async (req, res) => {
    limit(req.ip);
    const email = norm(req.body.email), code = String(req.body.code || '').trim();
    const r = await pool.query(`SELECT * FROM otps WHERE phone=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [email, P]);
    const o = r.rows[0];
    if (!o) fail(400, 'اطلب رمزاً جديداً');
    if (new Date(o.expires_at) < new Date()) fail(400, 'انتهت صلاحية الرمز');
    if (o.attempts >= 5) fail(429, 'محاولات كثيرة، اطلب رمزاً جديداً');
    if (sha(code) !== o.code_hash) { await pool.query(`UPDATE otps SET attempts=attempts+1 WHERE id=$1`, [o.id]); fail(400, 'الرمز غير صحيح'); }
    await pool.query(`DELETE FROM otps WHERE id=$1`, [o.id]);
    res.json({ ok: true });
  }));
};

/* رموز تحقق البريد (إنشاء الحساب + استعادة كلمة المرور) — تُولَّد وتُفحص في السيرفر فقط */
const crypto = require('crypto');
module.exports = function (app, { pool, wrap, fail, sha, EM, deliver, wa, normPhone }) {
  const PURPOSE = { signup: 'signup_email', reset: 'reset_email', verify: 'verify_email' };
  const hits = new Map();
  const limit = (ip) => { const n = Date.now(), a = (hits.get(ip) || []).filter((t) => n - t < 6e5); a.push(n); hits.set(ip, a); if (a.length > 15) fail(429, 'محاولات كثيرة، انتظر قليلاً'); };
  const norm = (v) => String(v || '').trim().toLowerCase();
  const pur = (v) => PURPOSE[String(v || 'signup')] || fail(400, 'طلب غير صحيح');

  async function verify(email, P, code, consume) {
    const o = (await pool.query(`SELECT * FROM otps WHERE phone=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [email, P])).rows[0];
    if (!o) fail(400, 'اطلب رمزاً جديداً');
    if (new Date(o.expires_at) < new Date()) fail(400, 'انتهت صلاحية الرمز');
    const bump = await pool.query(`UPDATE otps SET attempts=attempts+1 WHERE id=$1 AND attempts<5 RETURNING attempts`, [o.id]);   // ذرّي: لا تتجاوز التخمينات المتوازية الحد
    if (!bump.rowCount) fail(429, 'محاولات كثيرة، اطلب رمزاً جديداً');
    if (sha(String(code || '').trim()) !== o.code_hash) fail(400, 'الرمز غير صحيح');
    if (consume) await pool.query(`DELETE FROM otps WHERE id=$1`, [o.id]);
  }

  app.post('/api/otp/email/start', wrap(async (req, res) => {
    limit(req.ip);
    const email = norm(req.body.email), P = pur(req.body.purpose);
    if (!EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
    const acc = (await pool.query(`SELECT 1 FROM sync_accounts WHERE LOWER(email)=$1 AND COALESCE(pass_hash,'')<>''`, [email])).rowCount > 0;
    if (P === PURPOSE.signup && acc) fail(409, 'هذا البريد مسجل مسبقاً، سجّل الدخول');
    if (P === PURPOSE.reset && !acc) return res.json({ ok: true }); // لا نكشف وجود الحساب
    const rec = await pool.query(`SELECT 1 FROM otps WHERE phone=$1 AND purpose=$2 AND created_at > NOW() - INTERVAL '60 seconds'`, [email, P]);
    if (rec.rowCount) fail(429, 'انتظر 60 ثانية قبل إعادة الإرسال');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [email, P]);
    await pool.query(`INSERT INTO otps(purpose,phone,email,code_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '5 minutes')`, [P, email, email, sha(code)]);
    try { await deliver(email, code); }
    catch (e) {
      await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [email, P]);
      console.error('email otp failed:', e.message);
      fail(502, /timeout/i.test(e.message) ? 'تعذر الاتصال بخادم البريد، حاول لاحقاً' : 'تعذر إرسال الرمز إلى البريد');
    }
    res.json({ ok: true });
  }));

  // peek=true: يتحقق دون استهلاك الرمز (لاستعادة كلمة المرور؛ يُستهلك عند تعيين كلمة المرور)
  app.post('/api/otp/email/check', wrap(async (req, res) => {
    limit(req.ip);
    const email = norm(req.body.email), P = pur(req.body.purpose);
    await verify(email, P, req.body.code, !(P === PURPOSE.reset && req.body.peek));
    res.json({ ok: true });
  }));

  /* توثيق رقم الهاتف عبر واتساب (الرمز يُولَّد ويُفحص في السيرفر) */
  const WP = 'phone_wa';
  app.post('/api/otp/wa/start', wrap(async (req, res) => {
    limit(req.ip);
    const phone = normPhone(req.body.phone || '');
    if (!/^\+?\d{8,15}$/.test(phone)) fail(400, 'رقم غير صحيح');
    const rec = await pool.query(`SELECT 1 FROM otps WHERE phone=$1 AND purpose=$2 AND created_at > NOW() - INTERVAL '60 seconds'`, [phone, WP]);
    if (rec.rowCount) fail(429, 'انتظر 60 ثانية قبل إعادة الإرسال');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [phone, WP]);
    await pool.query(`INSERT INTO otps(purpose,phone,code_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '5 minutes')`, [WP, phone, sha(code)]);
    try { await wa(phone, code); }
    catch (e) { await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [phone, WP]); console.error('wa otp failed:', e.message); fail(502, 'تعذر إرسال الرمز عبر واتساب'); }
    res.json({ ok: true });
  }));
  app.post('/api/otp/wa/check', wrap(async (req, res) => {
    limit(req.ip);
    await verify(normPhone(req.body.phone || ''), WP, req.body.code, true);
    res.json({ ok: true });
  }));

  app.post('/api/otp/email/reset', wrap(async (req, res) => {
    limit(req.ip);
    const email = norm(req.body.email), h = String(req.body.h || '');
    if (h.length < 20 || h.length > 200) fail(400, 'كلمة مرور غير صحيحة');
    await verify(email, PURPOSE.reset, req.body.code, true);
    const r = await pool.query(`UPDATE sync_accounts SET pass_hash=$2 WHERE LOWER(email)=$1`, [email, h]);
    if (!r.rowCount) fail(404, 'الحساب غير موجود');
    res.json({ ok: true });
  }));
};

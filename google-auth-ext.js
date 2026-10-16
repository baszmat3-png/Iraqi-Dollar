/* الدخول وإنشاء الحساب عبر Google
 * - GET  /api/auth/google/config : يُرجع Client ID للواجهة (إن كان مضبوطاً)
 * - POST /api/auth/google        : يتحقق من توكن Google ثم يُنشئ الحساب أو يُرجع الحساب الموجود
 * المتطلب الوحيد: متغير البيئة GOOGLE_CLIENT_ID (من Google Cloud Console → OAuth Client ID → Web)
 */
const crypto = require('crypto');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const EM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = (app, { pool, wrap, fail }) => {
  const CLIENT_ID = txt(process.env.GOOGLE_CLIENT_ID, 200);
  // سرّ لاشتقاق "بصمة كلمة المرور" لحسابات Google (لا يوجد لها كلمة مرور فعلية)
  const SECRET = process.env.GOOGLE_AUTH_SECRET || process.env.JWT_SECRET || 'google-auth-fallback';
  const q = (s, p) => pool.query(s, p);

  const gh = (sub) => 'g' + crypto.createHmac('sha256', SECRET).update('google:' + sub).digest('hex');

  async function getJson(url, headers) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  }

  app.get('/api/auth/google/config', (_req, res) => {
    res.json({ ok: true, enabled: !!CLIENT_ID, clientId: CLIENT_ID });
  });

  app.post('/api/auth/google', wrap(async (req, res) => {
    if (!CLIENT_ID) fail(503, 'الدخول عبر Google غير مفعّل بعد (لم يُضبط GOOGLE_CLIENT_ID على السيرفر)');
    const at = txt(req.body && req.body.access_token, 4096);
    if (!at) fail(400, 'لم يصل توكن Google');

    // 1) التحقق أن التوكن صادر لتطبيقنا نحن (وليس لتطبيق آخر)
    const ti = await getJson('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(at));
    if (!ti.ok || !ti.j) fail(401, 'تعذر التحقق من حساب Google، أعد المحاولة');
    const aud = ti.j.aud || ti.j.azp;
    if (aud !== CLIENT_ID) fail(401, 'توكن Google غير صالح لهذا التطبيق');

    // 2) بيانات الحساب (الاسم والبريد والمعرّف الثابت)
    const ui = await getJson('https://openidconnect.googleapis.com/v1/userinfo', { Authorization: 'Bearer ' + at });
    if (!ui.ok) fail(401, 'تعذر قراءة بيانات حساب Google');
    const email = txt(ui.j.email, 200).toLowerCase();
    const sub = txt(ui.j.sub, 100);
    const verified = ui.j.email_verified === true || ui.j.email_verified === 'true';
    if (!sub || !EM.test(email)) fail(400, 'حساب Google لا يحتوي بريداً صالحاً');
    if (!verified) fail(403, 'بريد Google هذا غير مُوثَّق');
    const name = txt(ui.j.name, 120).replace(/\s+/g, ' ') || email.split('@')[0];

    const cols = 'email,name,phone,pass_hash,pts,gems,usd,kyc,vml,blk,created_at';
    let row = (await q(`SELECT ${cols} FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0];
    let isNew = false;

    if (row) {
      if (row.blk) fail(403, 'هذا الحساب محظور، تواصل مع الدعم');
      // حساب قديم بلا بصمة (نادر): نعطيه بصمة Google حتى يعمل الدخول
      if (!row.pass_hash) {
        await q(`UPDATE sync_accounts SET pass_hash=$2 WHERE LOWER(email)=$1 AND pass_hash IS NULL`, [email, gh(sub)]);
        row = (await q(`SELECT ${cols} FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0];
      }
      // البريد موثَّق من Google
      if (!row.vml) await q(`UPDATE sync_accounts SET vml=TRUE, last_seen=NOW() WHERE LOWER(email)=$1`, [email]);
      else await q(`UPDATE sync_accounts SET last_seen=NOW() WHERE LOWER(email)=$1`, [email]);
    } else {
      if (req.body.create === false) fail(404, 'التسجيل الجديد متوقف حالياً');
      isNew = true;
      await q(
        `INSERT INTO sync_accounts(email,name,phone,pass_hash,pts,gems,usd,vml,vph,last_seen)
         VALUES($1,$2,'',$3,0,0,0,TRUE,FALSE,NOW()) ON CONFLICT (email) DO NOTHING`,
        [email, name, gh(sub)]
      );
      row = (await q(`SELECT ${cols} FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0];
    }

    res.json({
      ok: true,
      isNew,
      account: {
        e: row.email, n: row.name || name, p: row.phone || '', h: row.pass_hash,
        b: [Number(row.pts) || 0, Number(row.gems) || 0, Number(row.usd) || 0],
        kyc: !!row.kyc, vml: true, cr: new Date(row.created_at).getTime(),
      },
    });
  }));
};

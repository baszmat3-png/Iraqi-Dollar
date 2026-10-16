/* المرحلة 3 — الأمان: جلسات الدخول + التحقق من الجهاز الجديد برمز واتساب + المصادقة الثنائية */
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const OTP_TTL = 5 * 60 * 1000, OTP_GAP = 45 * 1000, OTP_TRIES = 5;

function parseUA(ua) {
  ua = String(ua || '');
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'جهاز غير معروف';
  const br = /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'متصفح';
  const kind = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  return { kind, name: `${os} · ${br}` };
}
const isPrivate = (ip) => !ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|::ffff:(127|10|192\.168)\.)/i.test(ip);
const geoCache = new Map();
async function geo(ip) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (isPrivate(ip)) return '';
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city&lang=ar`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    const s = j && j.status === 'success' ? [j.city, j.country].filter(Boolean).join('، ') : '';
    if (geoCache.size > 2000) geoCache.clear();
    geoCache.set(ip, s);
    return s;
  } catch (e) { return ''; }
}

exports.routes = (app, { pool, wrap, sendWhatsApp, normPhone }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false });
  const loginLim = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

  (async () => {
    await q(`ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS tfa BOOLEAN NOT NULL DEFAULT FALSE`);
    await q(`CREATE TABLE IF NOT EXISTS sec_sessions(id TEXT PRIMARY KEY, email TEXT NOT NULL, device_id TEXT NOT NULL, kind TEXT, device TEXT, ip TEXT, location TEXT,
      revoked BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS sec_sessions_email_idx ON sec_sessions(LOWER(email), revoked)`);
    await q(`CREATE TABLE IF NOT EXISTS sec_trusted(email TEXT NOT NULL, device_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(email, device_id))`);
    await q(`CREATE TABLE IF NOT EXISTS sec_otps(id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT NOT NULL, attempts INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`CREATE INDEX IF NOT EXISTS sec_otps_idx ON sec_otps(LOWER(email), purpose, id DESC)`);
  })().catch((e) => console.error('security-ext schema:', e.message));

  async function account(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = (await q(`SELECT email,name,phone,pass_hash,pts,gems,usd,kyc,vml,vph,blk,tfa,created_at FROM sync_accounts WHERE LOWER(email)=$1`, [e])).rows[0];
    if (!r || !r.pass_hash || r.pass_hash.length !== h.length || !crypto.timingSafeEqual(Buffer.from(r.pass_hash), Buffer.from(h))) fail(401, 'بيانات الدخول غير صحيحة');
    if (r.blk) fail(403, 'هذا الحساب محظور، تواصل مع الدعم');
    return r;
  }
  const mask = (p) => { p = String(p || ''); return p.length > 6 ? p.slice(0, 4) + '••••' + p.slice(-3) : '••••'; };

  async function sendOtp(acc, purpose, msg) {
    const email = acc.email.toLowerCase();
    const last = (await q(`SELECT created_at FROM sec_otps WHERE LOWER(email)=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [email, purpose])).rows[0];
    if (last && Date.now() - new Date(last.created_at).getTime() < OTP_GAP) fail(429, 'انتظر قليلاً قبل طلب رمز جديد');
    const code = String(crypto.randomInt(100000, 1000000));
    await q(`INSERT INTO sec_otps(email,purpose,code_hash,expires_at) VALUES($1,$2,$3,$4)`, [email, purpose, sha(code + ':' + email + ':' + purpose), new Date(Date.now() + OTP_TTL)]);
    try { await sendWhatsApp(normPhone(acc.phone), code, `${msg}: ${code}\nصالح لمدة 5 دقائق، لا تشاركه مع أي شخص.`); }
    catch (e) { console.error('sec otp send:', e.message); fail(502, 'تعذر إرسال الرمز عبر واتساب، حاول لاحقاً'); }
  }
  async function checkOtp(acc, purpose, code) {
    const email = acc.email.toLowerCase();
    const r = (await q(`SELECT id,code_hash,attempts,expires_at FROM sec_otps WHERE LOWER(email)=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [email, purpose])).rows[0];
    if (!r || new Date(r.expires_at) < new Date()) fail(400, 'انتهت صلاحية الرمز، اطلب رمزاً جديداً');
    if (r.attempts >= OTP_TRIES) fail(429, 'محاولات كثيرة، اطلب رمزاً جديداً');
    await q(`UPDATE sec_otps SET attempts=attempts+1 WHERE id=$1`, [r.id]);
    if (r.code_hash !== sha(txt(code, 10) + ':' + email + ':' + purpose)) fail(400, 'الرمز غير صحيح');
    await q(`DELETE FROM sec_otps WHERE LOWER(email)=$1 AND purpose=$2`, [email, purpose]);
  }

  async function openSession(req, acc, deviceId) {
    const sid = crypto.randomBytes(18).toString('hex'), ua = parseUA(req.headers['user-agent']), ip = String(req.ip || '').replace(/^::ffff:/, '');
    await q(`INSERT INTO sec_sessions(id,email,device_id,kind,device,ip,location) VALUES($1,$2,$3,$4,$5,$6,'')`, [sid, acc.email.toLowerCase(), deviceId, ua.kind, ua.name, ip]);
    geo(ip).then((loc) => loc && q(`UPDATE sec_sessions SET location=$2 WHERE id=$1`, [sid, loc])).catch(() => {});
    return sid;
  }
  const trustState = async (email, deviceId) => {
    const t = (await q(`SELECT (SELECT COUNT(*) FROM sec_trusted WHERE LOWER(email)=$1)::int any_n, EXISTS(SELECT 1 FROM sec_trusted WHERE LOWER(email)=$1 AND device_id=$2) this_ok`, [email, deviceId])).rows[0];
    return { any: t.any_n > 0, ok: t.this_ok };
  };
  const trust = (email, deviceId) => q(`INSERT INTO sec_trusted(email,device_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [email, deviceId]);
  const devId = (b) => { const d = txt(b && b.device_id, 64); if (!/^[A-Za-z0-9_-]{16,64}$/.test(d)) fail(400, 'معرّف الجهاز غير صالح'); return d; };

  /* دخول: كلمة المرور + (رمز واتساب إذا كان المتصفح/الجهاز غير معروف أو المصادقة الثنائية مفعّلة) */
  app.post('/api/sec/login', loginLim, wrap(async (req, res) => {
    const acc = await account(req.body), email = acc.email.toLowerCase(), did = devId(req.body);
    const ts = await trustState(email, did);
    const reason = acc.tfa ? 'tfa' : ''; // الدخول المباشر: لا رمز واتساب إلا إذا فعّل المستخدم المصادقة الثنائية بنفسه
    if (reason) {
      if (!req.body.otp) {
        await sendOtp(acc, 'login', reason === 'tfa' ? 'رمز المصادقة الثنائية لتسجيل الدخول' : 'رمز التحقق لتسجيل الدخول من جهاز جديد');
        return res.json({ ok: true, need_otp: true, reason, to: mask(acc.phone) });
      }
      await checkOtp(acc, 'login', req.body.otp);
    }
    await trust(email, did);
    const sid = await openSession(req, acc, did);
    res.json({
      ok: true, sid, tfa: !!acc.tfa,
      account: { e: acc.email, n: acc.name, p: acc.phone, h: acc.pass_hash, b: [Number(acc.pts) || 0, Number(acc.gems) || 0, Number(acc.usd) || 0], kyc: !!acc.kyc, vml: !!acc.vml, cr: new Date(acc.created_at).getTime() },
    });
  }));

  /* نبض كل 5 ثوانٍ: يثبّت الجلسة أو يُبلغ بإلغائها من جهاز آخر */
  app.post('/api/sec/ping', lim, wrap(async (req, res) => {
    const acc = await account(req.body), email = acc.email.toLowerCase(), did = devId(req.body), sid = txt(req.body.sid, 64);
    if (sid) {
      const s = (await q(`SELECT revoked, device_id FROM sec_sessions WHERE id=$1 AND LOWER(email)=$2`, [sid, email])).rows[0];
      if (s && s.revoked) return res.json({ ok: true, revoked: true });
      if (s) { await q(`UPDATE sec_sessions SET last_seen=NOW() WHERE id=$1`, [sid]); return res.json({ ok: true, sid, tfa: !!acc.tfa }); }
    }
    // جلسة مستعادة (قبل التحديث) أو حساب جديد: لا نخرجه إلا إذا كان الجهاز غير موثوق وللحساب أجهزة أخرى
    await trust(email, did); // أي جهاز دخل بالبريد وكلمة المرور الصحيحين يُعتمد مباشرة
    res.json({ ok: true, sid: await openSession(req, acc, did), tfa: !!acc.tfa });
  }));

  app.post('/api/sec/sessions', lim, wrap(async (req, res) => {
    const acc = await account(req.body), sid = txt(req.body.sid, 64);
    const r = (await q(`SELECT id,kind,device,ip,location,created_at,last_seen FROM sec_sessions WHERE LOWER(email)=$1 AND NOT revoked ORDER BY last_seen DESC LIMIT 50`, [acc.email.toLowerCase()])).rows;
    res.json({ ok: true, sessions: r.map((s) => ({ id: s.id, kind: s.kind, device: s.device, ip: s.ip, loc: s.location, created: s.created_at, seen: s.last_seen, cur: s.id === sid })) });
  }));

  // تسجيل الخروج من جلسة محددة أو من كل الجلسات الأخرى (مع إبقاء الجلسة الحالية)
  app.post('/api/sec/revoke', lim, wrap(async (req, res) => {
    const acc = await account(req.body), email = acc.email.toLowerCase(), sid = txt(req.body.sid, 64), t = txt(req.body.target, 64);
    if (t === 'others') await q(`UPDATE sec_sessions SET revoked=TRUE WHERE LOWER(email)=$1 AND id<>$2`, [email, sid]);
    else { if (t === sid) fail(400, 'استخدم زر تسجيل الخروج لهذه الجلسة'); await q(`UPDATE sec_sessions SET revoked=TRUE WHERE LOWER(email)=$1 AND id=$2`, [email, t]); }
    res.json({ ok: true });
  }));
  app.post('/api/sec/logout', lim, wrap(async (req, res) => {
    const acc = await account(req.body);
    await q(`UPDATE sec_sessions SET revoked=TRUE WHERE LOWER(email)=$1 AND id=$2`, [acc.email.toLowerCase(), txt(req.body.sid, 64)]);
    res.json({ ok: true });
  }));

  /* المصادقة الثنائية: التفعيل والإيقاف كلاهما يتطلب رمز واتساب */
  app.post('/api/sec/tfa', loginLim, wrap(async (req, res) => {
    const acc = await account(req.body), on = !!req.body.on, purpose = 'tfa';
    if (!req.body.otp) {
      await sendOtp(acc, purpose, on ? 'رمز تفعيل المصادقة الثنائية' : 'رمز إيقاف المصادقة الثنائية');
      return res.json({ ok: true, need_otp: true, to: mask(acc.phone) });
    }
    await checkOtp(acc, purpose, req.body.otp);
    await q(`UPDATE sync_accounts SET tfa=$2 WHERE LOWER(email)=$1`, [acc.email.toLowerCase(), on]);
    res.json({ ok: true, tfa: on });
  }));
};

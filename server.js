const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool, migrate } = require('./db');

const smtpUser = process.env.GMAIL || process.env.SMTP_USER;
const smtpPass = process.env.APP_PASS || process.env.SMTP_PASS;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;

const mailTransport = (smtpUser && smtpPass)
  ? nodemailer.createTransport(
      smtpHost
        ? {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 7000,
          }
        : {
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 7000,
          }
    )
  : null;

const {
  JWT_SECRET,
  WA_API_URL = 'https://backendapi.wpsenderx.com/api/messages/send',
  WA_API_KEY,
  CORS_ORIGIN,
  OTP_DEBUG,
  NODE_ENV,
} = process.env;
const PORT = process.env.PORT || 3000;

if (!JWT_SECRET) { console.error('Missing env JWT_SECRET'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Missing env DATABASE_URL'); process.exit(1); }

/* ---------- Game data (source of truth, mirrors index.html) ---------- */
// [name, price(pts), yield per day, type p=points g=gems]
const CT = [
  ['بسيط', 8750, 50, 'p'], ['الاعتيادي', 17500, 100, 'g'], ['برونزي', 18000, 100, 'p'],
  ['الفضي', 86000, 500, 'g'], ['الذهبي', 87500, 500, 'p'], ['الماسي', 172500, 1000, 'p'],
  ['الناري', 777500, 5000, 'p'], ['عشرة آلاف', 1500000, 10000, 'p'], ['تيتانيوم', 14000000, 100000, 'p'],
];
const PR = [
  ['لابتوب ماك بوك برو', 6500000], ['لابتوب ديل XPS 15', 5000000], ['آيفون 15 برو', 4500000],
  ['سامسونج جالاكسي S24', 3800000], ['سيارة تويوتا كامري 2023', 90000000], ['آيباد برو 2023', 5200000],
];
const DAY = 86400;
const YEAR_MS = 365 * 864e5;
const WHEEL = ['3600', 'x', '200', 'x', '500', '100', 'gem', '50'];

/* ---------- Helpers ---------- */
const app = express();
require('./sync-ext')(app, express);
const GAME = require('./game-ext')(app);
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
// الإعدادات المنشورة قد تحتوي صوراً، لذلك حد أكبر لهذا المسار فقط
app.use('/api/ctl/config', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '50kb' }));
if (CORS_ORIGIN) app.use('/api', cors({ origin: CORS_ORIGIN.split(',') }));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (e.http) return res.status(e.http).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});
const fail = (http, message) => { const e = new Error(message); e.http = http; throw e; };

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}

const EM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PH = /^\+\d{9,15}$/;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sign = (u) => jwt.sign({ uid: u.id }, JWT_SECRET, { expiresIn: '30d' });

const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

async function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  let uid;
  try { uid = jwt.verify(h.replace(/^Bearer /, ''), JWT_SECRET).uid; }
  catch { return next(Object.assign(new Error('غير مصرح، سجّل الدخول'), { http: 401 })); }
  try {
    const r = await pool.query(`SELECT email, banned FROM users WHERE id=$1`, [uid]);
    if (!r.rowCount) return next(Object.assign(new Error('غير مصرح، سجّل الدخول'), { http: 401 }));
    if (r.rows[0].banned) return next(Object.assign(new Error('تم إيقاف حسابك'), { http: 403 }));
    req.uid = uid;
    req.isAdmin = ADMINS.includes(r.rows[0].email.toLowerCase());
    next();
  } catch (e) { next(e); }
}
function adminOnly(req, _res, next) {
  if (!req.isAdmin) return next(Object.assign(new Error('صلاحيات المدير مطلوبة'), { http: 403 }));
  next();
}
function normPhone(raw) {
  let s = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  else if (s.startsWith('07')) s = '+964' + s.slice(1);
  else if (s.startsWith('7') && s.length === 10) s = '+964' + s;
  else if (s.startsWith('964')) s = '+' + s;
  else if (!s.startsWith('+') && s.length >= 9) s = '+' + s;
  return s;
}

async function sendWhatsApp(phone, code, customMessage) {
  const norm = normPhone(phone);
  const cleanPhone = norm.replace(/\D/g, '');
  const key = WA_API_KEY || process.env.WPSENDER_API_KEY;
  if (!key) {
    console.error('Missing WA_API_KEY / WPSENDER_API_KEY in environment');
    throw new Error('مفتاح واتساب غير مضبوط في إعدادات الخادم (يرجى إضافة WA_API_KEY في Render)');
  }
  const msg = customMessage || `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة 5 دقائق، لا تشاركه مع أي شخص.`;

  const r = await fetch(WA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify({
      to: cleanPhone,
      recipient: cleanPhone,
      number: cleanPhone,
      phone: cleanPhone,
      message: msg,
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    console.error('WPSender send error:', r.status, errText);
    throw new Error('WhatsApp HTTP ' + r.status);
  }
}

async function createOtp(purpose, rawPhone, email, payload) {
  const phone = normPhone(rawPhone);
  const recent = await pool.query(
    `SELECT 1 FROM otps WHERE (phone=$1 OR phone=$2) AND purpose=$3 AND created_at > NOW() - INTERVAL '60 seconds'`, [phone, rawPhone, purpose]);
  if (recent.rowCount) fail(429, 'انتظر 60 ثانية قبل إعادة الإرسال');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(`DELETE FROM otps WHERE (phone=$1 OR phone=$2) AND purpose=$3`, [phone, rawPhone, purpose]);
  await pool.query(
    `INSERT INTO otps(purpose,phone,email,code_hash,payload,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes')`,
    [purpose, phone, email, sha(code), payload ? JSON.stringify(payload) : null]);
  try { await sendWhatsApp(phone, code); }
  catch (e) { console.error('WhatsApp failed:', e.message); fail(502, 'تعذر إرسال الرمز عبر واتساب'); }
}

async function checkOtp(purpose, rawPhone, code) {
  const phone = normPhone(rawPhone);
  const r = await pool.query(`SELECT * FROM otps WHERE (phone=$1 OR phone=$2) AND purpose=$3 ORDER BY id DESC LIMIT 1`, [phone, rawPhone, purpose]);
  const o = r.rows[0];
  if (!o) fail(400, 'اطلب رمزاً جديداً');
  if (new Date(o.expires_at) < new Date()) fail(400, 'انتهت صلاحية الرمز');
  if (o.attempts >= 5) fail(429, 'محاولات كثيرة، اطلب رمزاً جديداً');
  if (sha(String(code || '')) !== o.code_hash) {
    await pool.query(`UPDATE otps SET attempts=attempts+1 WHERE id=$1`, [o.id]);
    fail(400, 'الرمز غير صحيح');
  }
  await pool.query(`DELETE FROM otps WHERE id=$1`, [o.id]);
  return o;
}

/* ---------- Counter logic ---------- */
async function activeCounters(c, uid) {
  await c.query(`DELETE FROM counters WHERE user_id=$1 AND expires_at <= NOW()`, [uid]);
  return (await c.query(`SELECT * FROM counters WHERE user_id=$1 AND listed_price IS NULL ORDER BY id`, [uid])).rows;
}
const rates = (cs) => ({
  pts: 100 + cs.reduce((t, x) => t + (CT[x.idx][3] === 'p' ? CT[x.idx][2] : 0), 0),
  gems: cs.reduce((t, x) => t + (CT[x.idx][3] === 'g' ? CT[x.idx][2] : 0), 0),
});
async function settle(c, uid) {
  const u = (await c.query(`SELECT * FROM users WHERE id=$1 FOR UPDATE`, [uid])).rows[0];
  if (!u) fail(404, 'المستخدم غير موجود');
  const cs = await activeCounters(c, uid);
  const now = Date.now();
  let { accr, accg, left_sec: left, running, done } = u;
  if (running) {
    const n = Math.max(0, Math.min((now - new Date(u.last_tick).getTime()) / 1000, left));
    const r = rates(cs);
    accr += r.pts * n / DAY;
    accg += r.gems * n / DAY;
    left -= n;
    if (left <= 0) { left = 0; running = false; done = true; }
  }
  await c.query(`UPDATE users SET accr=$2,accg=$3,left_sec=$4,running=$5,done=$6,last_tick=NOW() WHERE id=$1`,
    [uid, accr, accg, Math.floor(left), running, done]);
  return { ...u, accr, accg, left_sec: Math.floor(left), running, done, counters: cs };
}
const lim = (cs) => Math.floor(cs.reduce((t, x) => t + CT[x.idx][1], 0) / 2);
const log = (c, uid, kind, pts = 0, gems = 0, usd = 0, note = null) =>
  c.query(`INSERT INTO ledger(user_id,kind,pts,gems,usd,note) VALUES($1,$2,$3,$4,$5,$6)`, [uid, kind, pts, gems, usd, note]);

const pub = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, kyc: u.kyc, refCode: u.ref_code,
  pts: Number(u.pts), gems: Number(u.gems), usd: Number(u.usd), spent: Number(u.spent),
});
const stateOf = (s) => ({
  ...pub(s),
  counter: {
    running: s.running, done: s.done, left: s.left_sec,
    accr: s.accr, accg: s.accg, rate: rates(s.counters), limit: lim(s.counters),
    owned: s.counters.map((x) => ({ id: x.id, idx: x.idx, expires: x.expires_at })),
  },
});

/* ---------- Dedicated OTP Routes (Fast, Unthrottled by CGNAT IP block) ---------- */
app.post(['/api/otp/send-whatsapp', '/api/auth/send-whatsapp'], wrap(async (req, res) => {
  const phone = normPhone(req.body.to || req.body.phone || '');
  const code = String(req.body.code || '').trim();
  const msg = req.body.message ? String(req.body.message) : undefined;
  if (!code && !msg) fail(400, 'الرمز مطلوب');
  await sendWhatsApp(phone, code, msg);
  res.json({ ok: true });
}));

async function deliverOtpEmail(toEmail, code) {
  const html = `
    <div dir="rtl" style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #1f2e3d;border-radius:12px;background:#0d1821;color:#fff">
      <h2 style="color:#00d2c4;text-align:center;margin-top:0">تطبيق الدولار العراقي</h2>
      <p style="font-size:1.1rem;text-align:center">رمز تأكيد وتوثيق بريدك الإلكتروني هو:</p>
      <div style="font-size:2.4rem;font-weight:bold;letter-spacing:6px;text-align:center;padding:16px;background:#152636;color:#00e5ff;border-radius:8px;margin:20px 0">
        ${code}
      </div>
      <p style="color:#8896a0;text-align:center;font-size:0.9rem">الرمز صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.</p>
    </div>
  `;

  // 1. Resend API (HTTPS port 443 - works on Render Free)
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'الدولار العراقي <onboarding@resend.dev>',
          to: [toEmail],
          subject: `رمز تأكيد البريد الإلكتروني: ${code}`,
          html
        })
      });
      if (r.ok) return { ok: true, provider: 'resend' };
      const d = await r.json().catch(() => ({}));
      console.warn('Resend send failed:', d);
    } catch (e) {
      console.warn('Resend error:', e.message);
    }
  }

  // 2. Brevo API (HTTPS port 443 - works on Render Free)
  if (process.env.BREVO_API_KEY) {
    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'الدولار العراقي', email: smtpUser || 'noreply@iraqidollar.com' },
          to: [{ email: toEmail }],
          subject: `رمز تأكيد البريد الإلكتروني: ${code}`,
          htmlContent: html
        })
      });
      if (r.ok) return { ok: true, provider: 'brevo' };
      const d = await r.json().catch(() => ({}));
      console.warn('Brevo send failed:', d);
    } catch (e) {
      console.warn('Brevo error:', e.message);
    }
  }

  // 3. Email Webhook / Google Apps Script (HTTPS port 443 - works on Render Free)
  if (process.env.EMAIL_WEBHOOK_URL) {
    try {
      const r = await fetch(process.env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: `رمز تأكيد البريد الإلكتروني: ${code}`,
          code,
          html
        })
      });
      if (r.ok) return { ok: true, provider: 'webhook' };
      const d = await r.json().catch(() => ({}));
      console.warn('Email webhook failed:', d);
    } catch (e) {
      console.warn('Email webhook error:', e.message);
    }
  }

  // 4. SMTP Port 587 (STARTTLS)
  if (smtpUser && smtpPass) {
    try {
      const t587 = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 3500,
        greetingTimeout: 3500,
        socketTimeout: 5000,
      });
      await t587.sendMail({
        from: `"الدولار العراقي" <${smtpUser}>`,
        to: toEmail,
        subject: `رمز تأكيد البريد الإلكتروني: ${code}`,
        html
      });
      return { ok: true, provider: 'smtp-587' };
    } catch (e587) {
      console.warn('SMTP 587 failed, attempting 465:', e587.message);
    }

    // 4. SMTP Port 465 (SSL)
    try {
      const t465 = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 3500,
        greetingTimeout: 3500,
        socketTimeout: 5000,
      });
      await t465.sendMail({
        from: `"الدولار العراقي" <${smtpUser}>`,
        to: toEmail,
        subject: `رمز تأكيد البريد الإلكتروني: ${code}`,
        html
      });
      return { ok: true, provider: 'smtp-465' };
    } catch (e465) {
      console.error('SMTP 465 failed:', e465.message);
      throw new Error(e465.message);
    }
  }

  throw new Error('خدمة إرسال البريد غير مفعلة، يرجى ضبط بريد الإرسال أو مفتاح API في Render');
}

app.post('/api/otp/send-email', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!email || !EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
  if (!code) fail(400, 'الرمز مطلوب');

  try {
    const r = await deliverOtpEmail(email, code);
    res.json({
      ok: true,
      emailSent: true,
      provider: r.provider,
      notice: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني (' + email + ') بنجاح ✓'
    });
  } catch (e) {
    console.error('Email delivery error:', e.message);
    const msg = e.message.includes('timeout')
      ? 'تعذر الاتصال بخادم البريد (خطة Render المجانية تحظر منافذ SMTP، استخدم واتساب أو اربط Brevo/Resend API)'
      : ('تعذر إرسال البريد الإلكتروني: ' + e.message);
    res.status(500).json({ ok: false, error: msg, can_fallback_wa: true });
  }
}));

/* ---------- Multi-device Account Sync & Login Routes ---------- */
app.post('/api/sync/account-register', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const phone = normPhone(req.body.phone || '');
  const pass_hash = String(req.body.pass_hash || '');
  const pts = Number(req.body.pts) || 0;
  const gems = Number(req.body.gems) || 0;
  const usd = Number(req.body.usd) || 0;
  if (!email || !EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
  await pool.query(
    `INSERT INTO sync_accounts(email, name, phone, pass_hash, pts, gems, usd, vml, vph, last_seen)
     VALUES($1, $2, $3, $4, 0, 0, 0, FALSE, TRUE, NOW())
     ON CONFLICT (email) DO UPDATE SET
       name=EXCLUDED.name,
       phone=EXCLUDED.phone,
       pass_hash=COALESCE(EXCLUDED.pass_hash, sync_accounts.pass_hash),
       last_seen=NOW()`,
    [email, name, phone, pass_hash]
  );
  res.json({ ok: true });
}));

app.post('/api/sync/account-login', wrap(async (req, res) => {
  const ident = String(req.body.email || req.body.phone || '').trim().toLowerCase();
  const hash = String(req.body.pass_hash || '');
  const password = String(req.body.password || '');
  if (!ident) fail(400, 'أدخل البريد أو رقم الهاتف');

  const cleanPh = normPhone(ident);
  const r = await pool.query(
    `SELECT * FROM sync_accounts WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`,
    [ident, cleanPh]
  );
  let acc = r.rows[0];

  if (!acc) {
    const ru = await pool.query(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`, [ident, cleanPh]);
    const u = ru.rows[0];
    if (u) {
      acc = {
        email: u.email,
        name: u.name,
        phone: u.phone,
        pass_hash: u.pass_hash,
        pts: u.pts,
        gems: u.gems,
        usd: u.usd,
        blk: u.banned,
        kyc: u.kyc > 0,
        vml: true,
        vph: true,
      };
    }
  }

  if (!acc) fail(404, 'لا يوجد حساب بهذا البريد أو الرقم، أنشئ حساباً جديداً');
  if (acc.blk) fail(403, 'هذا الحساب محظور، تواصل مع الدعم');

  let match = false;
  if (hash && acc.pass_hash && hash === acc.pass_hash) {
    match = true;
  } else if (password && acc.pass_hash) {
    if (acc.pass_hash.startsWith('$2')) {
      match = await bcrypt.compare(password, acc.pass_hash);
    } else if (hash && acc.pass_hash === hash) {
      match = true;
    }
  }

  if (!match) fail(401, 'كلمة المرور غير صحيحة');

  res.json({
    ok: true,
    account: {
      e: acc.email,
      n: acc.name,
      p: acc.phone,
      h: acc.pass_hash,
      b: [Number(acc.pts) || 0, Number(acc.gems) || 0, Number(acc.usd) || 0],
      blk: !!acc.blk,
      kyc: acc.kyc ? 2 : 0,
      vml: !!acc.vml,
      vph: !!acc.vph,
    }
  });
}));

app.post('/api/sync/otp-login-request', wrap(async (req, res) => {
  const ident = String(req.body.identifier || req.body.email || req.body.phone || '').trim().toLowerCase();
  if (!ident) fail(400, 'أدخل البريد أو رقم الهاتف المسجل');
  const cleanPh = normPhone(ident);
  const r = await pool.query(
    `SELECT * FROM sync_accounts WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`,
    [ident, cleanPh]
  );
  let acc = r.rows[0];
  if (!acc) {
    const ru = await pool.query(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`, [ident, cleanPh]);
    acc = ru.rows[0];
  }
  if (!acc) fail(404, 'لم يتم العثور على حساب مسجل بهذه البيانات');
  if (acc.blk || acc.banned) fail(403, 'هذا الحساب محظور');

  const code = String(crypto.randomInt(100000, 999999));
  const targetPhone = acc.phone || cleanPh;
  await pool.query(`DELETE FROM otps WHERE (phone=$1 OR email=$2) AND purpose='login'`, [targetPhone, acc.email]);
  await pool.query(
    `INSERT INTO otps(purpose, phone, email, code_hash, expires_at)
     VALUES('login', $1, $2, $3, NOW() + INTERVAL '5 minutes')`,
    [targetPhone, acc.email, sha(code)]
  );

  await sendWhatsApp(targetPhone, code, `رمز تسجيل الدخول الخاص بك هو: ${code}\nصالح لمدة 5 دقائق، لا تشاركه مع أي شخص.`);
  res.json({ ok: true, phone: targetPhone, email: acc.email });
}));

app.post('/api/sync/otp-login-verify', wrap(async (req, res) => {
  const ident = String(req.body.identifier || req.body.email || req.body.phone || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!ident || !code) fail(400, 'بيانات غير مكتملة');

  const cleanPh = normPhone(ident);
  const rOtp = await pool.query(
    `SELECT * FROM otps WHERE (phone=$1 OR phone=$2 OR email=$1) AND purpose='login' AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [ident, cleanPh]
  );
  const otp = rOtp.rows[0];
  if (!otp) fail(400, 'انتهت صلاحية الرمز أو لم يُطلب');
  if (sha(code) !== otp.code_hash) {
    await pool.query(`UPDATE otps SET attempts=attempts+1 WHERE id=$1`, [otp.id]);
    fail(400, 'الرمز غير صحيح');
  }
  await pool.query(`DELETE FROM otps WHERE id=$1`, [otp.id]);

  const r = await pool.query(
    `SELECT * FROM sync_accounts WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`,
    [otp.email || ident, otp.phone || cleanPh]
  );
  let acc = r.rows[0];
  if (!acc) {
    const ru = await pool.query(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR phone=$1 OR phone=$2 LIMIT 1`, [otp.email || ident, otp.phone || cleanPh]);
    acc = ru.rows[0];
  }
  if (!acc) fail(404, 'الحساب غير موجود');

  res.json({
    ok: true,
    account: {
      e: acc.email,
      n: acc.name,
      p: acc.phone,
      h: acc.pass_hash,
      b: [Number(acc.pts) || 0, Number(acc.gems) || 0, Number(acc.usd) || 0],
      blk: !!acc.blk,
      kyc: acc.kyc ? 2 : 0,
      vml: !!acc.vml,
      vph: !!acc.vph,
    }
  });
}));

app.post('/api/sync/verify-email-success', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) fail(400, 'البريد مطلوب');
  await pool.query(`UPDATE sync_accounts SET vml=TRUE, last_seen=NOW() WHERE LOWER(email)=LOWER($1)`, [email]);
  res.json({ ok: true });
}));

/* ---------- Auth (Standard Password) ---------- */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);

app.post('/api/auth/signup/request', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = normPhone(req.body.phone || '');
  const password = String(req.body.password || '');
  if (name.split(' ').filter(Boolean).length < 2) fail(400, 'اكتب الاسم الثنائي أو الثلاثي');
  if (!EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
  if (!PH.test(phone)) fail(400, 'رقم واتساب غير صحيح، اكتبه مع رمز الدولة مثل +964...');
  if (password.length < 6) fail(400, 'كلمة المرور 6 أحرف على الأقل');
  if ((await pool.query(`SELECT 1 FROM users WHERE email=$1`, [email])).rowCount) fail(409, 'هذا البريد مسجل مسبقاً');
  await createOtp('signup', phone, email, { name, email, phone, h: await bcrypt.hash(password, 10) });
  res.json({ ok: true });
}));

app.post('/api/auth/signup/verify', wrap(async (req, res) => {
  const phone = normPhone(req.body.phone || '');
  const o = await checkOtp('signup', phone, req.body.code);
  const p = o.payload;
  const ref = 'U' + crypto.randomBytes(4).toString('hex').toUpperCase();
  let u;
  try {
    u = (await pool.query(
      `INSERT INTO users(email,phone,name,pass_hash,ref_code) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [p.email, p.phone, p.name, p.h, ref])).rows[0];
  } catch (e) { if (e.code === '23505') fail(409, 'هذا البريد مسجل مسبقاً'); throw e; }
  res.json({ token: sign(u), user: pub(u) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = (await pool.query(`SELECT * FROM users WHERE email=$1`, [email])).rows[0];
  const ok = u && await bcrypt.compare(String(req.body.password || ''), u.pass_hash);
  if (!ok) fail(401, 'البريد أو كلمة المرور غير صحيحة');
  if (u.banned) fail(403, 'تم إيقاف حسابك');
  res.json({ token: sign(u), user: { ...pub(u), admin: ADMINS.includes(u.email.toLowerCase()) } });
}));

app.post('/api/auth/password', auth, wrap(async (req, res) => {
  const { current, next } = req.body;
  if (String(next || '').length < 6) fail(400, 'كلمة المرور الجديدة 6 أحرف على الأقل');
  const u = (await pool.query(`SELECT * FROM users WHERE id=$1`, [req.uid])).rows[0];
  if (!await bcrypt.compare(String(current || ''), u.pass_hash)) fail(401, 'كلمة المرور الحالية غير صحيحة');
  await pool.query(`UPDATE users SET pass_hash=$2 WHERE id=$1`, [req.uid, await bcrypt.hash(next, 10)]);
  res.json({ ok: true });
}));

/* ---------- State / profile ---------- */
app.get('/api/me', auth, wrap(async (req, res) => {
  const s = await tx(async (c) => {
    let s = await settle(c, req.uid);
    if (!s.welcome_given) {
      await c.query(`UPDATE users SET welcome_given=TRUE, usd=usd+5 WHERE id=$1`, [req.uid]);
      await log(c, req.uid, 'welcome', 0, 0, 5, 'هدية ترحيبية');
      s = await settle(c, req.uid);
    }
    return s;
  });
  res.json(stateOf(s));
}));

/* ---------- Counter ---------- */
app.post('/api/counter/toggle', auth, wrap(async (req, res) => {
  const s = await tx(async (c) => {
    const s = await settle(c, req.uid);
    if (s.done) fail(400, 'استلم نقاطك أولاً');
    await c.query(`UPDATE users SET running=$2, last_tick=NOW() WHERE id=$1`, [req.uid, !s.running]);
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

app.post('/api/counter/claim', auth, wrap(async (req, res) => {
  const s = await tx(async (c) => {
    const s = await settle(c, req.uid);
    const q = Math.floor(s.accr), g = Math.floor(s.accg);
    if (!s.done || (!q && !g)) fail(400, 'انتظر انتهاء الـ24 ساعة لاستلام نقاطك');
    await c.query(
      `UPDATE users SET pts=pts+$2, gems=gems+$3, accr=accr-$2, accg=accg-$3, left_sec=86400, done=FALSE, last_tick=NOW() WHERE id=$1`,
      [req.uid, q, g]);
    await log(c, req.uid, 'claim', q, g);
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

app.post('/api/counters/buy', auth, wrap(async (req, res) => {
  const idx = Number(req.body.idx);
  if (!CT[idx]) fail(400, 'عداد غير موجود');
  const s = await tx(async (c) => {
    const s = await settle(c, req.uid);
    if (Number(s.pts) < CT[idx][1]) fail(400, `رصيدك غير كافٍ، ينقصك ${CT[idx][1] - Number(s.pts)} نقطة`);
    await c.query(`UPDATE users SET pts=pts-$2 WHERE id=$1`, [req.uid, CT[idx][1]]);
    await c.query(`INSERT INTO counters(user_id,idx,expires_at) VALUES($1,$2,$3)`, [req.uid, idx, new Date(Date.now() + YEAR_MS)]);
    await log(c, req.uid, 'counter_buy', -CT[idx][1], 0, 0, CT[idx][0]);
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

/* ---------- Counter marketplace ---------- */
app.get('/api/market', auth, wrap(async (_req, res) => {
  const r = await pool.query(
    `SELECT c.id,c.idx,c.listed_price AS price,c.expires_at,u.name AS seller FROM counters c JOIN users u ON u.id=c.user_id
     WHERE c.listed_price IS NOT NULL AND c.expires_at > NOW() ORDER BY c.id DESC LIMIT 100`);
  res.json(r.rows.map((x) => ({ ...x, price: Number(x.price), base: CT[x.idx][1] })));
}));

app.post('/api/market/list', auth, wrap(async (req, res) => {
  const id = Number(req.body.id), price = Math.round(Number(req.body.price));
  await tx(async (c) => {
    const k = (await c.query(`SELECT * FROM counters WHERE id=$1 AND user_id=$2 AND expires_at>NOW() FOR UPDATE`, [id, req.uid])).rows[0];
    if (!k) fail(404, 'العداد غير موجود');
    const mx = Math.floor(CT[k.idx][1] * 1.2);
    if (!price || price < 1) fail(400, 'أدخل سعراً صحيحاً');
    if (price > mx) fail(400, `لا يمكن العرض بأكثر من ${mx} نقطة (السعر الأصلي + 20%)`);
    await c.query(`UPDATE counters SET listed_price=$2 WHERE id=$1`, [id, price]);
  });
  res.json({ ok: true });
}));

app.post('/api/market/unlist', auth, wrap(async (req, res) => {
  const r = await pool.query(`UPDATE counters SET listed_price=NULL WHERE id=$1 AND user_id=$2`, [Number(req.body.id), req.uid]);
  if (!r.rowCount) fail(404, 'العرض غير موجود');
  res.json({ ok: true });
}));

app.post('/api/market/buy', auth, wrap(async (req, res) => {
  const s = await tx(async (c) => {
    const k = (await c.query(`SELECT * FROM counters WHERE id=$1 AND listed_price IS NOT NULL AND expires_at>NOW() FOR UPDATE`, [Number(req.body.id)])).rows[0];
    if (!k) fail(404, 'العرض لم يعد متاحاً');
    if (k.user_id === req.uid) fail(400, 'لا يمكنك شراء عدادك');
    const [a, b] = [req.uid, k.user_id].sort((x, y) => x - y);
    await c.query(`SELECT 1 FROM users WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [a, b]);
    await settle(c, k.user_id);
    const s = await settle(c, req.uid);
    const price = Number(k.listed_price);
    if (Number(s.pts) < price) fail(400, `رصيدك غير كافٍ، ينقصك ${price - Number(s.pts)} نقطة`);
    await c.query(`UPDATE users SET pts=pts-$2 WHERE id=$1`, [req.uid, price]);
    await c.query(`UPDATE users SET pts=pts+$2 WHERE id=$1`, [k.user_id, price]);
    await c.query(`UPDATE counters SET user_id=$2, listed_price=NULL WHERE id=$1`, [k.id, req.uid]);
    await log(c, req.uid, 'market_buy', -price, 0, 0, CT[k.idx][0]);
    await log(c, k.user_id, 'market_sell', price, 0, 0, CT[k.idx][0]);
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

/* ---------- Store ---------- */
app.post('/api/store/purchase', auth, wrap(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.map(Number) : [];
  if (!items.length || items.some((i) => !PR[i])) fail(400, 'سلة غير صالحة');
  const total = items.reduce((t, i) => t + PR[i][1], 0);
  const s = await tx(async (c) => {
    const s = await settle(c, req.uid);
    const avail = lim(s.counters) - Number(s.spent);
    if (!s.counters.length) fail(400, 'لا تملك عداداً، اشترِ عداداً أولاً');
    if (total > avail) fail(400, `تجاوزت الحد الأقصى للشراء. المتاح ${Math.max(0, avail)} نقطة`);
    if (Number(s.pts) < total) fail(400, 'رصيد النقاط غير كافٍ');
    await c.query(`UPDATE users SET pts=pts-$2, spent=spent+$2 WHERE id=$1`, [req.uid, total]);
    await log(c, req.uid, 'store', -total, 0, 0, items.map((i) => PR[i][0]).join('، '));
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

/* ---------- Transfers ---------- */
app.post('/api/transfer', auth, wrap(async (req, res) => {
  const type = req.body.type, n = Math.floor(Number(req.body.amount));
  if (!['friend', 'gem', 'usd'].includes(type)) fail(400, 'نوع تحويل غير صحيح');
  if (!n || n < 1) fail(400, 'يرجى إدخال عدد النقاط');
  const s = await tx(async (c) => {
    if (type === 'friend') {
      const refCode = String(req.body.to || '').trim().toUpperCase();
      const t = (await c.query(`SELECT id FROM users WHERE ref_code=$1`, [refCode])).rows[0];
      if (!t) fail(404, 'لا يوجد مستخدم بهذا الرمز');
      if (t.id === req.uid) fail(400, 'لا يمكنك التحويل لنفسك');
      const fee = Math.ceil(n * 0.05);
      const [a, b] = [req.uid, t.id].sort((x, y) => x - y);
      await c.query(`SELECT 1 FROM users WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [a, b]);
      const me = (await c.query(`SELECT pts FROM users WHERE id=$1`, [req.uid])).rows[0];
      if (Number(me.pts) < n + fee) fail(400, 'رصيد النقاط غير كافٍ');
      await c.query(`UPDATE users SET pts=pts-$2 WHERE id=$1`, [req.uid, n + fee]);
      await c.query(`UPDATE users SET pts=pts+$2 WHERE id=$1`, [t.id, n]);
      await log(c, req.uid, 'transfer_out', -(n + fee), 0, 0, 'إلى ' + refCode);
      await log(c, t.id, 'transfer_in', n, 0, 0, 'من مستخدم');
    } else {
      const s = await settle(c, req.uid);
      if (Number(s.pts) < n) fail(400, 'رصيد النقاط غير كافٍ');
      const gems = type === 'gem' ? Math.floor(n / 100) : 0;
      const usd = type === 'usd' ? n / 1000 : 0;
      if (type === 'gem' && !gems) fail(400, 'الحد الأدنى 100 نقطة');
      await c.query(`UPDATE users SET pts=pts-$2, gems=gems+$3, usd=usd+$4 WHERE id=$1`, [req.uid, n, gems, usd]);
      await log(c, req.uid, 'convert_' + type, -n, gems, usd);
    }
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

/* ---------- Withdrawals ---------- */
const MONTHLY = 4, EMERGENCY = 6, MIN_WD = 15;
app.get('/api/withdrawals', auth, wrap(async (req, res) => {
  const r = await pool.query(`SELECT id,amount,method,emergency,status,created_at FROM withdrawals WHERE user_id=$1 ORDER BY id DESC LIMIT 20`, [req.uid]);
  res.json(r.rows.map((x) => ({ ...x, amount: Number(x.amount) })));
}));

app.post('/api/withdraw', auth, wrap(async (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const method = Number(req.body.method);
  const emergency = !!req.body.emergency;
  if (!amount || amount < MIN_WD) fail(400, `الحد الأدنى للسحب ${MIN_WD}$`);
  if (![0, 1, 2].includes(method)) fail(400, 'طريقة سحب غير صحيحة');
  const s = await tx(async (c) => {
    const u = (await c.query(`SELECT usd FROM users WHERE id=$1 FOR UPDATE`, [req.uid])).rows[0];
    if (Number(u.usd) < amount) fail(400, 'رصيدك غير كافٍ');
    const m = (await c.query(
      `SELECT COUNT(*) FILTER (WHERE NOT emergency AND date_trunc('month',created_at)=date_trunc('month',NOW())) AS month_n,
              COUNT(*) FILTER (WHERE emergency AND date_trunc('year',created_at)=date_trunc('year',NOW())) AS em_n
       FROM withdrawals WHERE user_id=$1`, [req.uid])).rows[0];
    const monthN = Number(m.month_n), emN = Number(m.em_n);
    let isEm = false;
    if (monthN >= MONTHLY) {
      if (emN >= EMERGENCY) fail(400, 'استنفدت عمليات السحب الشهرية وعمليات الطوارئ السنوية');
      if (!emergency) fail(409, `استنفدت عمليات السحب الشهرية. يمكنك السحب كحالة طوارئ (المتبقي ${EMERGENCY - emN} من ${EMERGENCY})`);
      isEm = true;
    }
    await c.query(`UPDATE users SET usd=usd-$2 WHERE id=$1`, [req.uid, amount]);
    await c.query(`INSERT INTO withdrawals(user_id,amount,method,emergency) VALUES($1,$2,$3,$4)`, [req.uid, amount, method, isEm]);
    await log(c, req.uid, isEm ? 'withdraw_emergency' : 'withdraw', 0, 0, -amount);
    return settle(c, req.uid);
  });
  res.json(stateOf(s));
}));

/* ---------- Fun ---------- */
app.post('/api/fun/spin', auth, wrap(async (req, res) => {
  const out = await tx(async (c) => {
    const s = await settle(c, req.uid);
    if (Number(s.gems) < 100) fail(400, 'تحتاج 100 جوهرة للتدوير');
    const k = crypto.randomInt(0, 100);
    const slot = k < 3 ? 0 : k < 40 ? 1 : [2, 4, 5, 6, 7][crypto.randomInt(0, 5)];
    const prize = WHEEL[slot];
    const pts = /^\d+$/.test(prize) ? Number(prize) : 0;
    const gems = prize === 'gem' ? 1 : 0;
    await c.query(`UPDATE users SET gems=gems-100+$2, pts=pts+$3 WHERE id=$1`, [req.uid, gems, pts]);
    await log(c, req.uid, 'spin', pts, gems - 100);
    return { slot, pts, gems, state: stateOf(await settle(c, req.uid)) };
  });
  res.json(out);
}));

/* ---------- Admin dashboard API ---------- */
const adm = [auth, adminOnly];

app.get('/api/admin/stats', ...adm, wrap(async (_req, res) => {
  const q = async (sql) => (await pool.query(sql)).rows[0];
  const u = await q(`SELECT COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_today,
      COUNT(*) FILTER (WHERE banned)::int AS banned,
      COALESCE(SUM(pts),0) AS pts, COALESCE(SUM(gems),0) AS gems, COALESCE(SUM(usd),0) AS usd FROM users`);
  const w = await q(`SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending,
      COALESCE(SUM(amount) FILTER (WHERE status='pending'),0) AS pending_usd,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS paid_usd FROM withdrawals`);
  const c = await q(`SELECT COUNT(*)::int AS active FROM counters WHERE expires_at > NOW()`);
  const byType = (await pool.query(`SELECT idx, COUNT(*)::int AS n FROM counters WHERE expires_at > NOW() GROUP BY idx ORDER BY idx`)).rows
    .map((r) => ({ name: CT[r.idx][0], n: r.n }));
  const daily = (await pool.query(
    `SELECT to_char(d::date,'MM-DD') AS day,
       (SELECT COUNT(*)::int FROM users WHERE created_at::date=d::date) AS signups
     FROM generate_series(NOW()-INTERVAL '6 days', NOW(), '1 day') d`)).rows;
  res.json({
    users: u.users, newToday: u.new_today, banned: u.banned,
    pts: Number(u.pts), gems: Number(u.gems), usd: Number(u.usd),
    pendingWithdrawals: w.pending, pendingUsd: Number(w.pending_usd), paidUsd: Number(w.paid_usd),
    activeCounters: c.active, countersByType: byType, signupsDaily: daily,
  });
}));

app.get('/api/admin/users', ...adm, wrap(async (req, res) => {
  const s = `%${String(req.query.q || '').trim()}%`;
  const limit = Math.min(Number(req.query.limit) || 50, 200), offset = Number(req.query.offset) || 0;
  const r = await pool.query(
    `SELECT id,name,email,phone,pts,gems,usd,spent,kyc,banned,ref_code,created_at,
       (SELECT COUNT(*)::int FROM counters c WHERE c.user_id=users.id AND c.expires_at>NOW()) AS counters
     FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR ref_code ILIKE $1
     ORDER BY id DESC LIMIT $2 OFFSET $3`, [s, limit, offset]);
  res.json(r.rows.map((x) => ({ ...x, pts: Number(x.pts), gems: Number(x.gems), usd: Number(x.usd), spent: Number(x.spent) })));
}));

app.post('/api/admin/users/:id/adjust', ...adm, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const pts = Math.trunc(Number(req.body.pts) || 0), gems = Math.trunc(Number(req.body.gems) || 0);
  const usd = Math.round((Number(req.body.usd) || 0) * 100) / 100;
  const note = String(req.body.note || '').slice(0, 200) || 'تعديل من المدير';
  if (!pts && !gems && !usd) fail(400, 'أدخل قيمة للتعديل');
  await tx(async (c) => {
    const u = (await c.query(`SELECT pts,gems,usd FROM users WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!u) fail(404, 'المستخدم غير موجود');
    if (Number(u.pts) + pts < 0 || Number(u.gems) + gems < 0 || Number(u.usd) + usd < 0) fail(400, 'لا يمكن أن يصبح الرصيد سالباً');
    await c.query(`UPDATE users SET pts=pts+$2, gems=gems+$3, usd=usd+$4 WHERE id=$1`, [id, pts, gems, usd]);
    await log(c, id, 'admin_adjust', pts, gems, usd, `${note} (بواسطة المدير #${req.uid})`);
  });
  res.json({ ok: true });
}));

app.post('/api/admin/users/:id/ban', ...adm, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.uid) fail(400, 'لا يمكنك إيقاف حسابك');
  const r = await pool.query(`UPDATE users SET banned=$2 WHERE id=$1`, [id, !!req.body.banned]);
  if (!r.rowCount) fail(404, 'المستخدم غير موجود');
  res.json({ ok: true });
}));

app.post('/api/admin/users/:id/kyc', ...adm, wrap(async (req, res) => {
  const kyc = Number(req.body.kyc);
  if (![0, 1, 2].includes(kyc)) fail(400, 'قيمة غير صحيحة');
  const r = await pool.query(`UPDATE users SET kyc=$2 WHERE id=$1`, [Number(req.params.id), kyc]);
  if (!r.rowCount) fail(404, 'المستخدم غير موجود');
  res.json({ ok: true });
}));

app.get('/api/admin/withdrawals', ...adm, wrap(async (req, res) => {
  const st = ['pending', 'paid', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const r = await pool.query(
    `SELECT w.id,w.amount,w.method,w.emergency,w.status,w.created_at,u.id AS user_id,u.name,u.email,u.phone
     FROM withdrawals w JOIN users u ON u.id=w.user_id
     WHERE ($1::text IS NULL OR w.status=$1) ORDER BY w.id DESC LIMIT 200`, [st]);
  res.json(r.rows.map((x) => ({ ...x, amount: Number(x.amount) })));
}));

app.post('/api/admin/withdrawals/:id', ...adm, wrap(async (req, res) => {
  const action = req.body.action;
  if (!['approve', 'reject'].includes(action)) fail(400, 'إجراء غير صحيح');
  await tx(async (c) => {
    const w = (await c.query(`SELECT * FROM withdrawals WHERE id=$1 FOR UPDATE`, [Number(req.params.id)])).rows[0];
    if (!w) fail(404, 'الطلب غير موجود');
    if (w.status !== 'pending') fail(409, 'تمت معالجة هذا الطلب مسبقاً');
    if (action === 'approve') {
      await c.query(`UPDATE withdrawals SET status='paid' WHERE id=$1`, [w.id]);
    } else {
      await c.query(`UPDATE withdrawals SET status='rejected' WHERE id=$1`, [w.id]);
      await c.query(`UPDATE users SET usd=usd+$2 WHERE id=$1`, [w.user_id, w.amount]);
      await log(c, w.user_id, 'withdraw_refund', 0, 0, Number(w.amount), `رفض طلب السحب #${w.id}`);
    }
  });
  res.json({ ok: true });
}));

app.get('/api/admin/ledger', ...adm, wrap(async (req, res) => {
  const uid = Number(req.query.user_id) || null;
  const r = await pool.query(
    `SELECT l.id,l.kind,l.pts,l.gems,l.usd,l.note,l.created_at,u.name FROM ledger l JOIN users u ON u.id=l.user_id
     WHERE ($1::int IS NULL OR l.user_id=$1) ORDER BY l.id DESC LIMIT 100`, [uid]);
  res.json(r.rows.map((x) => ({ ...x, pts: Number(x.pts), gems: Number(x.gems), usd: Number(x.usd) })));
}));


/* ---------- Central sync: settings + commands + account registry ---------- */
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const keyEq = (a, b) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const ctlFails = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false });
const pubLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false });
// فحص الأوامر كل 5 ثوانٍ من كل جهاز، وشبكات الهاتف في العراق تشارك نفس الـ IP بين كثيرين
const syncLimiter = rateLimit({ windowMs: 60 * 1000, limit: 1500, standardHeaders: true, legacyHeaders: false });
function ctlAuth(req, _res, next) {
  if (!ADMIN_KEY) return next(Object.assign(new Error('ADMIN_KEY غير مضبوط في إعدادات Render'), { http: 503 }));
  if (!keyEq(req.headers['x-admin-key'] || '', ADMIN_KEY)) return next(Object.assign(new Error('مفتاح الإدارة غير صحيح'), { http: 401 }));
  next();
}
const ctl = [ctlFails, ctlAuth];
const SYNC_NUM = (v, max) => { v = Number(v); return Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0; };

app.get('/api/sync', syncLimiter, wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const max = Number((await pool.query('SELECT COALESCE(MAX(id),0) AS m FROM sync_cmds')).rows[0].m);
  const cfg = req.query.nocfg ? null : (await pool.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
  let cmds = [];
  if (req.query.since !== 'init') {
    const since = Math.max(0, parseInt(req.query.since, 10) || 0);
    if (since < max) cmds = (await pool.query('SELECT id, body FROM sync_cmds WHERE id>$1 ORDER BY id LIMIT 200', [since])).rows;
  }
  res.json({ config: cfg ? cfg.val : null, cmds, max });
}));

app.get('/api/sync/account-state', wrap(async (req, res) => {
  const email = String(req.query.email || req.query.ident || '').trim().toLowerCase();
  if (!email) fail(400, 'البريد مطلوب');
  const cleanPh = normPhone(email);
  let r = await pool.query(
    `SELECT email, name, phone, pts, gems, usd, blk, kyc, vml, vph, cl FROM sync_accounts WHERE LOWER(email)=$1 OR phone=$1 OR phone=$2 LIMIT 1`,
    [email, cleanPh]
  );
  let acc = r.rows[0];
  if (!acc) {
    const ru = await pool.query(
      `SELECT email, name, phone, pts, gems, usd, banned AS blk, (kyc > 0) AS kyc, TRUE AS vml, TRUE AS vph FROM users WHERE LOWER(email)=$1 OR phone=$1 OR phone=$2 LIMIT 1`,
      [email, cleanPh]
    );
    acc = ru.rows[0];
  }
  if (!acc) fail(404, 'الحساب غير موجود');
  res.json({
    ok: true,
    account: {
      email: acc.email,
      name: acc.name,
      phone: acc.phone,
      pts: Number(acc.pts) || 0,
      gems: Number(acc.gems) || 0,
      usd: Number(acc.usd) || 0,
      blk: !!acc.blk,
      kyc: !!acc.kyc,
      vml: !!acc.vml,
      vph: acc.vph !== false,
      cl: acc.cl || [],
    }
  });
}));

/* ===== إحالات حقيقية + السجل المالي ===== */
async function refCfg() {
  const r = (await pool.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
  const c = (r && r.val && r.val.cfg) || {};
  const pct = Number(c.ref);
  return {
    pct: Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 3,
    pr: (Number(c.agRate) > 0 ? Number(c.agRate) : 300) / 1000, // دينار لكل نقطة
  };
}
function finCls(label, dir) {
  const l = String(label || '');
  if (dir === 'out') {
    if (/من السوق/.test(l)) return null;
    if (/^شراء عداد/.test(l)) return ['in', 'counters'];
    if (/^رسوم طلب وكالة/.test(l)) return ['in', 'agency'];
    if (/^(دفعة مقدمة|قسط طلب)/.test(l)) return ['in', 'orders'];
    if (/^تم شراء/.test(l)) return ['in', 'store'];
    return null;
  }
  if (/^استلام عائد العداد/.test(l)) return ['out', 'yields'];
  return null;
}
async function syncRefFin(a, email, RC, out) {
  if (!out) return;
  const rc = String(a.rc || '').trim().slice(0, 20);
  if (rc) await pool.query('UPDATE sync_accounts SET rcode=$2 WHERE LOWER(email)=LOWER($1)', [email, rc]);
  const rb = String(a.rb || '').trim().slice(0, 20);
  if (rb) {
    await pool.query(
      `UPDATE sync_accounts SET ref_by=(SELECT s.email FROM sync_accounts s WHERE s.rcode=$2 AND LOWER(s.email)<>LOWER($1) ORDER BY s.created_at LIMIT 1)
       WHERE LOWER(email)=LOWER($1) AND ref_by IS NULL`, [email, rb]);
  }
  const me = (await pool.query('SELECT email, ref_by FROM sync_accounts WHERE LOWER(email)=LOWER($1)', [email])).rows[0];
  const rfa = [];
  for (const ev of (Array.isArray(a.rfe) ? a.rfe.slice(0, 20) : [])) {
    const id = String(ev && ev.id || '').slice(0, 60), base = Math.floor(SYNC_NUM(ev && ev.b, 1e12));
    if (!id || !base || !me || !me.ref_by) continue; // لا يُؤكَّد الحدث قبل معرفة الداعي
    const uid = email + ':' + id;
    const ins = await pool.query(
      `INSERT INTO sync_ref_ev(uid,invitee,inviter,base,pts) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING pts`,
      [uid, email, me.ref_by, base, Math.floor(base * RC.pct / 100)]);
    if (ins.rows.length) {
      const pts = Number(ins.rows[0].pts) || 0;
      if (pts > 0) {
        await pool.query('UPDATE sync_accounts SET rf_total=rf_total+$2 WHERE LOWER(email)=LOWER($1)', [me.ref_by, pts]);
        await pool.query(
          `INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,'out','ref',$3,$4,$5,'auto') ON CONFLICT DO NOTHING`,
          ['r:' + uid, me.ref_by, pts, Math.round(pts * RC.pr * 100) / 100, 'عمولة إحالة من ' + email]);
      }
    }
    rfa.push(id);
  }
  const fea = [];
  for (const ev of (Array.isArray(a.fe) ? a.fe.slice(0, 40) : [])) {
    const u = String(ev && ev.u || '').slice(0, 40), amt = Math.floor(SYNC_NUM(ev && ev.a, 1e12));
    if (!u) continue;
    const c = amt > 0 ? finCls(ev.l, ev.d === 'in' ? 'in' : 'out') : null;
    if (c) {
      await pool.query(
        `INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,$3,$4,$5,$6,$7,'auto') ON CONFLICT DO NOTHING`,
        ['u:' + email + ':' + u, email, c[0], c[1], amt, Math.round(amt * RC.pr * 100) / 100, String(ev.l || '').slice(0, 80)]);
    }
    fea.push(u);
  }
  const tot = (await pool.query('SELECT rf_total FROM sync_accounts WHERE LOWER(email)=LOWER($1)', [email])).rows[0];
  out.rft = tot ? Number(tot.rf_total) || 0 : 0;
  out.rfa = rfa;
  out.fea = fea;
  const fr = (await pool.query(
    `SELECT s.name, s.email,
            COALESCE((SELECT SUM(base) FROM sync_ref_ev e WHERE e.invitee=s.email),0)::float8 AS base,
            COALESCE((SELECT SUM(pts) FROM sync_ref_ev e WHERE e.invitee=s.email),0)::float8 AS pts
       FROM sync_accounts s WHERE LOWER(s.ref_by)=LOWER($1) ORDER BY s.created_at DESC LIMIT 200`, [email])).rows;
  out.fr = fr.map((r) => [r.name || String(r.email).split('@')[0], r.base > 0 ? 1 : 0, Math.floor(r.pts)]);
}

app.post('/api/sync/report', pubLimiter, wrap(async (req, res) => {
  const list = Array.isArray(req.body.accounts) ? req.body.accounts.slice(0, 20) : [];
  const returnedAccounts = [];
  const RC = await refCfg();
  for (const a of list) {
    const email = String(a.e || '').trim().toLowerCase().slice(0, 120);
    if (!email || /\s/.test(email) || a.demo || email === 'demo@test.com') continue;
    const passHash = a.h ? String(a.h).slice(0, 200) : null;
    const vml = !!(a.vml ?? a.mv);
    const pn = SYNC_NUM(a.pts, 1e12), gn = SYNC_NUM(a.gems, 1e12), un = SYNC_NUM(a.usd, 1e12), isDemo = !!a.demo, isKyc = !!a.kyc;
    const vph = a.vph !== false;
    const cur = await pool.query('SELECT * FROM sync_accounts WHERE LOWER(email)=LOWER($1)', [email]);
    if (cur.rows.length) {
      await pool.query(
        `UPDATE sync_accounts SET
          name=COALESCE($2, name),
          phone=COALESCE($3, phone),
          pass_hash=COALESCE($4, pass_hash),
          vml=CASE WHEN $5 THEN TRUE ELSE vml END,
          vph=CASE WHEN $6 THEN TRUE ELSE vph END,
          pts=$7, gems=$8, usd=$9, demo=$10, kyc=$11,
          last_seen=NOW()
         WHERE LOWER(email)=LOWER($1)`,
        [email, String(a.n || '').slice(0, 80), String(a.p || '').slice(0, 20), passHash, vml, vph, pn, gn, un, isDemo, isKyc]
      );
      const row = (await pool.query('SELECT * FROM sync_accounts WHERE LOWER(email)=LOWER($1)', [email])).rows[0];
      returnedAccounts.push({
        e: row.email,
        pts: Number(row.pts) || 0,
        gems: Number(row.gems) || 0,
        usd: Number(row.usd) || 0,
        blk: !!row.blk,
        kyc: !!row.kyc,
        vml: !!row.vml,
        vph: !!row.vph,
        cl: row.cl || []
      });
    } else {
      await pool.query(
        `INSERT INTO sync_accounts(email,name,phone,demo,pts,gems,usd,blk,kyc,pass_hash,vml,vph,last_seen)
         VALUES($1,$2,$3,$4,$9,$10,$11,FALSE,$5,$6,$7,$8,NOW())`,
        [email, String(a.n || '').slice(0, 80), String(a.p || '').slice(0, 20), isDemo,
         isKyc, passHash, vml, vph, pn, gn, un]
      );
      returnedAccounts.push({
        e: email,
        pts: 0,
        gems: 0,
        usd: 0,
        blk: false,
        kyc: !!a.kyc,
        vml,
        vph,
        cl: []
      });
    }
    await syncRefFin(a, email, RC, returnedAccounts[returnedAccounts.length - 1]);
  }
  res.json({ ok: true, accounts: returnedAccounts });
}));

app.post('/api/ctl/config', ...ctl, wrap(async (req, res) => {
  const c = req.body.config;
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail(400, 'إعدادات غير صالحة');
  await pool.query(
    `INSERT INTO sync_kv(key,val,updated_at) VALUES('config',$1,NOW())
     ON CONFLICT (key) DO UPDATE SET val=EXCLUDED.val, updated_at=NOW()`, [JSON.stringify(c)]);
  res.json({ ok: true });
}));

function cleanCmd(b) {
  b = b || {};
  if (!['adj', 'set', 'rz', 'blk', 'cfg'].includes(b.t)) fail(400, 'نوع أمر غير صحيح');
  const out = { t: b.t, sc: ['all', 'real', 'demo'].includes(b.sc) ? b.sc : 'all' };
  const e = b.e ? String(b.e).trim().toLowerCase().slice(0, 120) : '';
  if (e) out.e = e;
  const num = (v) => { v = Number(v); if (!Number.isFinite(v) || Math.abs(v) > 1e10) fail(400, 'قيمة غير صحيحة'); return v; };
  const pick = (src) => { const o = {}; for (const k of ['pts', 'gems', 'usd']) if (src && src[k] != null && src[k] !== '') o[k] = num(src[k]); return o; };
  if (b.t === 'adj') {
    out.d = pick(b.d);
    if (!Object.values(out.d).some(Boolean)) fail(400, 'أدخل قيمة للتعديل');
  } else if (b.t === 'set') {
    out.v = pick(b.v);
    if (!Object.keys(out.v).length) fail(400, 'أدخل قيمة واحدة على الأقل');
    if (Object.values(out.v).some((x) => x < 0)) fail(400, 'الرصيد لا يكون سالباً');
  } else if (b.t === 'rz') {
    out.o = {};
    for (const k of ['p', 'g', 'd', 'c', 'a']) if (b.o && b.o[k]) out.o[k] = 1;
    if (!Object.keys(out.o).length) fail(400, 'اختر ما تريد تصفيره');
    out.sc = 'all'; delete out.e;
  } else if (b.t === 'blk') {
    if (!out.e) fail(400, 'حدد الحساب');
    out.v = b.v ? 1 : 0;
  }
  if (b.by) out.by = String(b.by).slice(0, 20);
  return out;
}

app.post('/api/ctl/cmd', ...ctl, wrap(async (req, res) => {
  const body = cleanCmd(req.body.body || req.body);
  
  if (body.t === 'adj') {
    const d = body.d || {};
    const dPts = Math.floor(d.pts || 0);
    const dGems = Math.floor(d.gems || 0);
    const dUsd = Number(d.usd || 0);
    if (body.e) {
      await pool.query(
        `UPDATE sync_accounts SET pts=GREATEST(0, pts+$2), gems=GREATEST(0, gems+$3), usd=GREATEST(0, usd+$4) WHERE LOWER(email)=LOWER($1)`,
        [body.e, dPts, dGems, dUsd]
      );
      await pool.query(
        `UPDATE users SET pts=GREATEST(0, pts+$2), gems=GREATEST(0, gems+$3), usd=GREATEST(0, usd+$4) WHERE LOWER(email)=LOWER($1)`,
        [body.e, dPts, dGems, dUsd]
      );
    } else {
      const demoFilter = body.sc === 'demo' ? 'WHERE demo=TRUE' : (body.sc === 'real' ? 'WHERE demo=FALSE' : '');
      await pool.query(
        `UPDATE sync_accounts SET pts=GREATEST(0, pts+$1), gems=GREATEST(0, gems+$2), usd=GREATEST(0, usd+$3) ${demoFilter}`,
        [dPts, dGems, dUsd]
      );
      if (body.sc !== 'demo') {
        await pool.query(
          `UPDATE users SET pts=GREATEST(0, pts+$1), gems=GREATEST(0, gems+$2), usd=GREATEST(0, usd+$3)`,
          [dPts, dGems, dUsd]
        );
      }
    }
  } else if (body.t === 'set') {
    const v = body.v || {};
    if (body.e) {
      if (v.pts != null) {
        await pool.query(`UPDATE sync_accounts SET pts=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, Math.floor(v.pts))]);
        await pool.query(`UPDATE users SET pts=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, Math.floor(v.pts))]);
      }
      if (v.gems != null) {
        await pool.query(`UPDATE sync_accounts SET gems=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, Math.floor(v.gems))]);
        await pool.query(`UPDATE users SET gems=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, Math.floor(v.gems))]);
      }
      if (v.usd != null) {
        await pool.query(`UPDATE sync_accounts SET usd=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, v.usd)]);
        await pool.query(`UPDATE users SET usd=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, Math.max(0, v.usd)]);
      }
    } else {
      const demoFilter = body.sc === 'demo' ? 'WHERE demo=TRUE' : (body.sc === 'real' ? 'WHERE demo=FALSE' : '');
      if (v.pts != null) {
        await pool.query(`UPDATE sync_accounts SET pts=$1 ${demoFilter}`, [Math.max(0, Math.floor(v.pts))]);
        if (body.sc !== 'demo') await pool.query(`UPDATE users SET pts=$1`, [Math.max(0, Math.floor(v.pts))]);
      }
      if (v.gems != null) {
        await pool.query(`UPDATE sync_accounts SET gems=$1 ${demoFilter}`, [Math.max(0, Math.floor(v.gems))]);
        if (body.sc !== 'demo') await pool.query(`UPDATE users SET gems=$1`, [Math.max(0, Math.floor(v.gems))]);
      }
      if (v.usd != null) {
        await pool.query(`UPDATE sync_accounts SET usd=$1 ${demoFilter}`, [Math.max(0, v.usd)]);
        if (body.sc !== 'demo') await pool.query(`UPDATE users SET usd=$1`, [Math.max(0, v.usd)]);
      }
    }
  } else if (body.t === 'rz') {
    const o = body.o || {};
    if (o.p) {
      await pool.query(`UPDATE sync_accounts SET pts=0`);
      await pool.query(`UPDATE users SET pts=0`);
    }
    if (o.g) {
      await pool.query(`UPDATE sync_accounts SET gems=0`);
      await pool.query(`UPDATE users SET gems=0`);
    }
    if (o.d) {
      await pool.query(`UPDATE sync_accounts SET usd=0`);
      await pool.query(`UPDATE users SET usd=0`);
    }
    if (o.c) {
      await pool.query(`UPDATE sync_accounts SET cl='[]'::jsonb`);
      await pool.query(`DELETE FROM counters`);
      await pool.query(`UPDATE users SET running=false, done=false, left_sec=86400, accr=0, accg=0`);
    }
  } else if (body.t === 'blk') {
    const isBlk = !!body.v;
    await pool.query(`UPDATE sync_accounts SET blk=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, isBlk]);
    await pool.query(`UPDATE users SET banned=$2 WHERE LOWER(email)=LOWER($1)`, [body.e, isBlk]);
  }

  const r = await pool.query('INSERT INTO sync_cmds(body) VALUES($1) RETURNING id', [JSON.stringify(body)]);
  await pool.query('DELETE FROM sync_cmds WHERE id < (SELECT MAX(id) FROM sync_cmds) - 5000');
  res.json({ ok: true, id: r.rows[0].id });
}));

app.get('/api/ctl/fin', ...ctl, wrap(async (_req, res) => {
  const rows = (await pool.query(
    `SELECT to_char(ts AT TIME ZONE 'Asia/Baghdad','YYYY-MM') AS m, kind, cat,
            SUM(iqd)::float8 AS iqd, SUM(pts)::float8 AS pts, COUNT(*)::int AS n
       FROM fin_ev WHERE ts > NOW() - INTERVAL '25 months' GROUP BY 1,2,3 ORDER BY 1 DESC`)).rows;
  if (GAME) {
    const RC = await refCfg(), gr = Number(GAME.cfg().gemRate) || 100, agg = {};
    const add = (m, kind, cat, p) => {
      if (!(p > 0)) return;
      const k = m + '|' + kind + '|' + cat;
      const o = agg[k] || (agg[k] = { m, kind, cat, iqd: 0, pts: 0, n: 0 });
      o.pts += p; o.iqd += p * RC.pr; o.n++;
    };
    Object.entries(GAME.daily()).forEach(([d, b]) => {
      const m = d.slice(0, 7);
      add(m, 'in', 'game_comm', b.g.comm);
      add(m, 'in', 'wheel_in', b.w.gems * gr);
      add(m, 'out', 'wheel_prizes', b.w.pts + b.w.gout * gr);
    });
    rows.push(...Object.values(agg));
  }
  const manual = (await pool.query(
    `SELECT uid, ts, kind, cat, iqd::float8 AS iqd, note FROM fin_ev WHERE src='manual' ORDER BY ts DESC LIMIT 100`)).rows;
  res.json({ ok: true, rows, manual });
}));

app.post('/api/ctl/fin/add', ...ctl, wrap(async (req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'in' ? 'in' : b.kind === 'out' ? 'out' : '';
  const cat = String(b.cat || '').trim().slice(0, 40);
  const iqd = Number(b.iqd);
  if (!kind || !cat || !Number.isFinite(iqd) || iqd <= 0 || iqd > 1e13) fail(400, 'بيانات القيد غير صحيحة');
  const auto = b.uid ? String(b.uid).slice(0, 60) : '';
  let ts = new Date();
  if (b.date) { const d = new Date(String(b.date) + 'T12:00:00+03:00'); if (!isNaN(d)) ts = d; }
  const uid = auto || 'm:' + crypto.randomBytes(8).toString('hex');
  await pool.query(
    `INSERT INTO fin_ev(uid,ts,kind,cat,iqd,note,src) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
    [uid, ts, kind, cat, Math.round(iqd * 100) / 100, String(b.note || '').slice(0, 200), auto ? 'auto' : 'manual']);
  res.json({ ok: true, uid });
}));

app.post('/api/ctl/fin/del', ...ctl, wrap(async (req, res) => {
  await pool.query(`DELETE FROM fin_ev WHERE uid=$1 AND src='manual'`, [String((req.body || {}).uid || '')]);
  res.json({ ok: true });
}));

app.get('/api/ctl/accounts', ...ctl, wrap(async (_req, res) => {
  const r = await pool.query(
    `SELECT email,name,phone,demo,pts,gems,usd,blk,kyc,vml AS mv,last_seen FROM sync_accounts ORDER BY last_seen DESC LIMIT 500`);
  const t = (await pool.query(
    `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE demo)::int AS demo, COALESCE(SUM(pts),0) AS pts,
            COALESCE(SUM(gems),0) AS gems, COALESCE(SUM(usd),0) AS usd FROM sync_accounts`)).rows[0];
  res.json({
    accounts: r.rows.map((x) => ({ ...x, pts: Number(x.pts), gems: Number(x.gems), usd: Number(x.usd) })),
    totals: { n: t.n, demo: t.demo, pts: Number(t.pts), gems: Number(t.gems), usd: Number(t.usd) },
  });
}));

/* ---------- Health + static frontend ---------- */
app.get('/healthz', wrap(async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }); }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON غير صالح' });
  res.status(err.http || 500).json({ error: err.http ? err.message : 'خطأ داخلي في الخادم' });
});
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, p) => { if (/\.(html|json)$/.test(p)) res.setHeader('Cache-Control', 'no-cache, must-revalidate'); },
}));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

migrate().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log('Listening on', PORT));
}).catch((e) => { console.error('Migration failed', e); process.exit(1); });

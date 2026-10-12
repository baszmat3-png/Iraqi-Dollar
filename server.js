const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, migrate } = require('./db');

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
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
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

function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  try {
    req.uid = jwt.verify(h.replace(/^Bearer /, ''), JWT_SECRET).uid;
    next();
  } catch { next(Object.assign(new Error('غير مصرح، سجّل الدخول'), { http: 401 })); }
}
async function sendWhatsApp(phone, code) {
  if (!WA_API_KEY) {
    if (OTP_DEBUG === 'true' && NODE_ENV !== 'production') { console.log(`[DEBUG OTP] ${phone}: ${code}`); return; }
    throw new Error('WA_API_KEY غير مضبوط');
  }
  const r = await fetch(WA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': WA_API_KEY },
    body: JSON.stringify({
      phone: phone.replace(/\D/g, ''),
      message: `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة 5 دقائق، لا تشاركه مع أي شخص.`,
    }),
  });
  if (!r.ok) throw new Error('WhatsApp HTTP ' + r.status);
}

async function createOtp(purpose, phone, email, payload) {
  const recent = await pool.query(
    `SELECT 1 FROM otps WHERE phone=$1 AND purpose=$2 AND created_at > NOW() - INTERVAL '60 seconds'`, [phone, purpose]);
  if (recent.rowCount) fail(429, 'انتظر 60 ثانية قبل إعادة الإرسال');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(`DELETE FROM otps WHERE phone=$1 AND purpose=$2`, [phone, purpose]);
  await pool.query(
    `INSERT INTO otps(purpose,phone,email,code_hash,payload,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes')`,
    [purpose, phone, email, sha(code), payload ? JSON.stringify(payload) : null]);
  try { await sendWhatsApp(phone, code); }
  catch (e) { console.error('WhatsApp failed:', e.message); fail(502, 'تعذر إرسال الرمز عبر واتساب'); }
}

async function checkOtp(purpose, phone, code) {
  const r = await pool.query(`SELECT * FROM otps WHERE phone=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [phone, purpose]);
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

/* ---------- Auth ---------- */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);

app.post('/api/auth/signup/request', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').replace(/[\s\-()]/g, '');
  const password = String(req.body.password || '');
  if (name.split(' ').length < 3) fail(400, 'اكتب الاسم الثلاثي كاملاً');
  if (!EM.test(email)) fail(400, 'بريد إلكتروني غير صحيح');
  if (!PH.test(phone)) fail(400, 'رقم واتساب غير صحيح، اكتبه مع رمز الدولة');
  if (password.length < 6) fail(400, 'كلمة المرور 6 أحرف على الأقل');
  if ((await pool.query(`SELECT 1 FROM users WHERE email=$1`, [email])).rowCount) fail(409, 'هذا البريد مسجل مسبقاً');
  await createOtp('signup', phone, email, { name, email, phone, h: await bcrypt.hash(password, 10) });
  res.json({ ok: true });
}));

app.post('/api/auth/signup/verify', wrap(async (req, res) => {
  const phone = String(req.body.phone || '').replace(/[\s\-()]/g, '');
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
  res.json({ token: sign(u), user: pub(u) });
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

/* ---------- Health + static frontend ---------- */
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON غير صالح' });
  res.status(err.http || 500).json({ error: err.http ? err.message : 'خطأ داخلي في الخادم' });
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

migrate().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log('Listening on', PORT));
}).catch((e) => { console.error('Migration failed', e); process.exit(1); });

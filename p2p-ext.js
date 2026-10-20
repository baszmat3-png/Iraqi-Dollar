/**
 * p2p-ext.js — نظام شراء النقاط P2P (الإصدار الاحترافي)
 *
 * الفكرة: البائع يعرض نقاطه (تُحجز عند النشر = ضمان Escrow) بسعر لا يقل عن السعر الرسمي
 * ولا يزيد عنه أكثر من 10٪ (قابلة للتعديل). المشتري يدفع للبائع خارج التطبيق، يرفق صورة التحويل،
 * ويضغط «تم الدفع»؛ فيحرّر البائع النقاط بنفسه بعد التأكد (/order/release) دون موافقة الإدارة.
 * الإدارة تتدخل فقط في النزاعات (/order/dispute من المشتري أو /order/flag من البائع).
 *
 * مستخدم (X: e,h = بريد + pass_hash مثل باقي النظام):
 *  POST /api/p2p/home            السوق + حالة المستخدم
 *  POST /api/p2p/seller/me       لوحة البائع (حالته، إعلاناته، طلبات واردة)
 *  POST /api/p2p/seller/apply    طلب الانضمام كبائع (+ طرق الدفع وأرقام الحسابات)
 *  POST /api/p2p/seller/update   تعديل نبذة/طرق الدفع
 *  POST /api/p2p/seller/profile  ملف بائع عام (مستواه، إحصاءات، تقييمات)
 *  POST /api/p2p/ad/save | /ad/act   إنشاء/تعديل/إيقاف/إغلاق إعلان
 *  POST /api/p2p/order/create | get | proof | proofimg | cancel | flag | rate
 *  POST /api/p2p/orders          طلباتي
 *  POST /api/p2p/chat/inbox | msgs | send
 * لوحة التحكم (X-Admin-Key):
 *  GET  /api/ctl/p2p/overview | orders | order/:id | sellers | reviews | ads | settings
 *  POST /api/ctl/p2p/order/decide | seller/decide | review/hide | ad/close | settings
 */
const crypto = require('crypto');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const r2 = (v) => Math.round(v * 100) / 100;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const LEVELS = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', trusted: 'موثوق' };
/* طرق الدفع المتاحة للبائعين: سوبر كي (خدمات كي) · آسيا حوالة · زين كاش · المصارف العراقية
   المفاتيح القديمة (asiacell, qicard, fib, mastercard, cash, other) تبقى للتحقق من بيانات البائعين السابقين فقط ولا تظهر في الاختيار. */
const SEL_MTYPES = {
  superqi: 'سوبر كي (خدمات كي)', asiahawala: 'آسيا حوالة', zaincash: 'زين كاش', bank: 'مصارف عراقية',
};
const MTYPES = Object.assign({}, SEL_MTYPES, {
  asiacell: 'آسياسيل / آسيا حوالة', qicard: 'كي كارد', fib: 'FIB', mastercard: 'ماستر كارد', cash: 'نقداً / يداً بيد', other: 'أخرى',
});
const IQ_BANKS = [
  'مصرف الرافدين', 'مصرف الرشيد', 'المصرف العراقي للتجارة (TBI)', 'مصرف بغداد', 'مصرف الشرق الأوسط العراقي للاستثمار',
  'مصرف الائتمان العراقي', 'مصرف آشور الدولي', 'مصرف الخليج التجاري', 'مصرف الاستثمار العراقي', 'مصرف الموصل للتنمية والاستثمار',
  'مصرف الاتحاد العراقي', 'مصرف الإقليم التجاري', 'مصرف كردستان الدولي الإسلامي', 'مصرف المنصور للاستثمار', 'المصرف الأهلي العراقي',
  'مصرف سومر التجاري', 'مصرف الهدى', 'مصرف دار السلام للاستثمار', 'مصرف جيهان', 'مصرف الطيف الإسلامي', 'مصرف إيلاف الإسلامي',
  'المصرف العراقي الأول (FIB)', 'مصرف التنمية الدولي', 'مصرف العطاء الإسلامي', 'مصرف أخر',
];
const DEFAULTS = {
  enabled: true,
  officialOverride: 0,   // 0 = استخدم السعر الرسمي المنشور في إعدادات التطبيق (agRate)
  maxMarkupPct: 10,      // أقصى زيادة عن السعر الرسمي
  reqCounterIdx: -1,     // ملغى: لا يُشترط أي عداد — الجميع يمكنهم البيع والشراء
  autoApprove: false,    // false = موافقة الإدارة مطلوبة لاعتماد البائع (true = اعتماد فوري)
  minOrderPts: 1000,
  minAdPts: 10000,
  payWindowMin: 30,      // مهلة الدفع قبل إلغاء الطلب تلقائياً
  feePct: 0,             // عمولة المنصة تُخصم من النقاط المستلمة (٪)
  maxOpenOrders: 3,      // أقصى طلبات مفتوحة للمشتري
};

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const J = express.json({ limit: '30kb' });

  /* ---------------- المخطط ---------------- */
  const ddl = [
    `ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS cl_at TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS p2p_settings(k TEXT PRIMARY KEY, v JSONB NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS p2p_sellers(
       email TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', level TEXT NOT NULL DEFAULT 'bronze',
       full_name TEXT, phone TEXT, bio TEXT, methods JSONB NOT NULL DEFAULT '[]'::jsonb,
       waive BOOLEAN NOT NULL DEFAULT FALSE, admin_note TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS p2p_ads(
       id SERIAL PRIMARY KEY, seller_email TEXT NOT NULL, total_pts BIGINT NOT NULL DEFAULT 0, avail_pts BIGINT NOT NULL DEFAULT 0,
       price NUMERIC(12,2) NOT NULL, min_pts BIGINT NOT NULL DEFAULT 1000, max_pts BIGINT NOT NULL DEFAULT 0,
       methods JSONB NOT NULL DEFAULT '[]'::jsonb, terms TEXT, status TEXT NOT NULL DEFAULT 'active',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS p2p_ads_idx ON p2p_ads(status, seller_email)`,
    `CREATE TABLE IF NOT EXISTS p2p_orders(
       id SERIAL PRIMARY KEY, ad_id INT NOT NULL, buyer_email TEXT NOT NULL, seller_email TEXT NOT NULL,
       pts BIGINT NOT NULL, fee BIGINT NOT NULL DEFAULT 0, price NUMERIC(12,2) NOT NULL, total_iqd NUMERIC(16,2) NOT NULL,
       method JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'awaiting_payment',
       expires_at TIMESTAMPTZ NOT NULL, proof_at TIMESTAMPTZ, decided_at TIMESTAMPTZ, admin_note TEXT,
       seller_flag TEXT, seller_flag_note TEXT, rated BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT`,
    `ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS dispute_note TEXT`,
    `ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS disputed_by TEXT`,
    `ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS p2p_orders_b ON p2p_orders(buyer_email, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS p2p_orders_s ON p2p_orders(seller_email, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS p2p_orders_st ON p2p_orders(status)`,
    `CREATE TABLE IF NOT EXISTS p2p_proofs(order_id INT PRIMARY KEY, img TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS p2p_reviews(
       id SERIAL PRIMARY KEY, order_id INT UNIQUE NOT NULL, seller_email TEXT NOT NULL, buyer_email TEXT NOT NULL,
       stars INT NOT NULL, comment TEXT, hidden BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS p2p_reviews_s ON p2p_reviews(seller_email, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS p2p_msgs(
       id BIGSERIAL PRIMARY KEY, room TEXT NOT NULL, f TEXT NOT NULL, t TEXT NOT NULL, body TEXT, img TEXT,
       order_id INT, seen BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS p2p_msgs_room ON p2p_msgs(room, id)`,
    `CREATE INDEX IF NOT EXISTS p2p_msgs_t ON p2p_msgs(t, seen)`,
    `CREATE TABLE IF NOT EXISTS p2p_level_log(id SERIAL PRIMARY KEY, email TEXT NOT NULL, level TEXT, status TEXT, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS uid TEXT`,
  ];
  const ready = (async () => {
    for (let t = 0; t < 10; t++) {
      try { for (const s of ddl) await q(s); return; }
      catch (e) { if (t === 9) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('p2p-ext schema:', e.message));
  app.use(['/api/p2p', '/api/ctl/p2p'], (_req, _res, next) => ready.then(() => next(), next));

  /* ---------------- أدوات ---------------- */
  const hits = new Map();
  const throttle = (key, max, ms) => {
    const n = Date.now(), a = (hits.get(key) || []).filter((t) => n - t < ms);
    if (a.length >= max) fail(429, 'محاولات كثيرة، انتظر قليلاً');
    a.push(n); hits.set(key, a);
  };
  setInterval(() => { const n = Date.now(); for (const [k, a] of hits) if (!a.some((t) => n - t < 120000)) hits.delete(k); }, 300000).unref();

  async function settings() {
    const r = (await q(`SELECT v FROM p2p_settings WHERE k='cfg'`)).rows[0];
    const v = Object.assign({}, DEFAULTS, (r && r.v) || {});
    return {
      enabled: v.enabled !== false, officialOverride: Math.max(0, num(v.officialOverride)),
      maxMarkupPct: Math.max(0, Math.min(100, num(v.maxMarkupPct, 10))), reqCounterIdx: -1, autoApprove: false, // مفروض: موافقة الإدارة دائماً
      minOrderPts: Math.max(1, Math.floor(num(v.minOrderPts, 1000))), minAdPts: Math.max(1, Math.floor(num(v.minAdPts, 10000))),
      payWindowMin: Math.max(5, Math.min(240, Math.floor(num(v.payWindowMin, 30)))), feePct: Math.max(0, Math.min(50, num(v.feePct))),
      maxOpenOrders: Math.max(1, Math.min(20, Math.floor(num(v.maxOpenOrders, 3)))),
    };
  }
  // السعر الرسمي = دينار لكل 1000 نقطة (نفس agRate المنشور في إعدادات التطبيق، الافتراضي 132)
  async function priceRange(cfg) {
    let off = cfg.officialOverride;
    if (!(off > 0)) {
      const r = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
      const c = r && r.val && r.val.cfg;
      off = c && num(c.agRate) > 0 ? num(c.agRate) : 132;
    }
    return { official: off, min: off, max: Math.max(off, Math.floor(off * (1 + cfg.maxMarkupPct / 100) * 100 + 1e-6) / 100) };
  }
  const inRange = (p, pr) => p >= pr.min - 1e-9 && p <= pr.max + 1e-9;

  async function getAcc(c, b, lock) {
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const a = (await c.query(
      `SELECT email,name,phone,pts,blk,demo,uid,kyc,cl,created_at FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2${lock ? ' FOR UPDATE' : ''}`, [e, h])).rows[0];
    if (!a) fail(401, 'غير مسجّل الدخول');
    if (a.blk) fail(403, 'الحساب موقوف');
    if (!a.uid) {
      a.uid = crypto.randomBytes(8).toString('hex');
      await c.query(`UPDATE sync_accounts SET uid=$2 WHERE LOWER(email)=$1 AND (uid IS NULL OR uid='')`, [e, a.uid]);
      const u2 = (await c.query(`SELECT uid FROM sync_accounts WHERE LOWER(email)=$1`, [e])).rows[0];
      if (u2 && u2.uid) a.uid = u2.uid;
    }
    a.email = String(a.email).toLowerCase();
    // العدادات: المرجع قاعدة البيانات (sync_accounts.cl) وتُزامَن عبر /api/sync/report و/api/v1/state.
    // لا نكتب فوقها بما يرسله الجهاز (كان يقصّها إلى 30 ويعيد القديم بعد شحن الإدارة)؛ نقبل قائمة الجهاز فقط إن كانت قائمة السيرفر فارغة (ترحيل قديم).
    if (Array.isArray(b.cl)) {
      const now = Date.now();
      const have = (Array.isArray(a.cl) ? a.cl : []).some((x) => x && Number(x.e) > now);
      if (!have) {
        const cl = b.cl.slice(0, 100).map((x) => ({ i: Math.floor(Number(x && x.i)), e: Math.floor(Number(x && x.e)) }))
          .filter((x) => x.i >= 0 && x.i <= 20 && x.e > now && x.e < now + 400 * 864e5);
        if (cl.length) {
          await c.query(`UPDATE sync_accounts SET cl=$2::jsonb, ncl=$3, cl_at=NOW() WHERE LOWER(email)=$1`, [a.email, JSON.stringify(cl), cl.length]).catch(async () => {
            await c.query(`UPDATE sync_accounts SET cl=$2::jsonb, cl_at=NOW() WHERE LOWER(email)=$1`, [a.email, JSON.stringify(cl)]);
          });
          a.cl = cl;
        }
      }
    }
    return a;
  }
  const hasCounter = (acc, idx) => {
    if (idx < 0) return true;
    const n = Date.now();
    return (Array.isArray(acc.cl) ? acc.cl : []).some((x) => x && Number(x.i) === idx && Number(x.e) > n);
  };
  const notBlkDemo = (a, what) => { if (a.demo) fail(403, 'الحساب التجريبي لا يمكنه ' + what); };

  // حركة رصيد + أمر مزامنة فوري لأجهزة المستخدم (نفس آلية الهدايا)
  async function move(c, cmds, email, delta, r, x) {
    if (!delta) return;
    await c.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [email, delta]);
    await c.query(`UPDATE users SET pts=GREATEST(0, pts+$2) WHERE LOWER(email)=$1`, [email, delta]);
    const body = { t: 'adj', e: email, d: { pts: delta }, gf: { r, x } };
    const id = (await c.query('INSERT INTO sync_cmds(body) VALUES($1) RETURNING id', [JSON.stringify(body)])).rows[0].id;
    cmds.push([id, body]);
  }
  const flush = (cmds) => { if (app.locals.broadcastCmd) cmds.forEach(([id, b]) => { try { app.locals.broadcastCmd(id, b); } catch (_) {} }); };
  async function note(c, email, title, body) {
    try { if (app.locals.notify) app.locals.notify(email, title, body, 'p2p'); } catch (_) {}
  }
  const room = (a, b) => [a, b].sort().join('|');
  async function sys(c, a, b, orderId, body) {
    await c.query(`INSERT INTO p2p_msgs(room,f,t,body,order_id) VALUES($1,'*','*',$2,$3)`, [room(a, b), body, orderId]);
  }
  const suggest = (done, rate, avg) => {
    avg = avg || 0; rate = rate == null ? 0 : rate;
    if (done >= 100 && rate >= 0.98 && avg >= 4.8) return 'trusted';
    if (done >= 50 && rate >= 0.95 && avg >= 4.5) return 'gold';
    if (done >= 15 && rate >= 0.9 && avg >= 4) return 'silver';
    return 'bronze';
  };
  async function statsFor(emails) {
    const out = {};
    emails.forEach((e) => { out[e] = { done: 0, bad: 0, vol: 0, rate: null, avg: null, n: 0, first: null, disputes: 0 }; });
    if (!emails.length) return out;
    const a = (await q(`SELECT seller_email e,
        COUNT(*) FILTER (WHERE status='completed')::int done, COUNT(*) FILTER (WHERE status='rejected')::int bad,
        COUNT(*) FILTER (WHERE seller_flag='dispute')::int disputes,
        COALESCE(SUM(pts) FILTER (WHERE status='completed'),0)::float8 vol, MIN(created_at) FILTER (WHERE status='completed') first
      FROM p2p_orders WHERE seller_email=ANY($1) GROUP BY seller_email`, [emails])).rows;
    const b = (await q(`SELECT seller_email e, AVG(stars)::float8 avg, COUNT(*)::int n FROM p2p_reviews WHERE NOT hidden AND seller_email=ANY($1) GROUP BY seller_email`, [emails])).rows;
    a.forEach((x) => Object.assign(out[x.e], { done: x.done, bad: x.bad, vol: x.vol, first: x.first, disputes: x.disputes, rate: x.done + x.bad ? x.done / (x.done + x.bad) : null }));
    b.forEach((x) => Object.assign(out[x.e], { avg: x.avg, n: x.n }));
    return out;
  }
  const pubStats = (s) => ({ done: s.done, rate: s.rate, avg: s.avg == null ? null : r2(s.avg), n: s.n, vol: s.vol });
  const cleanMethods = (arr) => {
    if (!Array.isArray(arr) || !arr.length) fail(400, 'أضف طريقة دفع واحدة على الأقل');
    if (arr.length > 8) fail(400, 'الحد الأقصى 8 طرق دفع');
    return arr.map((m) => {
      const type = MTYPES[m && m.type] ? m.type : 'other';
      const o = { type, label: txt(m && m.label, 40) || MTYPES[type], holder: txt(m && m.holder, 80), number: txt(m && m.number, 64), bank: txt(m && m.bank, 60) };
      if (type === 'bank') {
        if (!o.bank) fail(400, 'اختر المصرف في طريقة الدفع «مصارف عراقية»');
        o.label = o.bank.slice(0, 40); // يظهر للمشتري اسم المصرف نفسه
      }
      if (type !== 'cash' && o.number.length < 4) fail(400, 'رقم الحساب غير صحيح في: ' + o.label);
      if (type !== 'cash' && !o.holder) fail(400, 'اكتب اسم صاحب الحساب في: ' + o.label);
      return o;
    });
  };
  const pubMethod = (m) => ({ type: m.type, label: m.label });
  const avUrl = (uid) => '/api/soc/avatar/' + uid;

  // تحرير نقاط محجوزة عادت من طلب (رفض/إلغاء/انتهاء): للإعلان أو للبائع إذا أُغلق الإعلان
  async function giveBack(c, cmds, ad, pts) {
    if (ad.status === 'closed') {
      await c.query(`UPDATE p2p_ads SET total_pts=GREATEST(0,total_pts-$2) WHERE id=$1`, [ad.id, pts]);
      await move(c, cmds, ad.seller_email, pts, 'P2P — استرجاع نقاط', 'إعلان #' + ad.id);
    } else await c.query(`UPDATE p2p_ads SET avail_pts=avail_pts+$2 WHERE id=$1`, [ad.id, pts]);
  }
  async function expireDue() {
    const c = await pool.connect(); const cmds = [];
    try {
      await c.query('BEGIN');
      const due = (await c.query(`SELECT * FROM p2p_orders WHERE status='awaiting_payment' AND expires_at<NOW() ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED`)).rows;
      for (const o of due) {
        const ad = (await c.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [o.ad_id])).rows[0];
        await c.query(`UPDATE p2p_orders SET status='expired', decided_at=NOW() WHERE id=$1`, [o.id]);
        if (ad) await giveBack(c, cmds, ad, Number(o.pts));
        await sys(c, o.buyer_email, o.seller_email, o.id, 'انتهت مهلة الدفع وأُلغي الطلب #' + o.id);
        await note(c, o.buyer_email, 'انتهى طلب P2P', 'انتهت مهلة الدفع للطلب #' + o.id);
        await note(c, o.seller_email, 'انتهى طلب P2P', 'انتهت مهلة دفع المشتري للطلب #' + o.id + ' وعادت النقاط لإعلانك.');
      }
      await c.query('COMMIT'); flush(cmds);
    } catch (e) { try { await c.query('ROLLBACK'); } catch (_) {} console.error('p2p expire:', e.message); } finally { c.release(); }
  }
  ready.then(() => { const t = setInterval(expireDue, 60000); t.unref && t.unref(); });

  /* ---------------- عرض الإعلانات ---------------- */
  async function sellerBrief(emails) {
    if (!emails.length) return {};
    const rows = (await q(`SELECT s.email,s.level,s.status,s.waive,s.methods,a.name,a.uid,a.cl,
        (SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) av
      FROM p2p_sellers s JOIN sync_accounts a ON LOWER(a.email)=s.email WHERE s.email=ANY($1)`, [emails]).catch(() => ({ rows: [] }))).rows;
    const st = await statsFor(emails), m = {};
    rows.forEach((r) => { m[r.email] = { uid: r.uid, name: r.name || r.email.split('@')[0], level: r.level, status: r.status, waive: r.waive, methods: Array.isArray(r.methods) ? r.methods : [], cl: r.cl, av: r.av ? Number(r.av) : 0, stats: pubStats(st[r.email]) }; });
    return m;
  }

  /* مزامنة عدادات المستخدم إلى السيرفر (تُستدعى تلقائياً من التطبيق) */
  app.post('/api/p2p/cl', express.json({ limit: '30kb' }), wrap(async (req, res) => {
    const b = req.body || {};
    throttle('cl:' + txt(b.e, 200).toLowerCase(), 40, 60000);
    const cl = await pool.connect();
    try { await getAcc(cl, b, false); res.json({ ok: true }); } finally { cl.release(); }
  }));

  /* لوحة التحكم: كل عدادات المستخدمين المحفوظة على السيرفر */
  const CTN = ['بسيط', 'الاعتيادي', 'برونزي', 'الفضي', 'الذهبي', 'الماسي', 'الناري', 'عشرة آلاف', 'تيتانيوم'];
  const CTD = [50, 100, 100, 500, 500, 1000, 5000, 10000, 100000];
  app.get('/api/ctl/p2p/counters', ...ctl, wrap(async (req, res) => {
    let rows;
    try {
      rows = (await q(`SELECT email,name,phone,uid,pts,cl,cl_at,COALESCE(ncl,0) ncl,last_seen FROM sync_accounts ORDER BY cl_at DESC NULLS LAST, last_seen DESC NULLS LAST LIMIT 5000`)).rows;
    } catch (e) {
      rows = (await q(`SELECT email,name,phone,uid,pts,cl,cl_at,0 ncl,last_seen FROM sync_accounts LIMIT 5000`)).rows;
    }
    const now = Date.now();
    const byType = CTN.map((n, i) => ({ i, name: n, daily: CTD[i], count: 0, users: 0 }));
    let totalActive = 0, usersWith = 0, unsynced = 0, dailyTotal = 0;
    const users = rows.map((r) => {
      const act = (Array.isArray(r.cl) ? r.cl : []).filter((x) => x && Number(x.e) > now)
        .map((x) => ({ i: Number(x.i), name: CTN[Number(x.i)] || ('#' + x.i), daily: CTD[Number(x.i)] || 0, exp: Number(x.e), days: Math.ceil((Number(x.e) - now) / 864e5) }));
      const seen = new Set();
      act.forEach((x) => { if (byType[x.i]) { byType[x.i].count++; if (!seen.has(x.i)) { byType[x.i].users++; seen.add(x.i); } } });
      totalActive += act.length; dailyTotal += act.reduce((t, x) => t + x.daily, 0);
      const un = !act.length && Number(r.ncl) > 0; if (act.length) usersWith++; if (un) unsynced++;
      return { email: r.email, name: r.name, phone: r.phone, uid: r.uid, pts: Number(r.pts) || 0, ncl: Number(r.ncl) || 0, counters: act, unsynced: un, syncedAt: r.cl_at ? new Date(r.cl_at).getTime() : 0 };
    }).filter((u) => u.counters.length || u.unsynced);
    res.json({ ok: true, now, totalActive, usersWith, unsynced, dailyTotal, byType, users });
  }));

  app.post('/api/p2p/home', J, wrap(async (req, res) => {
    const b = req.body || {};
    throttle('home:' + txt(b.e, 100), 60, 60000);
    const me = await getAcc(pool, b);
    const cfg = await settings();
    res.set('Cache-Control', 'no-store');
    if (!cfg.enabled) return res.json({ ok: true, enabled: false });
    expireDue().catch(() => {});
    const pr = await priceRange(cfg);
    const ads = (await q(`SELECT id,seller_email,avail_pts::float8 avail,price::float8 price,min_pts::float8 mn,max_pts::float8 mx,methods,terms,created_at
      FROM p2p_ads WHERE status='active' AND avail_pts>0 AND price BETWEEN $1 AND $2 ORDER BY price ASC, id DESC LIMIT 200`, [pr.min - 1e-6, pr.max + 1e-6])).rows;
    const sb = await sellerBrief([...new Set(ads.map((a) => a.seller_email))]);
    const sel = (await q(`SELECT status,level FROM p2p_sellers WHERE email=$1`, [me.email])).rows[0];
    const open = (await q(`SELECT COUNT(*)::int n FROM p2p_orders WHERE buyer_email=$1 AND status IN ('awaiting_payment','proof_submitted','disputed')`, [me.email])).rows[0].n;
    const unread = (await q(`SELECT COUNT(*)::int n FROM p2p_msgs WHERE t=$1 AND NOT seen`, [me.email])).rows[0].n;
    const out = [];
    for (const a of ads) {
      const s = sb[a.seller_email];
      if (!s || s.status !== 'approved' || a.seller_email === me.email) continue;
      if (!(s.waive || hasCounter({ cl: s.cl }, cfg.reqCounterIdx))) continue;
      const mt = (Array.isArray(a.methods) ? a.methods : []).map((i) => Object.assign({ i }, pubMethod((s.methods || [])[i] || {}))).filter((m) => m.type);
      if (!mt.length) continue;
      out.push({ id: a.id, avail: a.avail, price: a.price, min: Math.max(a.mn, cfg.minOrderPts), max: a.mx > 0 ? Math.min(a.mx, a.avail) : a.avail, methods: mt, terms: a.terms || '',
        seller: { uid: s.uid, name: s.name, level: s.level, av: s.av, stats: s.stats } });
    }
    res.json({ ok: true, enabled: true, now: Date.now(), cfg: { official: pr.official, min: pr.min, max: pr.max, pct: cfg.maxMarkupPct, minOrder: cfg.minOrderPts, minAd: cfg.minAdPts, payMin: cfg.payWindowMin, reqCounter: cfg.reqCounterIdx },
      me: { uid: me.uid, name: me.name, pts: Number(me.pts), seller: sel ? sel.status : null, level: sel ? sel.level : null, openOrders: open, unread, canSell: hasCounter(me, cfg.reqCounterIdx) },
      ads: out, levels: LEVELS, mtypes: SEL_MTYPES, banks: IQ_BANKS });
  }));

  app.post('/api/p2p/seller/profile', J, wrap(async (req, res) => {
    const b = req.body || {}; await getAcc(pool, b);
    const s = (await q(`SELECT s.email,s.level,s.status,s.bio,s.created_at,s.methods,a.name,a.uid,
        (SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) av
      FROM p2p_sellers s JOIN sync_accounts a ON LOWER(a.email)=s.email WHERE a.uid=$1 AND s.status='approved'`, [txt(b.uid, 64)])).rows[0];
    if (!s) fail(404, 'البائع غير متاح');
    const st = await statsFor([s.email]);
    const rev = (await q(`SELECT r.id,r.stars,r.comment,r.created_at,a.name FROM p2p_reviews r LEFT JOIN sync_accounts a ON LOWER(a.email)=r.buyer_email
      WHERE r.seller_email=$1 AND NOT r.hidden ORDER BY r.id DESC LIMIT 30`, [s.email])).rows
      .map((r) => ({ id: r.id, stars: r.stars, comment: r.comment || '', t: new Date(r.created_at).getTime(), name: maskName(r.name) }));
    const dist = (await q(`SELECT stars, COUNT(*)::int n FROM p2p_reviews WHERE seller_email=$1 AND NOT hidden GROUP BY stars`, [s.email])).rows;
    res.json({ ok: true, seller: { uid: s.uid, name: s.name || s.email.split('@')[0], level: s.level, bio: s.bio || '', since: new Date(s.created_at).getTime(), av: s.av ? Number(s.av) : 0,
      methods: (s.methods || []).map(pubMethod), stats: pubStats(st[s.email]) }, reviews: rev, dist });
  }));
  const maskName = (n) => { n = String(n || 'مستخدم'); return n.length <= 2 ? n + '*' : n.slice(0, 2) + '***'; };

  /* ---------------- البائع ---------------- */
  app.post('/api/p2p/seller/apply', express.json({ limit: '30kb' }), wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); notBlkDemo(me, 'التسجيل كبائع');
    throttle('apply:' + me.email, 5, 600000);
    const cfg = await settings();
    if (!cfg.enabled) fail(403, 'النظام متوقف حالياً');
    const ex = (await q(`SELECT status FROM p2p_sellers WHERE email=$1`, [me.email])).rows[0];
    if (ex && ex.status === 'approved') fail(409, 'أنت بائع معتمد بالفعل');
    if (ex && ex.status === 'suspended') fail(403, 'حساب البائع موقوف، تواصل مع الدعم');
    const full = txt(b.full_name, 80), phone = txt(b.phone, 30);
    if (full.length < 5) fail(400, 'اكتب اسمك الثلاثي كما في حساباتك البنكية');
    if (!/^[+0-9 ]{8,20}$/.test(phone)) fail(400, 'رقم الهاتف غير صحيح');
    const methods = cleanMethods(b.methods);
    await q(`INSERT INTO p2p_sellers(email,status,full_name,phone,bio,methods,approved_at) VALUES($1,$6::text,$2,$3,$4,$5,CASE WHEN $6::text='approved' THEN NOW() END)
      ON CONFLICT (email) DO UPDATE SET status=$6::text, full_name=$2, phone=$3, bio=$4, methods=$5, approved_at=CASE WHEN $6::text='approved' THEN NOW() ELSE p2p_sellers.approved_at END`,
      [me.email, full, phone, txt(b.bio, 200), JSON.stringify(methods), cfg.autoApprove ? 'approved' : 'pending']);
    res.json({ ok: true, approved: !!cfg.autoApprove });
  }));

  app.post('/api/p2p/seller/update', express.json({ limit: '30kb' }), wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b);
    const s = (await q(`SELECT status FROM p2p_sellers WHERE email=$1`, [me.email])).rows[0];
    if (!s || s.status !== 'approved') fail(403, 'لست بائعاً معتمداً');
    const methods = cleanMethods(b.methods);
    await q(`UPDATE p2p_sellers SET bio=$2, methods=$3 WHERE email=$1`, [me.email, txt(b.bio, 200), JSON.stringify(methods)]);
    // الإعلانات المرتبطة بطرق محذوفة تُعدَّل لتبقى ضمن النطاق
    res.json({ ok: true });
  }));

  app.post('/api/p2p/seller/me', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); const cfg = await settings();
    const s = (await q(`SELECT status,level,full_name,phone,bio,methods,admin_note,waive FROM p2p_sellers WHERE email=$1`, [me.email])).rows[0] || null;
    const pr = await priceRange(cfg);
    let ads = [], incoming = [], st = null;
    if (s && s.status === 'approved') {
      ads = (await q(`SELECT id,total_pts::float8 total,avail_pts::float8 avail,price::float8 price,min_pts::float8 mn,max_pts::float8 mx,methods,terms,status,created_at
        FROM p2p_ads WHERE seller_email=$1 AND status<>'closed' ORDER BY id DESC`, [me.email])).rows
        .map((a) => ({ id: a.id, total: a.total, avail: a.avail, price: a.price, min: a.mn, max: a.mx, methods: a.methods, terms: a.terms || '', status: a.status, out: !inRange(a.price, pr) }));
      incoming = (await q(`SELECT o.id,o.pts::float8 pts,o.total_iqd::float8 iqd,o.status,o.seller_flag,o.proof_at,o.created_at,o.expires_at,o.method,a.name,a.uid
        FROM p2p_orders o LEFT JOIN sync_accounts a ON LOWER(a.email)=o.buyer_email WHERE o.seller_email=$1 AND o.status IN ('awaiting_payment','proof_submitted','disputed') ORDER BY o.id DESC LIMIT 50`, [me.email])).rows
        .map((o) => ({ id: o.id, pts: o.pts, iqd: o.iqd, status: o.status, flag: o.seller_flag, exp: new Date(o.expires_at).getTime(), buyer: o.name || 'مستخدم', method: pubMethod(o.method || {}) }));
      const x = await statsFor([me.email]); st = Object.assign(pubStats(x[me.email]), { disputes: x[me.email].disputes });
    }
    res.json({ ok: true, cfg: { official: pr.official, min: pr.min, max: pr.max, pct: cfg.maxMarkupPct, minAd: cfg.minAdPts, minOrder: cfg.minOrderPts, reqCounter: cfg.reqCounterIdx },
      canSell: hasCounter(me, cfg.reqCounterIdx) || !!(s && s.waive), pts: Number(me.pts), seller: s, ads, incoming, stats: st, levels: LEVELS, mtypes: SEL_MTYPES, banks: IQ_BANKS });
  }));

  app.post('/api/p2p/ad/save', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect(); const cmds = []; let id;
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b, true); notBlkDemo(me, 'نشر إعلان');
      throttle('adsave:' + me.email, 20, 600000);
      const cfg = await settings(); if (!cfg.enabled) fail(403, 'النظام متوقف حالياً');
      const s = (await cl.query(`SELECT status,methods,waive FROM p2p_sellers WHERE email=$1 FOR UPDATE`, [me.email])).rows[0];
      if (!s || s.status !== 'approved') fail(403, 'يجب أن تكون بائعاً معتمداً');
      const pr = await priceRange(cfg);
      const price = r2(num(b.price));
      if (!(price > 0) || !inRange(price, pr)) fail(400, `السعر يجب أن يكون بين ${pr.min} و ${pr.max} دينار لكل 1000 نقطة (السعر الرسمي ${pr.official} + حد أقصى ${cfg.maxMarkupPct}٪)`);
      const mn = Math.floor(num(b.min, cfg.minOrderPts)), mx = Math.floor(num(b.max, 0));
      if (mn < cfg.minOrderPts) fail(400, 'أقل حد للطلب ' + cfg.minOrderPts + ' نقطة');
      if (mx && mx < mn) fail(400, 'الحد الأعلى أقل من الحد الأدنى');
      const idxs = [...new Set((Array.isArray(b.methods) ? b.methods : []).map((x) => Math.floor(num(x, -1))))].filter((i) => i >= 0 && i < (s.methods || []).length);
      if (!idxs.length) fail(400, 'اختر طريقة دفع واحدة على الأقل');
      const terms = txt(b.terms, 300);
      const add = Math.floor(num(b.pts, 0));
      id = parseInt(b.id, 10) || 0;
      if (id) {
        const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 AND seller_email=$2 FOR UPDATE`, [id, me.email])).rows[0];
        if (!ad || ad.status === 'closed') fail(404, 'الإعلان غير موجود');
        if (add > 0) {
          if (Number(me.pts) < add) fail(402, 'رصيد النقاط غير كافٍ');
          await move(cl, cmds, me.email, -add, 'P2P — حجز نقاط للإعلان', 'إعلان #' + id);
        }
        await cl.query(`UPDATE p2p_ads SET price=$2,min_pts=$3,max_pts=$4,methods=$5,terms=$6,total_pts=total_pts+$7,avail_pts=avail_pts+$7 WHERE id=$1`,
          [id, price, mn, mx, JSON.stringify(idxs), terms, Math.max(0, add)]);
      } else {
        if (add < cfg.minAdPts) fail(400, 'أقل كمية للإعلان ' + cfg.minAdPts + ' نقطة');
        if (Number(me.pts) < add) fail(402, 'رصيد النقاط غير كافٍ');
        const cnt = (await cl.query(`SELECT COUNT(*)::int n FROM p2p_ads WHERE seller_email=$1 AND status<>'closed'`, [me.email])).rows[0].n;
        if (cnt >= 5) fail(400, 'الحد الأقصى 5 إعلانات مفتوحة');
        id = (await cl.query(`INSERT INTO p2p_ads(seller_email,total_pts,avail_pts,price,min_pts,max_pts,methods,terms) VALUES($1,$2,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [me.email, add, price, mn, mx, JSON.stringify(idxs), terms])).rows[0].id;
        await move(cl, cmds, me.email, -add, 'P2P — حجز نقاط للإعلان', 'إعلان #' + id);
      }
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true, id });
  }));

  app.post('/api/p2p/ad/act', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect(); const cmds = []; const act = txt(b.act, 10);
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b, true);
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 AND seller_email=$2 FOR UPDATE`, [parseInt(b.id, 10) || 0, me.email])).rows[0];
      if (!ad || ad.status === 'closed') fail(404, 'الإعلان غير موجود');
      if (act === 'pause') await cl.query(`UPDATE p2p_ads SET status='paused' WHERE id=$1`, [ad.id]);
      else if (act === 'resume') await cl.query(`UPDATE p2p_ads SET status='active' WHERE id=$1`, [ad.id]);
      else if (act === 'close') {
        const back = Number(ad.avail_pts);
        await cl.query(`UPDATE p2p_ads SET status='closed', avail_pts=0, total_pts=total_pts-$2 WHERE id=$1`, [ad.id, back]);
        await move(cl, cmds, me.email, back, 'P2P — إغلاق إعلان', 'استرجاع النقاط غير المباعة · إعلان #' + ad.id);
      } else fail(400, 'إجراء غير معروف');
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true });
  }));

  /* ---------------- الطلبات ---------------- */
  app.post('/api/p2p/order/create', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect(); let oid;
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b, true); notBlkDemo(me, 'شراء نقاط P2P');
      throttle('oc:' + me.email, 8, 600000);
      const cfg = await settings(); if (!cfg.enabled) fail(403, 'النظام متوقف حالياً');
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [parseInt(b.ad, 10) || 0])).rows[0];
      if (!ad || ad.status !== 'active') fail(404, 'الإعلان غير متاح');
      if (ad.seller_email === me.email) fail(400, 'لا يمكنك الشراء من إعلانك');
      const sel = (await cl.query(`SELECT s.*,a.cl FROM p2p_sellers s JOIN sync_accounts a ON LOWER(a.email)=s.email WHERE s.email=$1`, [ad.seller_email])).rows[0];
      if (!sel || sel.status !== 'approved' || !(sel.waive || hasCounter(sel, cfg.reqCounterIdx))) fail(409, 'هذا البائع غير متاح حالياً');
      const pr = await priceRange(cfg);
      const price = Number(ad.price);
      if (!inRange(price, pr)) fail(409, 'سعر الإعلان خارج النطاق الرسمي — الإعلان معلّق مؤقتاً');
      const pts = Math.floor(num(b.pts));
      const mn = Math.max(Number(ad.min_pts), cfg.minOrderPts), mx = Number(ad.max_pts) > 0 ? Number(ad.max_pts) : Number(ad.avail_pts);
      if (pts < mn) fail(400, 'أقل كمية للطلب ' + mn + ' نقطة');
      if (pts > mx) fail(400, 'أكبر كمية للطلب ' + mx + ' نقطة');
      if (pts > Number(ad.avail_pts)) fail(409, 'الكمية المتاحة لدى البائع أقل من المطلوب');
      const open = (await cl.query(`SELECT COUNT(*)::int n FROM p2p_orders WHERE buyer_email=$1 AND status IN ('awaiting_payment','proof_submitted','disputed')`, [me.email])).rows[0].n;
      if (open >= cfg.maxOpenOrders) fail(429, 'لديك ' + open + ' طلبات مفتوحة، أكملها أو ألغِها أولاً');
      const mi = Math.floor(num(b.method, -1));
      const allowed = Array.isArray(ad.methods) ? ad.methods : [];
      if (!allowed.includes(mi) || !(sel.methods || [])[mi]) fail(400, 'اختر طريقة دفع صحيحة');
      const method = sel.methods[mi];
      const iqd = Math.round(pts / 1000 * price);
      const fee = Math.floor(pts * cfg.feePct / 100);
      await cl.query(`UPDATE p2p_ads SET avail_pts=avail_pts-$2 WHERE id=$1`, [ad.id, pts]);
      oid = (await cl.query(`INSERT INTO p2p_orders(ad_id,buyer_email,seller_email,pts,fee,price,total_iqd,method,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+make_interval(mins => $9::int)) RETURNING id`, [ad.id, me.email, ad.seller_email, pts, fee, price, iqd, JSON.stringify(method), cfg.payWindowMin])).rows[0].id;
      await sys(cl, me.email, ad.seller_email, oid, `طلب جديد #${oid}: ${pts.toLocaleString('en')} نقطة مقابل ${iqd.toLocaleString('en')} د.ع — المشتري يدفع عبر ${method.label}`);
      await note(cl, me.email, 'تم إنشاء طلبك #' + oid, `اشتريت ${pts.toLocaleString('en')} نقطة مقابل ${iqd.toLocaleString('en')} د.ع. ادفع عبر ${method.label} وأرفق صورة التحويل خلال ${cfg.payWindowMin} دقيقة.`);
      await note(cl, ad.seller_email, 'طلب شراء P2P جديد', `${me.name || 'مستخدم'} يريد شراء ${pts.toLocaleString('en')} نقطة (${iqd.toLocaleString('en')} د.ع)`);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    res.json({ ok: true, id: oid });
  }));

  async function loadOrder(c, b, me, lock) {
    const o = (await c.query(`SELECT * FROM p2p_orders WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [parseInt(b.id, 10) || 0])).rows[0];
    if (!o || (o.buyer_email !== me.email && o.seller_email !== me.email)) fail(404, 'الطلب غير موجود');
    return o;
  }
  const orderOut = (o, me, extra) => {
    const buyer = o.buyer_email === me.email;
    return Object.assign({ id: o.id, role: buyer ? 'buyer' : 'seller', status: o.status, pts: Number(o.pts), fee: Number(o.fee), price: Number(o.price), iqd: Number(o.total_iqd),
      exp: new Date(o.expires_at).getTime(), created: new Date(o.created_at).getTime(), proofAt: o.proof_at ? new Date(o.proof_at).getTime() : 0,
      note: o.admin_note || '', dReason: o.dispute_reason || '', dNote: o.dispute_note || '', dBy: o.disputed_by || '', flag: o.seller_flag || '', flagNote: o.seller_flag_note || '', rated: o.rated,
      // أرقام الحساب تظهر للمشتري (للدفع) وللبائع (حسابه) فقط وفي الطلب نفسه
      method: o.method }, extra || {});
  };

  app.post('/api/p2p/order/get', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b);
    const o = await loadOrder(pool, b, me);
    const other = (await q(`SELECT name,uid,(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) av FROM sync_accounts a WHERE LOWER(email)=$1`,
      [o.buyer_email === me.email ? o.seller_email : o.buyer_email])).rows[0] || {};
    const sel = o.buyer_email === me.email ? (await q(`SELECT level FROM p2p_sellers WHERE email=$1`, [o.seller_email])).rows[0] : null;
    res.json({ ok: true, now: Date.now(), order: orderOut(o, me, { hasProof: !!(await q(`SELECT 1 FROM p2p_proofs WHERE order_id=$1`, [o.id])).rows[0] }),
      other: { name: other.name || 'مستخدم', uid: other.uid, av: other.av ? Number(other.av) : 0, level: sel ? sel.level : null } });
  }));

  app.post('/api/p2p/order/proofimg', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); const o = await loadOrder(pool, b, me);
    const p = (await q(`SELECT img FROM p2p_proofs WHERE order_id=$1`, [o.id])).rows[0];
    res.json({ ok: true, img: p ? p.img : null });
  }));

  app.post('/api/p2p/order/proof', express.json({ limit: '3mb' }), wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b); throttle('pf:' + me.email, 10, 600000);
      const o = await loadOrder(cl, b, me, true);
      if (o.buyer_email !== me.email) fail(403, 'فقط المشتري يرفق إثبات الدفع');
      if (!['awaiting_payment', 'proof_submitted'].includes(o.status)) fail(409, 'لا يمكن إرفاق إثبات لهذا الطلب الآن');
      if (o.status === 'awaiting_payment' && new Date(o.expires_at).getTime() < Date.now()) fail(409, 'انتهت مهلة الدفع');
      const img = String(b.img || '');
      if (!IMG_RE.test(img) || img.length > 2.6e6) fail(400, 'صورة التحويل غير صالحة (JPG/PNG حتى 2MB)');
      await cl.query(`INSERT INTO p2p_proofs(order_id,img) VALUES($1,$2) ON CONFLICT (order_id) DO UPDATE SET img=$2, created_at=NOW()`, [o.id, img]);
      await cl.query(`UPDATE p2p_orders SET status='proof_submitted', proof_at=NOW(), seller_flag=NULL WHERE id=$1`, [o.id]);
      await sys(cl, o.buyer_email, o.seller_email, o.id, `✅ تم تأكيد الدفع للطلب #${o.id} — بانتظار تحرير البائع`);
      await note(cl, o.seller_email, 'تم رفع إثبات الدفع', `المشتري أكّد الدفع وأرفق صورة التحويل للطلب #${o.id}. تحقق من وصول المبلغ ثم حرّر النقاط للمشتري.`);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    res.json({ ok: true });
  }));

  app.post('/api/p2p/order/cancel', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect(); const cmds = [];
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b); const o = await loadOrder(cl, b, me, true);
      if (o.buyer_email !== me.email) fail(403, 'فقط المشتري يلغي الطلب');
      if (o.status !== 'awaiting_payment') fail(409, 'لا يمكن إلغاء الطلب بعد رفع إثبات الدفع');
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [o.ad_id])).rows[0];
      await cl.query(`UPDATE p2p_orders SET status='cancelled', decided_at=NOW() WHERE id=$1`, [o.id]);
      if (ad) await giveBack(cl, cmds, ad, Number(o.pts));
      await sys(cl, o.buyer_email, o.seller_email, o.id, `أُلغي الطلب #${o.id} من قبل المشتري`);
      await note(cl, o.seller_email, 'أُلغي طلب P2P', `ألغى المشتري الطلب #${o.id} وعادت النقاط المحجوزة لإعلانك.`);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true });
  }));

  // البائع: «استلمت المبلغ» أو «لم يصل المبلغ» — إشارة للإدارة فقط (القرار النهائي للإدارة)
  // البائع: «لم يصل المبلغ» → نزاع تراجعه الإدارة (التحرير يتم عبر /order/release)
  app.post('/api/p2p/order/flag', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); const o = await loadOrder(pool, b, me);
    if (o.seller_email !== me.email) fail(403, 'فقط البائع');
    if (o.status !== 'proof_submitted') fail(409, 'لا يمكن تعديل حالة هذا الطلب');
    if (b.flag !== 'dispute') fail(400, 'اختيار غير صحيح');
    const nt = txt(b.note, 200); if (nt.length < 5) fail(400, 'اكتب سبب الاعتراض');
    await q(`UPDATE p2p_orders SET seller_flag='dispute', seller_flag_note=$2, status='disputed', dispute_reason='seller_not_received', dispute_note=$2, disputed_by='seller', disputed_at=NOW() WHERE id=$1 AND status='proof_submitted'`, [o.id, nt]);
    await q(`INSERT INTO p2p_msgs(room,f,t,body,order_id) VALUES($1,'*','*',$2,$3)`, [room(o.buyer_email, o.seller_email), `⚠️ البائع أبلغ أن المبلغ لم يصل للطلب #${o.id}: ${nt} — الطلب عند الإدارة`, o.id]);
    await note(pool, o.buyer_email, 'نزاع على طلبك #' + o.id, 'أبلغ البائع أن المبلغ لم يصله. الإدارة ستراجع صورة التحويل وتقرر.');
    res.json({ ok: true });
  }));

  app.post('/api/p2p/order/rate', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b); const o = await loadOrder(cl, b, me, true);
      if (o.buyer_email !== me.email) fail(403, 'فقط المشتري يقيّم البائع');
      if (o.status !== 'completed') fail(409, 'يمكن التقييم بعد اكتمال الطلب');
      if (o.rated) fail(409, 'قيّمت هذا الطلب مسبقاً');
      const stars = Math.floor(num(b.stars)); if (stars < 1 || stars > 5) fail(400, 'التقييم من 1 إلى 5');
      await cl.query(`INSERT INTO p2p_reviews(order_id,seller_email,buyer_email,stars,comment) VALUES($1,$2,$3,$4,$5)`, [o.id, o.seller_email, me.email, stars, txt(b.comment, 300)]);
      await cl.query(`UPDATE p2p_orders SET rated=TRUE WHERE id=$1`, [o.id]);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    res.json({ ok: true });
  }));

  app.post('/api/p2p/orders', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b);
    const rows = (await q(`SELECT o.id,o.status,o.pts::float8 pts,o.total_iqd::float8 iqd,o.expires_at,o.created_at,o.rated,o.seller_flag,o.buyer_email,o.seller_email,a.name
      FROM p2p_orders o LEFT JOIN sync_accounts a ON LOWER(a.email)=(CASE WHEN o.buyer_email=$1 THEN o.seller_email ELSE o.buyer_email END)
      WHERE o.buyer_email=$1 OR o.seller_email=$1 ORDER BY o.id DESC LIMIT 60`, [me.email])).rows;
    res.json({ ok: true, now: Date.now(), orders: rows.map((o) => ({ id: o.id, role: o.buyer_email === me.email ? 'buyer' : 'seller', status: o.status, pts: o.pts, iqd: o.iqd,
      exp: new Date(o.expires_at).getTime(), t: new Date(o.created_at).getTime(), rated: o.rated, flag: o.seller_flag || '', other: o.name || 'مستخدم' })) });
  }));

  /* ---------------- الدردشة ---------------- */
  async function peer(c, me, uid) {
    const p = (await c.query(`SELECT email,name,uid,blk FROM sync_accounts WHERE uid=$1`, [txt(uid, 64)])).rows[0];
    if (!p || p.blk) fail(404, 'المستخدم غير متاح');
    p.email = String(p.email).toLowerCase();
    if (p.email === me.email) fail(400, 'لا يمكنك مراسلة نفسك');
    const ok = (await c.query(`SELECT 1 FROM p2p_sellers WHERE email=ANY($1) AND status='approved'`, [[me.email, p.email]])).rows[0]
      || (await c.query(`SELECT 1 FROM p2p_orders WHERE (buyer_email=$1 AND seller_email=$2) OR (buyer_email=$2 AND seller_email=$1) LIMIT 1`, [me.email, p.email])).rows[0];
    if (!ok) fail(403, 'الدردشة متاحة بين المشتري والبائع فقط');
    return p;
  }
  const msgOut = (m, me) => ({ id: Number(m.id), mine: m.f === me.email, sys: m.f === '*', x: m.body || '', img: m.img || null, o: m.order_id || 0, t: new Date(m.created_at).getTime() });

  app.post('/api/p2p/chat/inbox', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b);
    const rows = (await q(`SELECT DISTINCT ON (room) room,id,f,t,body,img,created_at FROM p2p_msgs WHERE (f=$1 OR t=$1) ORDER BY room,id DESC`, [me.email])).rows;
    const others = rows.map((r) => (r.f === me.email ? r.t : r.f)).filter((e) => e && e !== '*');
    const info = others.length ? (await q(`SELECT LOWER(email) email,name,uid,(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) av FROM sync_accounts a WHERE LOWER(email)=ANY($1)`, [others])).rows : [];
    const un = (await q(`SELECT f, COUNT(*)::int n FROM p2p_msgs WHERE t=$1 AND NOT seen GROUP BY f`, [me.email])).rows;
    const mp = {}; info.forEach((i) => { mp[i.email] = i; }); const um = {}; un.forEach((u) => { um[u.f] = u.n; });
    const list = rows.filter((r) => r.f !== '*').map((r) => { const o = r.f === me.email ? r.t : r.f; const i = mp[o]; return i ? { uid: i.uid, name: i.name || 'مستخدم', av: i.av ? Number(i.av) : 0, last: r.img ? '📷 صورة' : (r.body || '').slice(0, 60), t: new Date(r.created_at).getTime(), unread: um[o] || 0 } : null; })
      .filter(Boolean).sort((a, b2) => b2.t - a.t);
    res.json({ ok: true, list });
  }));

  app.post('/api/p2p/chat/msgs', J, wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); const p = await peer(pool, me, b.uid);
    const after = Math.max(0, Math.floor(num(b.after)));
    const rows = (await q(`SELECT id,f,body,img,order_id,created_at FROM p2p_msgs WHERE room=$1 AND id>$2 ORDER BY id ASC LIMIT 200`, [room(me.email, p.email), after])).rows;
    if (rows.some((m) => m.f === p.email)) await q(`UPDATE p2p_msgs SET seen=TRUE WHERE room=$1 AND t=$2 AND NOT seen`, [room(me.email, p.email), me.email]);
    res.json({ ok: true, msgs: rows.map((m) => msgOut(m, me)), peer: { uid: p.uid, name: p.name || 'مستخدم' } });
  }));

  app.post('/api/p2p/chat/send', express.json({ limit: '2mb' }), wrap(async (req, res) => {
    const b = req.body || {}; const me = await getAcc(pool, b); notBlkDemo(me, 'المراسلة');
    throttle('cs:' + me.email, 40, 60000);
    const p = await peer(pool, me, b.uid);
    const body = txt(b.body, 600), img = b.img ? String(b.img) : null;
    if (!body && !img) fail(400, 'اكتب رسالة');
    if (img && (!IMG_RE.test(img) || img.length > 1.8e6)) fail(400, 'الصورة غير صالحة');
    const m = (await q(`INSERT INTO p2p_msgs(room,f,t,body,img,order_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,f,body,img,order_id,created_at`, [room(me.email, p.email), me.email, p.email, body, img, parseInt(b.order, 10) || null])).rows[0];
    res.json({ ok: true, msg: msgOut(m, me) });
  }));

  /* ---------------- لوحة التحكم ---------------- */
  const person = (a) => a ? { email: a.email, name: a.name, phone: a.phone, uid: a.uid, kyc: !!a.kyc, blk: !!a.blk, pts: Number(a.pts || 0), since: a.created_at ? new Date(a.created_at).getTime() : 0 } : null;
  const ACC = `LOWER(a.email)`;

  app.get('/api/ctl/p2p/overview', ...ctl, wrap(async (_req, res) => {
    const cfg = await settings(); const pr = await priceRange(cfg);
    const c = (await q(`SELECT
      COUNT(*) FILTER (WHERE status='proof_submitted')::int proof, COUNT(*) FILTER (WHERE status='awaiting_payment')::int awaiting,
      COUNT(*) FILTER (WHERE status='disputed' OR (status='proof_submitted' AND seller_flag='dispute'))::int disputed,
      COUNT(*) FILTER (WHERE status='completed')::int done, COALESCE(SUM(pts) FILTER (WHERE status='completed'),0)::float8 vol,
      COALESCE(SUM(total_iqd) FILTER (WHERE status='completed'),0)::float8 iqd, COALESCE(SUM(fee) FILTER (WHERE status='completed'),0)::float8 fees
      FROM p2p_orders`)).rows[0];
    const sp = (await q(`SELECT COUNT(*) FILTER (WHERE status='pending')::int pending, COUNT(*) FILTER (WHERE status='approved')::int approved FROM p2p_sellers`)).rows[0];
    const ads = (await q(`SELECT COUNT(*) FILTER (WHERE status='active')::int active, COALESCE(SUM(avail_pts) FILTER (WHERE status<>'closed'),0)::float8 avail FROM p2p_ads`)).rows[0];
    const rv = (await q(`SELECT COUNT(*)::int n FROM p2p_reviews`)).rows[0].n;
    res.json({ ok: true, cfg, range: pr, counts: c, sellers: sp, ads, reviews: rv, levels: LEVELS, mtypes: MTYPES });
  }));

  app.get('/api/ctl/p2p/orders', ...ctl, wrap(async (req, res) => {
    const st = txt(req.query.status, 20);
    const where = st === 'review' ? `o.status='disputed'` : st === 'all' ? 'TRUE' : st ? `o.status=$1` : `o.status='disputed'`;
    const rows = (await q(`SELECT o.id,o.status,o.pts::float8 pts,o.fee::float8 fee,o.price::float8 price,o.total_iqd::float8 iqd,o.method,o.proof_at,o.created_at,o.seller_flag,o.seller_flag_note,o.admin_note,o.dispute_reason,o.dispute_note,o.disputed_by,
        b.name bname,b.email bemail,s.name sname,s.email semail,EXISTS(SELECT 1 FROM p2p_proofs p WHERE p.order_id=o.id) hasproof
      FROM p2p_orders o LEFT JOIN sync_accounts b ON LOWER(b.email)=o.buyer_email LEFT JOIN sync_accounts s ON LOWER(s.email)=o.seller_email
      WHERE ${where} ORDER BY (o.status='disputed') DESC, o.id DESC LIMIT 150`, ['all', 'review', ''].includes(st) || !st ? [] : [st])).rows;
    res.json({ ok: true, orders: rows.map((o) => ({ id: o.id, status: o.status, pts: o.pts, fee: o.fee, price: o.price, iqd: o.iqd, method: o.method, proofAt: o.proof_at ? new Date(o.proof_at).getTime() : 0,
      t: new Date(o.created_at).getTime(), flag: o.seller_flag || '', flagNote: o.seller_flag_note || '', note: o.admin_note || '', dReason: o.dispute_reason || '', dNote: o.dispute_note || '', dBy: o.disputed_by || '', buyer: o.bname || o.bemail, buyerEmail: o.bemail, seller: o.sname || o.semail, sellerEmail: o.semail, hasProof: o.hasproof })) });
  }));

  app.get('/api/ctl/p2p/order/:id', ...ctl, wrap(async (req, res) => {
    const o = (await q(`SELECT * FROM p2p_orders WHERE id=$1`, [parseInt(req.params.id, 10) || 0])).rows[0];
    if (!o) fail(404, 'الطلب غير موجود');
    const get = async (e) => (await q(`SELECT email,name,phone,uid,kyc,blk,pts,created_at FROM sync_accounts a WHERE ${ACC}=$1`, [e])).rows[0];
    const buyer = person(await get(o.buyer_email)), seller = person(await get(o.seller_email));
    const sp = (await q(`SELECT level,status,full_name,phone,bio,methods,waive FROM p2p_sellers WHERE email=$1`, [o.seller_email])).rows[0] || {};
    const hist = async (col, e) => (await q(`SELECT COUNT(*) FILTER (WHERE status='completed')::int done, COUNT(*) FILTER (WHERE status='rejected')::int rej, COUNT(*)::int total FROM p2p_orders WHERE ${col}=$1`, [e])).rows[0];
    const proof = (await q(`SELECT img,created_at FROM p2p_proofs WHERE order_id=$1`, [o.id])).rows[0];
    const msgs = (await q(`SELECT id,f,body,img,order_id,created_at FROM p2p_msgs WHERE room=$1 ORDER BY id DESC LIMIT 80`, [room(o.buyer_email, o.seller_email)])).rows.reverse()
      .map((m) => ({ id: Number(m.id), from: m.f === '*' ? '*' : m.f === o.buyer_email ? 'buyer' : 'seller', x: m.body || '', img: m.img || null, t: new Date(m.created_at).getTime() }));
    const ad = (await q(`SELECT id,price::float8 price,status FROM p2p_ads WHERE id=$1`, [o.ad_id])).rows[0];
    res.json({ ok: true, order: { id: o.id, status: o.status, pts: Number(o.pts), fee: Number(o.fee), price: Number(o.price), iqd: Number(o.total_iqd), method: o.method, flag: o.seller_flag || '', flagNote: o.seller_flag_note || '', dReason: o.dispute_reason || '', dNote: o.dispute_note || '', dBy: o.disputed_by || '',
        note: o.admin_note || '', t: new Date(o.created_at).getTime(), proofAt: o.proof_at ? new Date(o.proof_at).getTime() : 0, decidedAt: o.decided_at ? new Date(o.decided_at).getTime() : 0 },
      buyer: Object.assign(buyer || {}, { hist: await hist('buyer_email', o.buyer_email) }),
      seller: Object.assign(seller || {}, { level: sp.level, sstatus: sp.status, fullName: sp.full_name, sphone: sp.phone, bio: sp.bio, methods: sp.methods || [], hist: await hist('seller_email', o.seller_email) }),
      ad, proof: proof ? proof.img : null, msgs });
  }));

  async function completeOrder(cl, cmds, o, ad, who, msg) {
    const pts = Number(o.pts), give = pts - Number(o.fee);
    await cl.query(`UPDATE p2p_orders SET status='completed', decided_at=NOW(), admin_note=COALESCE($2,admin_note) WHERE id=$1`, [o.id, msg || null]);
    if (ad) {
      await cl.query(`UPDATE p2p_ads SET total_pts=GREATEST(0,total_pts-$2) WHERE id=$1`, [ad.id, pts]);
      await cl.query(`UPDATE p2p_ads SET status='closed' WHERE id=$1 AND total_pts=0`, [ad.id]);
    }
    await move(cl, cmds, o.buyer_email, give, 'شراء نقاط P2P', `طلب #${o.id}${Number(o.fee) ? ' (بعد خصم العمولة)' : ''}`);
    await sys(cl, o.buyer_email, o.seller_email, o.id, `🎉 ${who} الطلب #${o.id} وأُضيفت ${give.toLocaleString('en')} نقطة لرصيد المشتري`);
    await note(cl, o.buyer_email, 'وصلتك النقاط', `أُضيفت ${give.toLocaleString('en')} نقطة إلى رصيدك (طلب #${o.id}). لا تنسَ تقييم البائع.`);
    await note(cl, o.seller_email, 'اكتملت الصفقة', `الطلب #${o.id} (${pts.toLocaleString('en')} نقطة) اكتمل.`);
    return give;
  }
  const DREASON = { paid_not_released: 'دفعت ولم يتم التحرير', not_received: 'لم يصلني المبلغ', wrong_amount: 'المبلغ المستلم غير صحيح', other: 'سبب آخر', seller_not_received: 'البائع: لم يصل المبلغ' };

  // البائع يحرّر النقاط للمشتري بنفسه بعد التأكد من وصول المبلغ — لا حاجة لموافقة الإدارة
  app.post('/api/p2p/order/release', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect(); const cmds = []; let give = 0;
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b); const o = await loadOrder(cl, b, me, true);
      if (o.seller_email !== me.email) fail(403, 'فقط البائع يحرّر النقاط');
      if (o.status !== 'proof_submitted') fail(409, o.status === 'completed' ? 'تم تحرير هذا الطلب مسبقاً' : 'لا يمكن التحرير قبل أن يؤكد المشتري الدفع');
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [o.ad_id])).rows[0];
      give = await completeOrder(cl, cmds, o, ad, 'حرّر البائع', null);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true, give });
  }));

  // المشتري يفتح نزاعاً بعد التحويل (لا يُحرَّر الطلب) — تتدخل الإدارة وحدها هنا
  app.post('/api/p2p/order/dispute', J, wrap(async (req, res) => {
    const b = req.body || {}; const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const me = await getAcc(cl, b); throttle('dp:' + me.email, 6, 600000); const o = await loadOrder(cl, b, me, true);
      if (o.buyer_email !== me.email) fail(403, 'فقط المشتري يفتح النزاع من هنا');
      if (o.status !== 'proof_submitted') fail(409, 'يمكن فتح النزاع بعد تأكيد الدفع وقبل التحرير فقط');
      const why = txt(b.reason, 24); if (!DREASON[why] || why === 'seller_not_received') fail(400, 'اختر سبب النزاع');
      const nt = txt(b.note, 300); if (why === 'other' && nt.length < 5) fail(400, 'اكتب السبب');
      if (!(await cl.query(`SELECT 1 FROM p2p_proofs WHERE order_id=$1`, [o.id])).rows[0]) fail(400, 'أرفق صورة التحويل أولاً');
      await cl.query(`UPDATE p2p_orders SET status='disputed', dispute_reason=$2, dispute_note=$3, disputed_by='buyer', disputed_at=NOW() WHERE id=$1`, [o.id, why, nt]);
      await sys(cl, o.buyer_email, o.seller_email, o.id, `⚖️ فتح المشتري نزاعاً على الطلب #${o.id}: ${DREASON[why]}${nt ? ' — ' + nt : ''}. الإدارة ستراجع الإثبات وتقرر.`);
      await note(cl, o.seller_email, 'نزاع على طلب P2P', `فتح المشتري نزاعاً على الطلب #${o.id} (${DREASON[why]}). ستراجع الإدارة صورة التحويل وبياناتك.`);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    res.json({ ok: true });
  }));

  app.post('/api/ctl/p2p/order/decide', ...ctl, J, wrap(async (req, res) => {
    const b = req.body || {}; const act = txt(b.act, 10); const note = txt(b.note, 300);
    if (!['approve', 'reject', 'dispute'].includes(act)) fail(400, 'إجراء غير معروف');
    if (act === 'reject' && note.length < 3) fail(400, 'اكتب سبب الرفض ليظهر للمشتري والبائع');
    const cl = await pool.connect(); const cmds = [];
    try {
      await cl.query('BEGIN');
      const o = (await cl.query(`SELECT * FROM p2p_orders WHERE id=$1 FOR UPDATE`, [parseInt(b.id, 10) || 0])).rows[0];
      if (!o) fail(404, 'الطلب غير موجود');
      if (!['proof_submitted', 'disputed'].includes(o.status)) fail(409, 'الطلب ليس قيد التدقيق (حالته: ' + o.status + ')');
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [o.ad_id])).rows[0];
      const pts = Number(o.pts);
      if (act === 'approve') {
        await completeOrder(cl, cmds, o, ad, 'اعتمدت الإدارة', note);
      } else if (act === 'reject') {
        await cl.query(`UPDATE p2p_orders SET status='rejected', decided_at=NOW(), admin_note=$2 WHERE id=$1`, [o.id, note]);
        if (ad) await giveBack(cl, cmds, ad, pts);
        await sys(cl, o.buyer_email, o.seller_email, o.id, `❌ رفضت الإدارة الطلب #${o.id}: ${note}`);
        await note_(cl, o.buyer_email, 'تم رفض طلب P2P', note);
        await note_(cl, o.seller_email, 'رُفض طلب P2P', `الطلب #${o.id}: ${note}`);
      } else {
        await cl.query(`UPDATE p2p_orders SET status='disputed', admin_note=$2 WHERE id=$1`, [o.id, note]);
        await sys(cl, o.buyer_email, o.seller_email, o.id, `⚖️ الطلب #${o.id} قيد التحقيق من الإدارة${note ? ': ' + note : ''}`);
        await note_(cl, o.buyer_email, 'طلبك #' + o.id + ' قيد التحقيق', note || 'الإدارة تراجع النزاع.');
        await note_(cl, o.seller_email, 'الطلب #' + o.id + ' قيد التحقيق', note || 'الإدارة تراجع النزاع.');
      }
      if (b.ban && act !== 'approve') {
        await cl.query(`UPDATE p2p_sellers SET status='suspended', admin_note=$2 WHERE email=$1`, [o.seller_email, ('حظر بسبب نزاع #' + o.id + (note ? ': ' + note : '')).slice(0, 300)]);
        await cl.query(`UPDATE p2p_ads SET status='paused' WHERE seller_email=$1 AND status='active'`, [o.seller_email]);
        await note_(cl, o.seller_email, 'تم إيقاف حساب البائع', `أوقفت الإدارة حسابك كبائع بعد مراجعة النزاع #${o.id}. تواصل مع الدعم.`);
      }
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true });
  }));
  // الإدارة تراسل البائع و/أو المشتري من شاشة النزاع (إشعار + رسالة نظام في غرفة الطلب)
  app.post('/api/ctl/p2p/order/notify', ...ctl, J, wrap(async (req, res) => {
    const b = req.body || {}; const msg = txt(b.msg, 400); if (msg.length < 2) fail(400, 'اكتب الرسالة');
    const to = ['seller', 'buyer', 'both'].includes(b.to) ? b.to : 'seller';
    const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const o = (await cl.query(`SELECT * FROM p2p_orders WHERE id=$1`, [parseInt(b.id, 10) || 0])).rows[0]; if (!o) fail(404, 'الطلب غير موجود');
      if (to !== 'buyer') await note_(cl, o.seller_email, 'رسالة من الإدارة بخصوص الطلب #' + o.id, msg);
      if (to !== 'seller') await note_(cl, o.buyer_email, 'رسالة من الإدارة بخصوص الطلب #' + o.id, msg);
      await sys(cl, o.buyer_email, o.seller_email, o.id, `📢 الإدارة: ${msg}`);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    res.json({ ok: true });
  }));
  const note_ = (c, e, t, bd) => note(c, e, t, bd);

  app.get('/api/ctl/p2p/sellers', ...ctl, wrap(async (req, res) => {
    const st = txt(req.query.status, 12);
    const rows = (await q(`SELECT s.*,a.name,a.phone aphone,a.uid,a.pts::float8 bal,a.kyc,a.cl,a.blk FROM p2p_sellers s LEFT JOIN sync_accounts a ON LOWER(a.email)=s.email
      ${st ? 'WHERE s.status=$1' : ''} ORDER BY (s.status='pending') DESC, s.created_at DESC LIMIT 200`, st ? [st] : [])).rows;
    const cfg = await settings(); const stats = await statsFor(rows.map((r) => r.email));
    res.json({ ok: true, reqCounter: cfg.reqCounterIdx, sellers: rows.map((r) => { const s = stats[r.email]; return { email: r.email, name: r.name, phone: r.aphone, uid: r.uid, bal: r.bal, kyc: !!r.kyc, blk: !!r.blk, status: r.status, level: r.level,
      fullName: r.full_name, sphone: r.phone, bio: r.bio, methods: r.methods, waive: r.waive, adminNote: r.admin_note || '', counter: hasCounter(r, cfg.reqCounterIdx), t: new Date(r.created_at).getTime(),
      stats: Object.assign(pubStats(s), { bad: s.bad, disputes: s.disputes }), suggest: suggest(s.done, s.rate, s.avg) }; }) });
  }));

  app.post('/api/ctl/p2p/seller/decide', ...ctl, J, wrap(async (req, res) => {
    const b = req.body || {}; const email = txt(b.email, 200).toLowerCase();
    const s = (await q(`SELECT * FROM p2p_sellers WHERE email=$1`, [email])).rows[0]; if (!s) fail(404, 'البائع غير موجود');
    const status = b.status ? txt(b.status, 12) : s.status, level = b.level ? txt(b.level, 10) : s.level;
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) fail(400, 'حالة غير صحيحة');
    if (!LEVELS[level]) fail(400, 'مستوى غير صحيح');
    const waive = b.waive == null ? s.waive : !!b.waive;
    await q(`UPDATE p2p_sellers SET status=$2, level=$3, waive=$4, admin_note=$5, approved_at=CASE WHEN $2='approved' AND approved_at IS NULL THEN NOW() ELSE approved_at END WHERE email=$1`,
      [email, status, level, waive, b.note == null ? s.admin_note : txt(b.note, 300)]);
    if (status !== s.status || level !== s.level) {
      await q(`INSERT INTO p2p_level_log(email,level,status,note) VALUES($1,$2,$3,$4)`, [email, level, status, txt(b.note, 300)]);
      const cl = await pool.connect();
      try {
        if (status !== s.status) await note(cl, email, status === 'approved' ? 'تم اعتمادك بائعاً P2P' : status === 'suspended' ? 'تم إيقاف حساب البائع' : status === 'rejected' ? 'رُفض طلب البائع' : 'تحديث حالة البائع', txt(b.note, 200) || (status === 'approved' ? 'يمكنك الآن نشر إعلاناتك.' : ''));
        else if (level !== s.level) await note(cl, email, 'تم تحديث مستواك', 'مستواك الجديد: ' + LEVELS[level]);
      } finally { cl.release(); }
    }
    if (status === 'suspended' || status === 'rejected') { // إيقاف الإعلانات المفتوحة (النقاط تبقى محجوزة حتى ينتهي التدقيق ثم تُغلق يدوياً)
      await q(`UPDATE p2p_ads SET status='paused' WHERE seller_email=$1 AND status='active'`, [email]);
    }
    res.json({ ok: true });
  }));

  app.get('/api/ctl/p2p/reviews', ...ctl, wrap(async (_req, res) => {
    const rows = (await q(`SELECT r.id,r.order_id,r.stars,r.comment,r.hidden,r.created_at,r.seller_email,r.buyer_email,s.name sname,b.name bname
      FROM p2p_reviews r LEFT JOIN sync_accounts s ON LOWER(s.email)=r.seller_email LEFT JOIN sync_accounts b ON LOWER(b.email)=r.buyer_email ORDER BY r.id DESC LIMIT 150`)).rows;
    res.json({ ok: true, reviews: rows.map((r) => ({ id: r.id, order: r.order_id, stars: r.stars, comment: r.comment || '', hidden: r.hidden, t: new Date(r.created_at).getTime(), seller: r.sname || r.seller_email, sellerEmail: r.seller_email, buyer: r.bname || r.buyer_email })) });
  }));
  app.post('/api/ctl/p2p/review/hide', ...ctl, J, wrap(async (req, res) => {
    const b = req.body || {}; await q(`UPDATE p2p_reviews SET hidden=$2 WHERE id=$1`, [parseInt(b.id, 10) || 0, !!b.hidden]); res.json({ ok: true });
  }));

  app.get('/api/ctl/p2p/ads', ...ctl, wrap(async (_req, res) => {
    const cfg = await settings(); const pr = await priceRange(cfg);
    const rows = (await q(`SELECT ad.id,ad.seller_email,ad.total_pts::float8 total,ad.avail_pts::float8 avail,ad.price::float8 price,ad.status,ad.created_at,a.name FROM p2p_ads ad LEFT JOIN sync_accounts a ON LOWER(a.email)=ad.seller_email
      WHERE ad.status<>'closed' ORDER BY ad.id DESC LIMIT 150`)).rows;
    res.json({ ok: true, range: pr, ads: rows.map((a) => ({ id: a.id, seller: a.name || a.seller_email, sellerEmail: a.seller_email, total: a.total, avail: a.avail, price: a.price, status: a.status, out: !inRange(a.price, pr), t: new Date(a.created_at).getTime() })) });
  }));
  app.post('/api/ctl/p2p/ad/close', ...ctl, J, wrap(async (req, res) => {
    const cl = await pool.connect(); const cmds = [];
    try {
      await cl.query('BEGIN');
      const ad = (await cl.query(`SELECT * FROM p2p_ads WHERE id=$1 FOR UPDATE`, [parseInt((req.body || {}).id, 10) || 0])).rows[0];
      if (!ad || ad.status === 'closed') fail(404, 'الإعلان غير موجود');
      const back = Number(ad.avail_pts);
      await cl.query(`UPDATE p2p_ads SET status='closed', avail_pts=0, total_pts=total_pts-$2 WHERE id=$1`, [ad.id, back]);
      await move(cl, cmds, ad.seller_email, back, 'P2P — إغلاق إعلان من الإدارة', 'إعلان #' + ad.id);
      await cl.query('COMMIT');
    } catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; } finally { cl.release(); }
    flush(cmds); res.json({ ok: true });
  }));

  app.get('/api/ctl/p2p/settings', ...ctl, wrap(async (_req, res) => res.json({ ok: true, cfg: await settings(), range: await priceRange(await settings()) })));
  app.post('/api/ctl/p2p/settings', ...ctl, J, wrap(async (req, res) => {
    const b = req.body || {}; const v = Object.assign({}, await settings(), b.cfg || {});
    await q(`INSERT INTO p2p_settings(k,v) VALUES('cfg',$1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [JSON.stringify(v)]);
    const cfg = await settings(); res.json({ ok: true, cfg, range: await priceRange(cfg) });
  }));
};

// تحليل الأجسام الكبيرة (صور) قبل المحلل العام ذي الحد 50kb — يُستدعى من server.js قبل express.json العام
module.exports.parsers = (app, express) => {
  app.use(['/api/p2p/order/proof'], express.json({ limit: '3mb' }));
  app.use(['/api/p2p/chat/send'], express.json({ limit: '2mb' }));
  app.use(['/api/p2p/seller/apply', '/api/p2p/seller/update'], express.json({ limit: '30kb' }));
};

/* balance-guard.js — حارس حفظ القيمة للأرصدة المرفوعة من الأجهزة (طبقة تقليل الضرر)
 *
 * المشكلة: التطبيق يحسب العوائد والمشتريات على الجهاز ثم يرسل «فرقاً» إلى /api/bal/push، فكان يمكن لأي مستخدم
 * (أو سكربت) إرسال dp / dg / du موجبة كبيرة وتوليد نقاط وجواهر ودولارات من العدم.
 *
 * الحل هنا: كل فرق موجب يُقارن بـ«رصيد سماح» يحسبه الخادم من معطيات يعرفها هو فقط:
 *   1) التعدين: الأساس + عوائد العدادات الفعّالة في sync_accounts.cl × الزمن المنقضي (لا يزيد عن يومين).
 *   2) عمولات الإحالة: الزيادة في rf_total (تُحسب في الخادم).
 *   3) جوائز الألعاب/العجلة المُسلَّمة من الخادم (allow()).
 *   4) المكافأة اليومية/الترحيبية: سقف ثابت صغير يومياً.
 *   5) الاسترداد: فقط ما صرفه هذا الحساب فعلاً خلال 14 يوماً، وبسقف يومي.
 * أي زيادة فوق ذلك تُقصّ (تُهمَل) وتُسجَّل في bal_audit، ويعود الرصيد الحقيقي للجهاز في الرد.
 * التحويلات بين العملات (نقاط↔جواهر↔دولار) محايدة القيمة فتمرّ طبيعياً.
 *
 * ملاحظة صريحة: هذا لا يحوّل النظام إلى «الخادم هو المرجع» بالكامل (الأرباح ما زالت تُحسب على الجهاز)، لكنه يحدّ
 * ما يمكن توليده يومياً لكل حساب بقيمة معروفة بدل أن يكون بلا حد. الحل الجذري: نقل الاستلام/الشراء إلى معاملات خادم.
 *
 * متغيرات البيئة (اختيارية):
 *   BAL_GUARD=enforce|log|off      (الافتراضي enforce؛ log = يسجّل ما كان سيُقصّ دون تطبيقه)
 *   BAL_FREE_USD_PER_DAY=5.5       مكافآت الدولار اليومية القصوى لكل حساب
 *   BAL_REFUND_DAY=1500000         سقف الاسترداد اليومي (بقيمة نقاط)
 *   BAL_DAY_CAP=5000000            سقف صافي الزيادة اليومي لكل حساب (بقيمة نقاط)
 */
const MODE = (process.env.BAL_GUARD || 'enforce').toLowerCase();
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const FREE_USD = Math.max(0, num(process.env.BAL_FREE_USD_PER_DAY, 5.5));
const REFUND_DAY = Math.max(0, num(process.env.BAL_REFUND_DAY, 1500000));
const DAY_CAP_MIN = Math.max(0, num(process.env.BAL_DAY_CAP, 5000000));
const POOL_CAP = 1e8, POOL_TTL = 14 * 864e5, TOL = 250; // التقريب (خانتان عشريتان للدولار) لا يُعدّ توليداً
const DAY_MS = 864e5;
const baghdadDay = (t) => new Date((t || Date.now()) + 3 * 3600e3).toISOString().slice(0, 10);

module.exports = function createGuard(pool, { CT }) {
  let ready = null;
  const init = () => ready || (ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS bal_guard(
      email TEXT PRIMARY KEY, bucket NUMERIC NOT NULL DEFAULT 0, t TIMESTAMPTZ, rf_seen NUMERIC,
      pool NUMERIC NOT NULL DEFAULT 0, pool_t TIMESTAMPTZ, pool_day TEXT, pool_used NUMERIC NOT NULL DEFAULT 0,
      day TEXT, day_in NUMERIC NOT NULL DEFAULT 0)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS bal_audit(
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL, dp NUMERIC, dg NUMERIC, du NUMERIC,
      adp NUMERIC, adg NUMERIC, adu NUMERIC, note TEXT, at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE INDEX IF NOT EXISTS bal_audit_email_idx ON bal_audit(email, id DESC)`);
  })().catch((e) => { ready = null; throw e; }));

  let cfgC = null, cfgAt = 0;
  async function rates() {
    if (cfgC && Date.now() - cfgAt < 30000) return cfgC;
    let c = {};
    try { const r = (await pool.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0]; c = (r && r.val && r.val.cfg) || {}; } catch (e) { /* افتراضي */ }
    const pr = (num(c.agRate) > 0 ? num(c.agRate) : 132) / 1000;               // دينار لكل نقطة
    const gr = num(c.gemRate) > 0 ? num(c.gemRate) : 100;                       // نقاط لكل جوهرة
    const iqd = num(c.iqd) > 0 ? num(c.iqd) : 1620;
    const ur = num(c.usdRate) > 0 ? num(c.usdRate) : iqd / pr;                  // نقاط لكل دولار
    const base = num(c.base) > 0 ? num(c.base) : 100;
    const gift = Math.max(5, num(c.gift));
    cfgC = { gr, ur, base, gift }; cfgAt = Date.now();
    return cfgC;
  }

  // العائد اليومي (بقيمة نقاط) من العدادات الفعّالة المعروفة للخادم
  function mining(cl, R) {
    const now = Date.now();
    let m = R.base;
    let arr = cl; if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
    (Array.isArray(arr) ? arr : []).forEach((c) => {
      const i = Math.floor(num(c && c.i, -1));
      if (!(c && num(c.e) > now) || i < 0 || i >= CT.length) return;
      m += CT[i][3] === 'g' ? CT[i][2] * R.gr : CT[i][2];
    });
    return m;
  }

  /* يُستدعى داخل معاملة (c = عميل pg) والصف في sync_accounts مقفول أو سيُحدَّث بعده مباشرة. */
  async function apply(c, em, dp, dg, du, tag) {
    if (MODE === 'off') return { dp, dg, du, clipped: false };
    await init();
    const R = await rates();
    const acc = (await c.query(`SELECT cl, rf_total FROM sync_accounts WHERE LOWER(email)=$1`, [em])).rows[0];
    if (!acc) return { dp, dg, du, clipped: false };
    await c.query(`INSERT INTO bal_guard(email) VALUES($1) ON CONFLICT DO NOTHING`, [em]);
    const g = (await c.query(`SELECT * FROM bal_guard WHERE email=$1 FOR UPDATE`, [em])).rows[0];
    const now = Date.now(), today = baghdadDay(now);

    const M = mining(acc.cl, R) * 1.2;                                  // هامش 20% لفروقات التوقيت
    const FREE = FREE_USD * R.ur + 100 + R.gr;                          // مكافأة يومية: دولار + 100 نقطة + جوهرة
    const per = M + FREE;
    const dt = g.t ? Math.min(Math.max(0, now - new Date(g.t).getTime()), 2 * DAY_MS) : DAY_MS;   // أول ظهور = يوم كامل
    const BCAP = 2 * per;
    let B = Math.min(BCAP, num(g.bucket) + per * dt / DAY_MS);
    const rf = num(acc.rf_total);
    if (g.rf_seen == null) B += rf; else B += Math.max(0, rf - num(g.rf_seen)); // عمولة الإحالة يحسبها الخادم

    let P = num(g.pool), poolT = g.pool_t ? new Date(g.pool_t).getTime() : 0;
    if (P > 0 && poolT && now - poolT > POOL_TTL) P = 0;
    let used = g.pool_day === today ? num(g.pool_used) : 0;
    let dayIn = g.day === today ? num(g.day_in) : 0;

    const pos = (v, k) => (v > 0 ? v * k : 0), neg = (v, k) => (v < 0 ? -v * k : 0);
    const Vp = pos(dp, 1) + pos(dg, R.gr) + pos(du, R.ur);
    const Vn = neg(dp, 1) + neg(dg, R.gr) + neg(du, R.ur);
    const refundAvail = Math.min(P, Math.max(0, REFUND_DAY - used));
    const dayCap = Math.max(DAY_CAP_MIN, 3 * per);
    let allowedPos = Math.min(B + refundAvail + Vn + TOL, Math.max(0, dayCap - dayIn) + Vn + TOL);
    allowedPos = Math.max(allowedPos, 0);

    let out = { dp, dg, du, clipped: false };
    let eff = { Vp, Vn };
    if (Vp > allowedPos) {
      const f = Vp > 0 ? Math.max(0, allowedPos / Vp) : 0;
      out = {
        dp: dp > 0 ? Math.floor(dp * f) : dp,
        dg: dg > 0 ? Math.floor(dg * f) : dg,
        du: du > 0 ? Math.floor(du * f * 100) / 100 : du,
        clipped: true,
      };
      eff = { Vp: pos(out.dp, 1) + pos(out.dg, R.gr) + pos(out.du, R.ur), Vn };
      await c.query(`INSERT INTO bal_audit(email,kind,dp,dg,du,adp,adg,adu,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [em, MODE === 'enforce' ? 'clip' : 'would_clip', dp, dg, du, out.dp, out.dg, out.du,
          `${tag || 'push'} Vp=${Math.round(Vp)} allowed=${Math.round(allowedPos)} B=${Math.round(B)} pool=${Math.round(P)} M=${Math.round(M)}`]);
      if (MODE !== 'enforce') { out = { dp, dg, du, clipped: false }; eff = { Vp, Vn }; }
    }

    // تحديث الأرصدة الداخلية للحارس (في وضع log لا نستهلك السماح)
    const net = eff.Vp - eff.Vn;
    if (MODE === 'enforce' || !out.clipped) {
      if (net <= 0) { P = Math.min(POOL_CAP, P + (-net)); poolT = now; }
      else {
        const fromB = Math.min(B, net); B -= fromB;
        const rest = net - fromB;
        if (rest > 0) { P = Math.max(0, P - rest); used += rest; }
        dayIn += net;
      }
    }
    await c.query(
      `UPDATE bal_guard SET bucket=$2, t=NOW(), rf_seen=$3, pool=$4, pool_t=$5, pool_day=$6, pool_used=$7, day=$8, day_in=$9 WHERE email=$1`,
      [em, Math.max(0, B), rf, P, poolT ? new Date(poolT) : null, today, used, today, dayIn]);
    return out;
  }

  // سماح إضافي من مصدر يثق به الخادم (جوائز ألعاب/عجلة سُلّمت للجهاز ليضيفها محلياً)
  async function allow(email, pts = 0, gems = 0, usd = 0) {
    try {
      if (MODE === 'off') return;
      await init(); const R = await rates();
      const v = Math.max(0, num(pts)) + Math.max(0, num(gems)) * R.gr + Math.max(0, num(usd)) * R.ur;
      if (!(v > 0)) return;
      const em = String(email || '').trim().toLowerCase();
      await pool.query(`INSERT INTO bal_guard(email,bucket) VALUES($1,$2) ON CONFLICT (email) DO UPDATE SET bucket=LEAST(bal_guard.bucket+$2, 1e9)`, [em, v]);
    } catch (e) { console.error('balGuard.allow', e.message); }
  }

  return { init, apply, allow, mode: MODE };
};

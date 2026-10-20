/**
 * missions-ext.js — قسم المهمات (5 مراحل من الأسهل للأصعب) — التقدّم والمكافآت من السيرفر
 *  POST /api/missions/state  {e,h}      : المراحل + تقدّم كل مهمة + حالة الاستلام
 *  POST /api/missions/claim  {e,h,id}   : استلام مكافأة مهمة (id=m1..) أو مكافأة إنهاء مرحلة (id=s1..s5)
 * تُحسب المقاييس من جداول التطبيق الحقيقية (لا يوثَق بالعميل)، وكل مكافأة تُستلم مرة واحدة فقط لكل حساب،
 * وتُقيَّد على التطبيق كمصروف سالب في app_revenue (kind=mission_reward).
 * المرحلة التالية تُفتح بعد استلام كل مكافآت المرحلة السابقة.
 */
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// [id, عنوان, وصف, مقياس, هدف, مكافأة]
const STAGES = [
  { id: 1, name: 'المبتدئ', emoji: '🌱', bonus: 300, ms: [
    ['m1', 'فعّل بريدك', 'أكّد بريدك الإلكتروني', 'email', 1, 200],
    ['m2', 'أضف صديقاً', 'أضف صديقاً واحداً واقبل طلبه', 'friends', 1, 200],
    ['m3', 'انشر أول منشور', 'شارك خبراً أو منشوراً في الأخبار', 'posts', 1, 300]] },
  { id: 2, name: 'المستكشف', emoji: '🧭', bonus: 800, ms: [
    ['m4', 'وثّق رقم هاتفك', 'أكّد رقم هاتفك', 'phone', 1, 400],
    ['m5', 'اشترِ من المتجر', 'اشترِ بطاقة واحدة من المتجر', 'store', 1, 500],
    ['m6', 'أرسل هدية', 'أرسل هدية لمنشور أو في روم', 'gifts', 1, 500]] },
  { id: 3, name: 'النشِط', emoji: '⚡', bonus: 2000, ms: [
    ['m7', 'امتلك عداداً', 'احصل على عداد واحد على الأقل', 'counters', 1, 1000],
    ['m8', 'كوّن 5 أصدقاء', 'اجمع 5 أصدقاء', 'friends', 5, 1000],
    ['m9', 'ادعُ صديقاً', 'سجّل صديق عبر كود الإحالة الخاص بك', 'refs', 1, 1500]] },
  { id: 4, name: 'المحترف', emoji: '🏅', bonus: 5000, ms: [
    ['m10', 'أكمل صفقة P2P', 'أكمل صفقة شراء أو بيع نقاط واحدة', 'p2p', 1, 2500],
    ['m11', 'افتح غرفتك', 'امتلك روماً صوتياً', 'rooms', 1, 3000],
    ['m12', 'داعم كريم', 'أرسل هدايا بقيمة 50,000 نقطة', 'giftpts', 50000, 3000]] },
  { id: 5, name: 'الأسطورة', emoji: '👑', bonus: 15000, ms: [
    ['m13', 'ادعُ 5 أصدقاء', 'سجّل 5 أصدقاء عبر كود الإحالة', 'refs', 5, 6000],
    ['m14', '5 صفقات P2P', 'أكمل 5 صفقات P2P', 'p2p', 5, 6000],
    ['m15', 'بع عداداً', 'بع عداداً في متجر العدادات', 'ctrsold', 1, 5000],
    ['m16', 'ربح الرومات', 'اربح 100,000 نقطة من الرومات', 'roomearn', 100000, 10000]] },
];
const ALL = {}; STAGES.forEach((s) => s.ms.forEach((m) => { ALL[m[0]] = { st: s.id, t: m[1], d: m[2], k: m[3], goal: m[4], rw: m[5] }; }));

module.exports = (app, express, deps) => {
  const { pool, wrap, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '10kb' });
  const ready = q(`CREATE TABLE IF NOT EXISTS mission_claims(email TEXT NOT NULL, mid TEXT NOT NULL, pts BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(email, mid))`)
    .catch((e) => console.error('missions schema:', e.message));
  app.use('/api/missions', (_req, _res, next) => ready.then(() => next(), next));

  async function metrics(c, email, acc) {
    const one = async (sql, p) => { try { return Number((await c.query(sql, p || [email])).rows[0].n) || 0; } catch (_) { return 0; } };
    const m = {};
    m.email = acc.vml ? 1 : 0; m.phone = acc.vph ? 1 : 0; m.counters = Number(acc.ncl) > 0 || (Array.isArray(acc.cl) && acc.cl.length > 0) ? 1 : 0;
    m.friends = await one(`SELECT COUNT(*)::int n FROM soc_friends WHERE status='accepted' AND (a=$1 OR b=$1)`);
    m.posts = await one(`SELECT COUNT(*)::int n FROM user_news WHERE LOWER(email)=$1`);
    m.store = await one(`SELECT COUNT(*)::int n FROM store_orders WHERE LOWER(email)=$1 AND COALESCE(refunded,FALSE)=FALSE`);
    const g1 = await one(`SELECT COALESCE(SUM(total),0)::float8 n FROM gift_log WHERE LOWER(from_email)=$1`);
    const g2 = await one(`SELECT COALESCE(SUM(total),0)::float8 n FROM post_gifts WHERE LOWER(from_email)=$1`);
    const g3 = await one(`SELECT COALESCE(SUM(total),0)::float8 n FROM room_gift_log WHERE LOWER(from_email)=$1`);
    const c1 = await one(`SELECT COUNT(*)::int n FROM gift_log WHERE LOWER(from_email)=$1`);
    const c2 = await one(`SELECT COUNT(*)::int n FROM post_gifts WHERE LOWER(from_email)=$1`);
    const c3 = await one(`SELECT COUNT(*)::int n FROM room_gift_log WHERE LOWER(from_email)=$1`);
    m.gifts = c1 + c2 + c3; m.giftpts = g1 + g2 + g3;
    m.refs = await one(`SELECT COUNT(*)::int n FROM sync_accounts WHERE LOWER(ref_by)=$1`);
    m.p2p = await one(`SELECT COUNT(*)::int n FROM p2p_orders WHERE status='completed' AND (LOWER(buyer_email)=$1 OR LOWER(seller_email)=$1)`);
    m.rooms = await one(`SELECT COUNT(*)::int n FROM rooms WHERE LOWER(owner_email)=$1`);
    m.ctrsold = await one(`SELECT COUNT(*)::int n FROM ctr_market WHERE status='sold' AND LOWER(seller_email)=$1`);
    m.roomearn = await one(`SELECT COALESCE(SUM(pts),0)::float8 n FROM room_earn WHERE LOWER(email)=$1`);
    return m;
  }
  async function account(c, e, h, lock) {
    e = txt(e, 200).toLowerCase(); h = txt(h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const a = (await c.query(`SELECT email,name,pts,blk,demo,vml,vph,ncl,cl FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2${lock ? ' FOR UPDATE' : ''}`, [e, h])).rows[0];
    if (!a) fail(401, 'غير مسجّل الدخول');
    if (a.blk) fail(403, 'الحساب موقوف');
    return a;
  }
  function build(m, claimed) {
    let prevDone = true;
    return STAGES.map((s) => {
      const ms = s.ms.map((x) => { const prog = Math.min(x[4], Math.floor(m[x[3]] || 0)); return { id: x[0], title: x[1], desc: x[2], goal: x[4], prog, done: prog >= x[4], claimed: claimed.has(x[0]), reward: x[5] }; });
      const all = ms.every((x) => x.claimed), locked = !prevDone;
      const out = { id: s.id, name: s.name, emoji: s.emoji, bonus: s.bonus, locked, missions: ms, bonusReady: !locked && all && !claimed.has('s' + s.id), bonusClaimed: claimed.has('s' + s.id) };
      prevDone = all && claimed.has('s' + s.id) ? true : (all ? true : false);
      return out;
    });
  }
  app.post('/api/missions/state', jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const a = await account(pool, b.e, b.h, false), email = String(a.email).toLowerCase();
    const claimed = new Set((await q(`SELECT mid FROM mission_claims WHERE email=$1`, [email])).rows.map((r) => r.mid));
    const stages = build(await metrics(pool, email, a), claimed);
    const total = [...claimed].reduce((t, k) => t + (ALL[k] ? ALL[k].rw : (STAGES.find((s) => 's' + s.id === k) || {}).bonus || 0), 0);
    res.json({ ok: true, stages, earned: total });
  }));
  app.post('/api/missions/claim', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, id = txt(b.id, 10);
    const cl = await pool.connect(); let out;
    try {
      await cl.query('BEGIN');
      const a = await account(cl, b.e, b.h, true), email = String(a.email).toLowerCase();
      if (a.demo) fail(403, 'الحساب التجريبي لا يمكنه استلام المكافآت');
      const claimed = new Set((await cl.query(`SELECT mid FROM mission_claims WHERE email=$1`, [email])).rows.map((r) => r.mid));
      const stages = build(await metrics(pool, email, a), claimed);
      let pts = 0, label = '';
      if (ALL[id]) {
        const s = stages[ALL[id].st - 1], m = s.missions.find((x) => x.id === id);
        if (s.locked) fail(403, 'أكمل المرحلة السابقة أولاً');
        if (m.claimed) fail(409, 'استلمت هذه المكافأة من قبل');
        if (!m.done) fail(400, 'لم تكتمل المهمة بعد');
        pts = m.reward; label = m.title;
      } else if (/^s[1-5]$/.test(id)) {
        const s = stages[+id[1] - 1];
        if (!s.bonusReady) fail(400, s.bonusClaimed ? 'استلمت مكافأة المرحلة من قبل' : 'أكمل واستلم كل مهام المرحلة أولاً');
        pts = s.bonus; label = 'إنهاء مرحلة ' + s.name;
      } else fail(400, 'مهمة غير معروفة');
      const ins = await cl.query(`INSERT INTO mission_claims(email,mid,pts) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING mid`, [email, id, pts]);
      if (!ins.rows.length) fail(409, 'استلمت هذه المكافأة من قبل');
      await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [email, pts]);
      await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [email, pts]);
      await cl.query(`INSERT INTO app_revenue(kind,pts,ref,note) VALUES('mission_reward',$1,$2,$3)`, [-pts, 'mission:' + id, email.slice(0, 60) + ' — ' + label]).catch(() => {});
      await cl.query('COMMIT');
      out = { ok: true, pts, label, bal: Number(a.pts) + pts, email };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ }
    try { if (app.locals.notify) app.locals.notify(out.email, 'مكافأة مهمة 🎯', 'حصلت على ' + out.pts.toLocaleString('en') + ' نقطة: ' + out.label, 'mission'); } catch (_) { /* اختياري */ }
    res.json({ ok: true, pts: out.pts, bal: out.bal });
  }));
};

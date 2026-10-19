/* المرحلة 4 — المستخدمون الحقيقيون: اقتراحات صداقة (حتى 100) + طلبات صداقة فورية + إشعارات + مراسلة أي شخص
   كل شيء محفوظ في قاعدة البيانات ويتزامن بين الأجهزة. التعريف العام للمستخدم رقم عشوائي (uid) وليس البريد. */
const rateLimit = require('express-rate-limit');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ONLINE_MS = 5 * 60 * 1000;
const STORY_MS = 24 * 60 * 60 * 1000;
const isImg = (v) => typeof v === 'string' && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 1.4e6;
/* الخصوصية: all = الجميع · friends = الأصدقاء · me = أنا فقط (لا أحد) */
const PV_OPTS = { online: ['all', 'friends', 'me'], friend_req: ['all', 'me'], dm: ['all', 'friends', 'me'], posts: ['all', 'friends', 'me'], stories: ['all', 'friends', 'me'] };
const PV_DEF = { online: 'all', friend_req: 'all', dm: 'all', posts: 'all', stories: 'friends' };
const allow = (lvl, isFriend) => lvl === 'all' || (lvl === 'friends' && !!isFriend);
const BGS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#15803d', '#334155', '#9f1239'];

exports.parsers = (app, express) => {
  app.use('/api/soc/story/add', express.json({ limit: '2mb' })); // صورة الستوري (يجب أن يسبق المحلل العام)
  app.use('/api/soc', express.json({ limit: '100kb' }));
};

exports.routes = (app, { pool, wrap, ctl }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const lim = rateLimit({
    windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => 'soc:' + (req.body && req.body.e ? String(req.body.e).toLowerCase().slice(0, 120) : (req.ip || 'x')),
    validate: false,
  });

  const ddl = [
    `ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS uid TEXT`,
    `UPDATE sync_accounts SET uid=md5(random()::text || email || clock_timestamp()::text) WHERE uid IS NULL`,
    `ALTER TABLE sync_accounts ALTER COLUMN uid SET DEFAULT md5(random()::text || clock_timestamp()::text)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS sync_accounts_uid_idx ON sync_accounts(uid)`,
    `CREATE TABLE IF NOT EXISTS avatars(email TEXT PRIMARY KEY, img TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS soc_friends(
       id BIGSERIAL PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(a,b))`,
    `CREATE INDEX IF NOT EXISTS soc_friends_b_idx ON soc_friends(b, status)`,
    `CREATE TABLE IF NOT EXISTS soc_msgs(
       id BIGSERIAL PRIMARY KEY, f TEXT NOT NULL, t TEXT NOT NULL, body TEXT NOT NULL, read BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS soc_msgs_pair_idx ON soc_msgs(f, t, id)`,
    `CREATE INDEX IF NOT EXISTS soc_msgs_unread_idx ON soc_msgs(t, read)`,
    `CREATE TABLE IF NOT EXISTS soc_notes(
       id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
       delivered BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS soc_notes_idx ON soc_notes(email, delivered)`,
    `CREATE TABLE IF NOT EXISTS user_privacy(
       email TEXT PRIMARY KEY, online TEXT NOT NULL DEFAULT 'all', friend_req TEXT NOT NULL DEFAULT 'all', dm TEXT NOT NULL DEFAULT 'all',
       posts TEXT NOT NULL DEFAULT 'all', stories TEXT NOT NULL DEFAULT 'friends', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS soc_stories(
       id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, img TEXT, body TEXT NOT NULL DEFAULT '', bg TEXT NOT NULL DEFAULT '',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS soc_stories_idx ON soc_stories(email, id)`,
    `CREATE INDEX IF NOT EXISTS soc_stories_time_idx ON soc_stories(created_at)`,
    `CREATE TABLE IF NOT EXISTS soc_story_views(
       story_id BIGINT NOT NULL REFERENCES soc_stories(id) ON DELETE CASCADE, viewer TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(story_id, viewer))`,
  ];
  // قد يعمل هذا قبل أن ينشئ db.js جدول sync_accounts في أول تشغيل، لذلك نعيد المحاولة
  const ready = (async () => {
    for (let t = 0; t < 8; t++) {
      try { for (const s of ddl) await q(s); return; }
      catch (e) { if (t === 7) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('social-ext schema:', e.message));
  app.use('/api/soc', (_req, _res, next) => ready.then(() => next(), next));

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email,name,uid,blk,demo FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    const u = r.rows[0];
    if (!u) fail(401, 'غير مسجّل الدخول');
    if (u.blk) fail(403, 'الحساب موقوف');
    return { email: String(u.email).toLowerCase(), name: u.name || e.split('@')[0], uid: u.uid, demo: !!u.demo };
  }
  async function peer(uid) {
    const r = await q(`SELECT email,name,uid,blk,demo FROM sync_accounts WHERE uid=$1`, [txt(uid, 64)]);
    const p = r.rows[0];
    if (!p || p.blk || p.demo) fail(404, 'المستخدم غير متاح');
    return { email: String(p.email).toLowerCase(), name: p.name || String(p.email).split('@')[0], uid: p.uid };
  }
  const note = (email, kind, title, body) =>
    q(`INSERT INTO soc_notes(email,kind,title,body) VALUES($1,$2,$3,$4)`, [email, kind, title, body]);
  const pair = (me, o) => [me, o];

  /* ---------------- مساعدات الخصوصية ---------------- */
  async function privMap(emails) {
    const m = {}; const list = [...new Set(emails.map((e) => String(e).toLowerCase()))];
    if (!list.length) return m;
    (await q(`SELECT email,online,friend_req,dm,posts,stories FROM user_privacy WHERE email=ANY($1)`, [list])).rows.forEach((r) => { m[r.email] = r; });
    return m;
  }
  const pvOf = (m, e) => Object.assign({}, PV_DEF, (m && m[String(e).toLowerCase()]) || {});
  async function isFriend(a, b) {
    return !!(await q(`SELECT 1 FROM soc_friends WHERE status='accepted' AND ((a=$1 AND b=$2) OR (a=$2 AND b=$1)) LIMIT 1`, [a, b])).rows[0];
  }
  async function friendSet(email) {
    const r = (await q(`SELECT a,b FROM soc_friends WHERE status='accepted' AND (a=$1 OR b=$1)`, [email])).rows;
    return new Set(r.map((x) => (x.a === email ? x.b : x.a)));
  }
  setInterval(() => { q(`DELETE FROM soc_stories WHERE created_at < NOW() - INTERVAL '25 hours'`).catch(() => {}); }, 30 * 60 * 1000).unref();

  /* ---------------- الحالة الكاملة: اقتراحات + أصدقاء + طلبات + محادثات + رسائل + إشعارات ---------------- */
  app.post('/api/soc/state', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    res.set('Cache-Control', 'no-store');
    q(`UPDATE sync_accounts SET last_seen=NOW() WHERE LOWER(email)=$1 AND last_seen < NOW() - INTERVAL '40 seconds'`, [u.email]).catch(() => {});
    const out = { me: u.uid };

    // الإشعارات غير المُسلَّمة (تُعلَّم كمُسلَّمة فوراً)
    out.notes = (await q(`UPDATE soc_notes SET delivered=TRUE WHERE email=$1 AND NOT delivered RETURNING id,kind,title,body`, [u.email])).rows;

    // العلاقات
    const rel = (await q(`SELECT id,a,b,status FROM soc_friends WHERE a=$1 OR b=$1`, [u.email])).rows;
    const relOf = {};
    rel.forEach((r) => {
      const o = r.a === u.email ? r.b : r.a;
      relOf[o] = r.status === 'accepted' ? { k: 'friend', id: r.id } : r.a === u.email ? { k: 'sent', id: r.id } : { k: 'recv', id: r.id };
    });
    const emails = Object.keys(relOf);

    // الرسائل غير المقروءة + آخر رسالة لكل محادثة
    const un = (await q(`SELECT f, COUNT(*)::int n FROM soc_msgs WHERE t=$1 AND NOT read GROUP BY f`, [u.email])).rows;
    const unread = {}; un.forEach((r) => { unread[r.f] = r.n; });
    out.unread = un.reduce((t, r) => t + r.n, 0);

    if (req.body.mode === 'light') return res.json(out);

    // سجل «تم قبول طلبك» لجرس قسم المستخدمين (آخر 30 يوماً)، يتزامن بين أجهزة الحساب الواحد
    out.hist = (await q(`SELECT id,kind,title,body,created_at FROM soc_notes WHERE email=$1 AND kind='friend_ok' AND created_at > NOW() - INTERVAL '30 days' ORDER BY id DESC LIMIT 30`, [u.email]))
      .rows.map((r) => ({ id: Number(r.id), kind: r.kind, title: r.title, body: r.body, t: new Date(r.created_at).getTime() }));

    const conv = (await q(
      `SELECT DISTINCT ON (o) o, body, created_at, f FROM (
         SELECT CASE WHEN f=$1 THEN t ELSE f END AS o, body, created_at, f, id FROM soc_msgs WHERE f=$1 OR t=$1
       ) m ORDER BY o, id DESC`, [u.email])).rows;

    // المقترحون: ترتيب ثابت بحسب تاريخ الانضمام (الأقدم أولاً) — الجديد في الذيل، ولا يتأثر بآخر ظهور
    const sug = (await q(
      `SELECT a.email,a.name,a.uid,a.last_seen,(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) AS av
       FROM sync_accounts a WHERE a.demo=FALSE AND COALESCE(a.blk,FALSE)=FALSE AND LOWER(a.email)<>$1
       ORDER BY a.created_at ASC, LOWER(a.email) ASC LIMIT 100`, [u.email])).rows;
    // أصدقاء/مراسلون/طلبات خارج أول 100 يجب أن يظهروا أيضاً
    const have = new Set(sug.map((r) => String(r.email).toLowerCase()));
    const extra = [...new Set([...emails, ...conv.map((c) => c.o)])].filter((e) => !have.has(e));
    const more = extra.length ? (await q(
      `SELECT a.email,a.name,a.uid,a.last_seen,(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) AS av
       FROM sync_accounts a WHERE LOWER(a.email)=ANY($1) AND a.demo=FALSE AND COALESCE(a.blk,FALSE)=FALSE`, [extra])).rows : [];

    const now = Date.now(), byEmail = {};
    const pvm = await privMap(sug.concat(more).map((r) => String(r.email).toLowerCase()));
    // يطبّق خصوصية الطرف الآخر: حالة الاتصال + إمكانية الصداقة + إمكانية المراسلة
    const flags = (em, rel, ls) => {
      const pv = pvOf(pvm, em), fr = rel === 'friend', show = allow(pv.online, fr);
      return { ls: show ? ls : 0, on: show && now - ls < ONLINE_MS, hid: show ? 0 : 1, cf: pv.friend_req === 'all' || rel !== 'none', cm: allow(pv.dm, fr) };
    };
    const card = (r) => {
      const em = String(r.email).toLowerCase(), ls = r.last_seen ? new Date(r.last_seen).getTime() : 0, rel = (relOf[em] || { k: 'none' }).k;
      return { uid: r.uid, name: r.name || em.split('@')[0], av: r.av ? Number(r.av) : 0, ...flags(em, rel, ls), rel, unread: unread[em] || 0, _e: em };
    };
    sug.concat(more).forEach((r) => { byEmail[String(r.email).toLowerCase()] = card(r); });
    const strip = (c) => { const { _e, ...x } = c; return x; };
    out.people = sug.map((r) => strip(byEmail[String(r.email).toLowerCase()]));
    out.friends = Object.values(byEmail).filter((c) => c.rel === 'friend').map(strip);
    out.incoming = Object.values(byEmail).filter((c) => c.rel === 'recv').map(strip);
    out.sent = Object.values(byEmail).filter((c) => c.rel === 'sent').map(strip);
    out.convos = conv.filter((c) => byEmail[c.o]).map((c) => ({
      ...strip(byEmail[c.o]), last: c.body.slice(0, 80), lt: new Date(c.created_at).getTime(), mine: c.f === u.email,
    })).sort((a, b) => b.lt - a.lt);

    // رسائل محادثة مفتوحة
    if (req.body.peer) {
      const p = await peer(req.body.peer);
      const after = Math.max(0, parseInt(req.body.after, 10) || 0);
      await q(`UPDATE soc_msgs SET read=TRUE WHERE t=$1 AND f=$2 AND NOT read`, [u.email, p.email]);
      const ms = (await q(
        `SELECT id,f,body,created_at FROM soc_msgs WHERE id>$3 AND ((f=$1 AND t=$2) OR (f=$2 AND t=$1)) ORDER BY id DESC LIMIT 200`, [u.email, p.email, after])).rows.reverse();
      out.msgs = ms.map((m) => ({ id: Number(m.id), mine: m.f === u.email, x: m.body, t: new Date(m.created_at).getTime() }));
      if (byEmail[p.email]) out.peer = strip(byEmail[p.email]);
      else {
        const rl = (relOf[p.email] || { k: 'none' }).k, pm = await privMap([p.email]), ls0 = (await q(`SELECT last_seen FROM sync_accounts WHERE LOWER(email)=$1`, [p.email])).rows[0];
        const l0 = ls0 && ls0.last_seen ? new Date(ls0.last_seen).getTime() : 0, pv = pvOf(pm, p.email), fr = rl === 'friend', sh = allow(pv.online, fr);
        out.peer = { uid: p.uid, name: p.name, av: 0, ls: sh ? l0 : 0, on: sh && now - l0 < ONLINE_MS, hid: sh ? 0 : 1, cf: pv.friend_req === 'all' || rl !== 'none', cm: allow(pv.dm, fr), rel: rl };
      }
    }
    res.json(out);
  }));

  /* ---------------- طلبات الصداقة ---------------- */
  app.post('/api/soc/friend/request', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    if (u.demo) fail(403, 'الحساب التجريبي لا يمكنه إضافة أصدقاء');
    if (p.email === u.email) fail(400, 'لا يمكنك إضافة نفسك');
    const ex = (await q(`SELECT id,a,status FROM soc_friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)`, [u.email, p.email])).rows[0];
    if (!ex && pvOf(await privMap([p.email]), p.email).friend_req !== 'all') fail(403, 'هذا المستخدم لا يستقبل طلبات الصداقة');
    if (ex) {
      if (ex.status === 'accepted') return res.json({ ok: true, rel: 'friend' });
      if (ex.a === u.email) return res.json({ ok: true, rel: 'sent' });
      // الطرف الآخر أرسل لك طلباً مسبقاً → موافقة مباشرة
      await q(`UPDATE soc_friends SET status='accepted',updated_at=NOW() WHERE id=$1`, [ex.id]);
      await note(p.email, 'friend_ok', 'تم قبول طلبك ✅', u.name + ' أصبح صديقك الآن، يمكنكما الدردشة');
      return res.json({ ok: true, rel: 'friend' });
    }
    const n = Number((await q(`SELECT COUNT(*)::int n FROM soc_friends WHERE a=$1 AND status='pending'`, [u.email])).rows[0].n);
    if (n >= 50) fail(400, 'وصلت للحد الأقصى من الطلبات المعلقة');
    await q(`INSERT INTO soc_friends(a,b) VALUES($1,$2)`, [u.email, p.email]);
    await note(p.email, 'friend_req', 'طلب صداقة جديد 👋', u.name + ' أرسل لك طلب صداقة');
    res.json({ ok: true, rel: 'sent' });
  }));

  app.post('/api/soc/friend/respond', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.from);
    const r = (await q(`SELECT id FROM soc_friends WHERE a=$1 AND b=$2 AND status='pending'`, [p.email, u.email])).rows[0];
    if (!r) fail(404, 'الطلب غير موجود');
    if (req.body.accept) {
      await q(`UPDATE soc_friends SET status='accepted',updated_at=NOW() WHERE id=$1`, [r.id]);
      await note(p.email, 'friend_ok', 'تم قبول طلبك ✅', u.name + ' وافق على طلب صداقتك، يمكنكما الدردشة الآن');
      return res.json({ ok: true, rel: 'friend' });
    }
    await q(`DELETE FROM soc_friends WHERE id=$1`, [r.id]);
    res.json({ ok: true, rel: 'none' });
  }));

  app.post('/api/soc/friend/cancel', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    await q(`DELETE FROM soc_friends WHERE a=$1 AND b=$2 AND status='pending'`, [u.email, p.email]);
    res.json({ ok: true });
  }));

  app.post('/api/soc/friend/remove', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    await q(`DELETE FROM soc_friends WHERE ((a=$1 AND b=$2) OR (a=$2 AND b=$1)) AND status='accepted'`, [u.email, p.email]);
    res.json({ ok: true });
  }));

  /* ---------------- الرسائل: مسموحة لأي مستخدم حتى لو لم يكن صديقاً ---------------- */
  app.post('/api/soc/dm/send', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    if (u.demo) fail(403, 'الحساب التجريبي لا يمكنه المراسلة');
    if (p.email === u.email) fail(400, 'لا يمكنك مراسلة نفسك');
    {
      const pv = pvOf(await privMap([p.email]), p.email);
      if (pv.dm !== 'all' && !allow(pv.dm, await isFriend(u.email, p.email))) fail(403, pv.dm === 'me' ? 'هذا المستخدم لا يستقبل الرسائل' : 'هذا المستخدم يستقبل الرسائل من أصدقائه فقط');
    }
    const body = txt(req.body.body, 500);
    if (!body) fail(400, 'الرسالة فارغة');
    const burst = Number((await q(`SELECT COUNT(*)::int n FROM soc_msgs WHERE f=$1 AND created_at > NOW() - INTERVAL '1 minute'`, [u.email])).rows[0].n);
    if (burst >= 30) fail(429, 'أرسلت رسائل كثيرة، انتظر قليلاً');
    const pend = Number((await q(`SELECT COUNT(*)::int n FROM soc_msgs WHERE f=$1 AND t=$2 AND NOT read`, [u.email, p.email])).rows[0].n);
    const ins = (await q(`INSERT INTO soc_msgs(f,t,body) VALUES($1,$2,$3) RETURNING id,created_at`, [u.email, p.email, body])).rows[0];
    // إشعار واحد فقط ما دام الطرف الآخر لم يقرأ رسائلك السابقة
    if (!pend) await note(p.email, 'dm', 'رسالة جديدة 💬', u.name + ': ' + (body.length > 60 ? body.slice(0, 60) + '…' : body));
    res.json({ ok: true, msg: { id: Number(ins.id), mine: true, x: body, t: new Date(ins.created_at).getTime() } });
  }));

  /* ---------------- إعدادات الخصوصية ---------------- */
  app.post('/api/soc/privacy/get', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, priv: pvOf(await privMap([u.email]), u.email), opts: PV_OPTS });
  }));
  app.post('/api/soc/privacy/set', lim, wrap(async (req, res) => {
    const u = await who(req.body), key = txt(req.body.key, 20), val = txt(req.body.val, 10);
    if (!PV_OPTS[key] || !PV_OPTS[key].includes(val)) fail(400, 'قيمة غير صالحة');
    await q(`INSERT INTO user_privacy(email,${key}) VALUES($1,$2) ON CONFLICT (email) DO UPDATE SET ${key}=$2, updated_at=NOW()`, [u.email, val]);
    res.json({ ok: true, priv: pvOf(await privMap([u.email]), u.email) });
  }));

  /* ---------------- الستوري (Stories): تختفي بعد 24 ساعة، وتظهر حسب خصوصية صاحبها ---------------- */
  const live = `s.created_at > NOW() - INTERVAL '24 hours'`;
  app.post('/api/soc/story/add', lim, wrap(async (req, res) => {
    const u = await who(req.body); if (u.demo) fail(403, 'الحساب التجريبي لا يمكنه نشر ستوري');
    const img = req.body.img ? String(req.body.img) : null, body = txt(req.body.body, 280);
    if (img && !isImg(img)) fail(400, 'الصورة غير صالحة أو كبيرة');
    if (!img && !body) fail(400, 'أضف صورة أو نصاً');
    const bg = BGS.includes(req.body.bg) ? req.body.bg : BGS[0];
    const n = Number((await q(`SELECT COUNT(*)::int n FROM soc_stories s WHERE s.email=$1 AND ${live}`, [u.email])).rows[0].n);
    if (n >= 20) fail(400, 'وصلت للحد الأقصى (20 ستوري خلال 24 ساعة)');
    const r = (await q(`INSERT INTO soc_stories(email,img,body,bg) VALUES($1,$2,$3,$4) RETURNING id`, [u.email, img, body, bg])).rows[0];
    res.json({ ok: true, id: Number(r.id) });
  }));

  app.post('/api/soc/story/list', lim, wrap(async (req, res) => {
    const u = await who(req.body); res.set('Cache-Control', 'no-store');
    const rows = (await q(
      `SELECT s.email, COUNT(*)::int n, (EXTRACT(EPOCH FROM MAX(s.created_at))*1000)::bigint ts,
              COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM soc_story_views v WHERE v.story_id=s.id AND v.viewer=$1))::int unseen
         FROM soc_stories s WHERE ${live} GROUP BY s.email`, [u.email])).rows;
    const mine = rows.find((r) => r.email === u.email);
    const others = rows.filter((r) => r.email !== u.email);
    const out = { mine: { n: mine ? mine.n : 0, ts: mine ? Number(mine.ts) : 0 }, items: [] };
    if (others.length) {
      const em = others.map((r) => r.email), pvm = await privMap(em), fs = await friendSet(u.email);
      const vis = others.filter((r) => allow(pvOf(pvm, r.email).stories, fs.has(r.email)));
      if (vis.length) {
        const acc = (await q(
          `SELECT LOWER(a.email) e,a.name,a.uid,(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email)) av
             FROM sync_accounts a WHERE LOWER(a.email)=ANY($1) AND a.demo=FALSE AND COALESCE(a.blk,FALSE)=FALSE`, [vis.map((r) => r.email)])).rows;
        const am = {}; acc.forEach((a) => { am[a.e] = a; });
        out.items = vis.filter((r) => am[r.email]).map((r) => ({
          uid: am[r.email].uid, name: am[r.email].name || r.email.split('@')[0], av: am[r.email].av ? Number(am[r.email].av) : 0,
          n: r.n, unseen: r.unseen, ts: Number(r.ts), friend: fs.has(r.email),
        })).sort((a, b) => (b.unseen > 0) - (a.unseen > 0) || b.ts - a.ts);
      }
    }
    res.json({ ok: true, ...out });
  }));

  app.post('/api/soc/story/view', lim, wrap(async (req, res) => {
    const u = await who(req.body); res.set('Cache-Control', 'no-store');
    const own = !req.body.uid || req.body.uid === u.uid;
    const p = own ? u : await peer(req.body.uid);
    if (!own) {
      const pv = pvOf(await privMap([p.email]), p.email);
      if (!allow(pv.stories, await isFriend(u.email, p.email))) fail(403, 'هذا الستوري غير متاح لك');
    }
    const rows = (await q(
      `SELECT s.id,s.img,s.body,s.bg,(EXTRACT(EPOCH FROM s.created_at)*1000)::bigint ts,
              (SELECT COUNT(*)::int FROM soc_story_views v WHERE v.story_id=s.id) views
         FROM soc_stories s WHERE s.email=$1 AND ${live} ORDER BY s.id ASC`, [p.email])).rows;
    if (!own && rows.length) {
      await q(`INSERT INTO soc_story_views(story_id,viewer) SELECT x,$2::text FROM unnest($1::bigint[]) x ON CONFLICT DO NOTHING`, [rows.map((r) => r.id), u.email]);
    }
    res.json({ ok: true, own, name: p.name, uid: p.uid, stories: rows.map((r) => ({ id: Number(r.id), img: r.img || '', x: r.body, bg: r.bg, t: Number(r.ts), ...(own ? { views: r.views } : {}) })) });
  }));

  app.post('/api/soc/story/delete', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    const r = await q(`DELETE FROM soc_stories WHERE id=$1 AND email=$2`, [parseInt(req.body.id, 10) || 0, u.email]);
    if (!r.rowCount) fail(404, 'الستوري غير موجود');
    res.json({ ok: true });
  }));

  /* ---------------- الإبلاغ عن مستخدم: يصل إلى «الإدارة المتقدمة ← البلاغات» وليس الدعم ---------------- */
  app.post('/api/soc/report', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    const reason = txt(req.body.reason, 100), details = txt(req.body.details, 1000);
    if (!reason) fail(400, 'اختر سبب البلاغ');
    const dup = (await q(`SELECT 1 FROM reports WHERE reporter=$1 AND target=$2 AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`, [u.email, p.email])).rows[0];
    if (dup) return res.json({ ok: true, dup: true });
    await q(`INSERT INTO reports(reporter,target,reason,details) VALUES($1,$2,$3,$4)`, [u.email, p.email, reason, details]);
    res.json({ ok: true });
  }));

  /* ---------------- صور الوكلاء المعتمدين (من صور حساباتهم) ----------------
     تُرجع فقط صور الحسابات الموجودة في قائمة الوكلاء المنشورة للمستخدمين */
  app.get('/api/soc/agent-avatars', wrap(async (_req, res) => {
    const c = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const ag = (c && c.val && Array.isArray(c.val.agents)) ? c.val.agents : [];
    const emails = [...new Set(ag.filter((o) => Array.isArray(o) && o[8]).map((o) => String(o[8]).trim().toLowerCase()))].slice(0, 300);
    const map = {};
    if (emails.length) {
      const r = (await q(
        `SELECT LOWER(a.email) AS e, a.uid, (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint AS av
           FROM sync_accounts a JOIN avatars v ON v.email=LOWER(a.email)
          WHERE LOWER(a.email)=ANY($1) AND a.uid IS NOT NULL`, [emails])).rows;
      r.forEach((x) => { map[x.e] = { uid: x.uid, av: Number(x.av) || 1 }; });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, map });
  }));

  /* ---------------- صورة المستخدم بالمعرّف العام ---------------- */
  app.get('/api/soc/avatar/:uid', wrap(async (req, res) => {
    const r = (await q(`SELECT v.img FROM avatars v JOIN sync_accounts a ON LOWER(a.email)=v.email WHERE a.uid=$1`, [txt(req.params.uid, 64)])).rows[0];
    const m = r && /^data:(image\/[a-z]+);base64,(.+)$/.exec(r.img);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
    res.end(Buffer.from(m[2], 'base64'));
  }));
};

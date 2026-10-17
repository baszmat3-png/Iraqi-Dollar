/* المرحلة 4 — المستخدمون الحقيقيون: اقتراحات صداقة (حتى 100) + طلبات صداقة فورية + إشعارات + مراسلة أي شخص
   كل شيء محفوظ في قاعدة البيانات ويتزامن بين الأجهزة. التعريف العام للمستخدم رقم عشوائي (uid) وليس البريد. */
const rateLimit = require('express-rate-limit');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const ONLINE_MS = 5 * 60 * 1000;

exports.parsers = (app, express) => {
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
    const card = (r) => {
      const em = String(r.email).toLowerCase(), ls = r.last_seen ? new Date(r.last_seen).getTime() : 0;
      return { uid: r.uid, name: r.name || em.split('@')[0], av: r.av ? Number(r.av) : 0, ls, on: now - ls < ONLINE_MS, rel: (relOf[em] || { k: 'none' }).k, unread: unread[em] || 0, _e: em };
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
      out.peer = byEmail[p.email] ? strip(byEmail[p.email]) : { uid: p.uid, name: p.name, av: 0, ls: 0, on: false, rel: (relOf[p.email] || { k: 'none' }).k };
    }
    res.json(out);
  }));

  /* ---------------- طلبات الصداقة ---------------- */
  app.post('/api/soc/friend/request', lim, wrap(async (req, res) => {
    const u = await who(req.body), p = await peer(req.body.to);
    if (u.demo) fail(403, 'الحساب التجريبي لا يمكنه إضافة أصدقاء');
    if (p.email === u.email) fail(400, 'لا يمكنك إضافة نفسك');
    const ex = (await q(`SELECT id,a,status FROM soc_friends WHERE (a=$1 AND b=$2) OR (a=$2 AND b=$1)`, [u.email, p.email])).rows[0];
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

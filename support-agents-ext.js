/**
 * support-agents-ext.js — مستخدمون مخصّصون للرد على رسائل الدعم
 *  لوحة التحكم (للمالك): GET /api/ctl/support-agents · POST /add {q} · POST /remove {email}
 *      GET /api/ctl/support-agents/threads?email= (المحادثات التي ردّ فيها) · GET /api/ctl/support-agents/thread?e=&after= (عرض فقط)
 *  التطبيق (بصمة المستخدم + يجب أن يكون معيَّناً): POST /api/u/sagent/me|threads|thread|reply
 * كل ردّ يُسجَّل باسم الموظف (support_msgs.agent) ليطّلع المالك على المحادثة بينهما.
 */
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail, rateLimit } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '20kb' });
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: true, legacyHeaders: false });
  const ready = (async () => {
    await q(`CREATE TABLE IF NOT EXISTS support_agents(email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q(`ALTER TABLE support_msgs ADD COLUMN IF NOT EXISTS agent TEXT`);
  })().catch((e) => console.error('support-agents schema:', e.message));
  app.use(['/api/ctl/support-agents', '/api/u/sagent'], (_req, _res, next) => ready.then(() => next(), next));

  async function agent(b) {
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const a = (await q(`SELECT email,name,blk FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h])).rows[0];
    if (!a || a.blk) fail(401, 'غير مسجّل الدخول');
    const ok = (await q(`SELECT 1 FROM support_agents WHERE email=$1`, [e])).rows[0];
    if (!ok) fail(403, 'لست معيَّناً للرد على الدعم');
    return { email: e, name: a.name || e.split('@')[0] };
  }
  const THREADS = `SELECT DISTINCT ON (LOWER(m.email)) m.email, m.body, (m.img IS NOT NULL) AS has_img, m.from_admin, m.created_at, m.agent,
      (SELECT COUNT(*)::int FROM support_msgs x WHERE LOWER(x.email)=LOWER(m.email) AND NOT x.from_admin AND NOT x.read_by_admin) AS unread,
      (SELECT name FROM sync_accounts a WHERE LOWER(a.email)=LOWER(m.email)) AS name
     FROM support_msgs m WHERE m.body NOT LIKE '🚩%' AND m.body NOT LIKE 'بلاغ%' `;
  const safeImg = (v) => (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) ? v : null);

  /* ---------------- التطبيق ---------------- */
  app.post('/api/u/sagent/me', lim, jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) return res.json({ ok: true, agent: false });
    const a = (await q(`SELECT 1 FROM sync_accounts s JOIN support_agents g ON g.email=LOWER(s.email) WHERE LOWER(s.email)=$1 AND s.pass_hash=$2`, [e, h])).rows[0];
    if (!a) return res.json({ ok: true, agent: false });
    const n = (await q(`SELECT COUNT(*)::int n FROM support_msgs WHERE NOT from_admin AND NOT read_by_admin AND body NOT LIKE '🚩%' AND body NOT LIKE 'بلاغ%'`)).rows[0].n;
    res.json({ ok: true, agent: true, unread: n });
  }));
  app.post('/api/u/sagent/threads', lim, jsonBody, wrap(async (req, res) => {
    await agent(req.body || {});
    const r = await q(THREADS + `ORDER BY LOWER(m.email), m.id DESC`);
    r.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ ok: true, threads: r.rows.slice(0, 300) });
  }));
  app.post('/api/u/sagent/thread', lim, jsonBody, wrap(async (req, res) => {
    await agent(req.body || {});
    const u = txt(req.body.user, 200), after = Math.max(0, parseInt(req.body.after, 10) || 0);
    if (!u) fail(400, 'حدد المستخدم');
    await q(`UPDATE support_msgs SET read_by_admin=TRUE WHERE LOWER(email)=LOWER($1) AND NOT from_admin AND NOT read_by_admin`, [u]);
    res.json({ ok: true, messages: (await q(`SELECT id,from_admin,body,img,created_at,agent FROM support_msgs WHERE LOWER(email)=LOWER($1) AND id>$2 ORDER BY id`, [u, after])).rows });
  }));
  app.post('/api/u/sagent/reply', lim, jsonBody, wrap(async (req, res) => {
    const me = await agent(req.body || {});
    const u = txt(req.body.user, 200), body = txt(req.body.body, 2000);
    if (!u || !body) fail(400, 'الرسالة فارغة');
    const t = (await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=LOWER($1)`, [u])).rows[0];
    if (!t) fail(404, 'المستخدم غير موجود');
    await q(`INSERT INTO support_msgs(email,from_admin,body,read_by_admin,agent) VALUES($1,TRUE,$2,TRUE,$3)`, [t.email, body, me.email]);
    await q(`INSERT INTO notices(email,body) VALUES($1,$2)`, [t.email, '💬 ردّ الدعم الفني: ' + (body.length > 80 ? body.slice(0, 80) + '…' : body)]).catch(() => {});
    res.json({ ok: true });
  }));

  /* ---------------- لوحة التحكم (مالك فقط: مسار غير مصنّف) ---------------- */
  app.get('/api/ctl/support-agents', ...ctl, wrap(async (_req, res) => {
    const r = await q(`SELECT g.email, g.created_at, a.name, a.phone,
        (SELECT COUNT(*)::int FROM support_msgs m WHERE m.agent=g.email) AS replies,
        (SELECT COUNT(DISTINCT LOWER(m.email))::int FROM support_msgs m WHERE m.agent=g.email) AS users,
        (SELECT MAX(m.created_at) FROM support_msgs m WHERE m.agent=g.email) AS last
      FROM support_agents g LEFT JOIN sync_accounts a ON LOWER(a.email)=g.email ORDER BY g.created_at DESC`);
    res.json({ ok: true, agents: r.rows });
  }));
  app.post('/api/ctl/support-agents/add', ...ctl, jsonBody, wrap(async (req, res) => {
    const k = txt((req.body || {}).q, 200).toLowerCase(); if (!k) fail(400, 'اكتب بريد المستخدم أو رقم هاتفه');
    const a = (await q(`SELECT email,name FROM sync_accounts WHERE LOWER(email)=$1 OR phone=$1 LIMIT 1`, [k])).rows[0];
    if (!a) fail(404, 'لا يوجد مستخدم بهذا البريد/الرقم');
    await q(`INSERT INTO support_agents(email) VALUES($1) ON CONFLICT DO NOTHING`, [String(a.email).toLowerCase()]);
    try { if (app.locals.notify) app.locals.notify(a.email, 'أصبحت موظف دعم 🎧', 'يمكنك الرد على رسائل المستخدمين من أيقونة «رسائل الدعم» داخل التطبيق.', 'support'); } catch (_) { /* اختياري */ }
    res.json({ ok: true, email: a.email, name: a.name });
  }));
  app.post('/api/ctl/support-agents/remove', ...ctl, jsonBody, wrap(async (req, res) => {
    await q(`DELETE FROM support_agents WHERE email=$1`, [txt((req.body || {}).email, 200).toLowerCase()]);
    res.json({ ok: true });
  }));
  app.get('/api/ctl/support-agents/threads', ...ctl, wrap(async (req, res) => {
    const e = txt(req.query.email, 200).toLowerCase();
    const r = await q(`SELECT m.email, COUNT(*)::int n, MAX(m.created_at) last, MAX(a.name) name,
        (SELECT body FROM support_msgs z WHERE z.agent=$1 AND LOWER(z.email)=LOWER(m.email) ORDER BY z.id DESC LIMIT 1) AS lastbody
      FROM support_msgs m LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(m.email) WHERE m.agent=$1 GROUP BY m.email ORDER BY last DESC LIMIT 200`, [e]);
    res.json({ ok: true, threads: r.rows });
  }));
  app.get('/api/ctl/support-agents/thread', ...ctl, wrap(async (req, res) => {
    const e = txt(req.query.e, 200);
    res.json({ ok: true, messages: (await q(`SELECT m.id,m.from_admin,m.body,m.img,m.created_at,m.agent,(SELECT name FROM sync_accounts a WHERE LOWER(a.email)=LOWER(m.agent)) AS agent_name FROM support_msgs m WHERE LOWER(m.email)=LOWER($1) ORDER BY m.id DESC LIMIT 300`, [e])).rows.reverse() });
  }));
};

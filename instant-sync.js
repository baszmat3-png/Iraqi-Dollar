/**
 * instant-sync.js — بث فوري للأوامر عبر Server-Sent Events (SSE)
 *  GET /api/sync/stream        : يتصل به التطبيق ويستلم الأوامر لحظياً
 *  GET /api/ctl/find-code      : بحث عن حساب بكود الإحالة أو البريد (يحتاج X-Admin-Key)
 *
 * البث يتم من مصدرين معاً:
 *  1) مباشرة من /api/ctl/cmd عبر app.locals.broadcastCmd (أسرع مسار)
 *  2) مراقب خفيف يفحص sync_cmds كل ثانية فيبث أي أمر أُدخل من ملفات أخرى (التجار/الإدارة...)
 */
module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;
  const MAX_CLIENTS = 4000;
  // أوامر تخص مستخدماً بعينه (أرصدة/عدادات): لا تُرسل إلا لصاحبها المُوثَّق، والبقية تصلهم إشارة فارغة فقط
  const PERSONAL = new Set(['adj', 'set', 'gc', 'rz', 'rc']);
  const authEmail = async (e, h) => {
    e = String(e || '').trim().toLowerCase().slice(0, 120); h = String(h || '').slice(0, 200);
    if (!e || !h) return '';
    try { const r = await pool.query('SELECT 1 FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2', [e, h]); return r.rowCount ? e : ''; } catch (x) { return ''; }
  };
  app.locals.authEmail = authEmail;

  // تذكرة بث لمرة واحدة: بدل وضع بصمة كلمة المرور في عنوان الطلب (كانت تُسجَّل في سجلات الوسطاء)
  const TICKETS = new Map(); // ticket -> { email, exp }
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch (x) { return String(v || ''); } };
  setInterval(() => { const n = Date.now(); for (const [k, v] of TICKETS) if (v.exp < n) TICKETS.delete(k); }, 30000).unref();
  app.post('/api/sync/stream-ticket', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const email = await authEmail(dec(req.get('x-e')), req.get('x-h'));
    if (!email) return res.status(401).json({ error: 'auth' });
    if (TICKETS.size > 50000) TICKETS.clear();
    const t = require('crypto').randomBytes(24).toString('hex');
    TICKETS.set(t, { email, exp: Date.now() + 60000 });
    res.json({ t });
  }));
  const redeem = (t) => { const v = TICKETS.get(String(t || '')); if (!v) return ''; TICKETS.delete(String(t)); return v.exp >= Date.now() ? v.email : ''; };
  const clients = new Set();
  const sent = new Set();
  let watermark = null;

  app.get('/api/sync/stream', async (req, res) => {
    if (clients.size >= MAX_CLIENTS) return res.status(503).end();
    const verified = req.query.t ? redeem(req.query.t) : ''; // بلا تذكرة صالحة = بث عام فقط (لا أوامر شخصية)
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (req.socket) { req.socket.setTimeout(0); req.socket.setNoDelay(true); }
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('retry: 2000\n\n: connected\n\n');

    const email = verified; // بريد غير موثَّق = لا يستلم أوامر الآخرين الشخصية
    const client = { res, email };
    clients.add(client);
    if (email) { try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (e) { /* اختياري */ } }

    pool.query('SELECT COALESCE(MAX(id),0) AS m FROM sync_cmds')
      .then((r) => {
        const max = Number(r.rows[0].m) || 0;
        if (watermark === null) watermark = max; // تثبيت نقطة المراقبة لحظة أول اتصال
        try { res.write('event: hello\ndata: ' + JSON.stringify({ max }) + '\n\n'); } catch (e) {}
      })
      .catch(() => {});

    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { cleanup(); } }, 20000);
    const cleanup = () => {
      clearInterval(ping);
      clients.delete(client);
      if (!clients.size) watermark = null;
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
  });

  function broadcast(id, body) {
    const full = 'event: cmd\ndata: ' + JSON.stringify({ id, body }) + '\n\n';
    const redacted = 'event: cmd\ndata: ' + JSON.stringify({ id, body: { t: 'ping' } }) + '\n\n';
    const target = body && body.e ? String(body.e).toLowerCase() : '';
    const personal = !!(body && PERSONAL.has(body.t));
    let n = 0;
    clients.forEach((c) => {
      let msg = full;
      if (personal) { if (!(c.email && c.email === target)) msg = redacted; }
      else if (target && c.email && c.email !== target) return;
      try { c.res.write(msg); n++; } catch (e) { clients.delete(c); }
    });
    sent.add(Number(id));
    if (sent.size > 5000) sent.clear();
    return n;
  }
  app.locals.broadcastCmd = broadcast;
  // دفع فوري عند نشر الإعدادات (الأخبار/العروض/الأقسام...) بدل انتظار الفحص الدوري
  app.locals.broadcastCfg = () => {
    clients.forEach((c) => { try { c.res.write('event: cfg\ndata: {}\n\n'); } catch (e) { clients.delete(c); } });
  };

  // رصيد حساب تغيّر على السيرفر: أبلِغ كل أجهزة صاحبه المتصلة (تطبيق + متصفح...) ليسحب كل جهاز رصيده الجديد فوراً
  app.locals.pushBal = (email, bal) => {
    const target = String(email || '').toLowerCase();
    if (!target) return 0;
    const msg = 'event: bal\ndata: ' + JSON.stringify(bal || {}) + '\n\n';
    let n = 0;
    clients.forEach((c) => {
      if (c.email !== target) return;
      try { c.res.write(msg); n++; } catch (e) { clients.delete(c); }
    });
    return n;
  };
  // بريد كل من له اتصال موثَّق الآن (يستخدمه بثّ الأرصدة لمراقبة حساباتهم فقط)
  app.locals.sseEmails = () => { const o = new Set(); clients.forEach((c) => { if (c.email) o.add(c.email); }); return [...o]; };

  // دفع فوري لأحداث المتجر: k='stock' (المخزون الجديد لبطاقة) / k='order' (تغيّر طلب مستخدم). email اختياري لاستهداف حساب واحد
  app.locals.broadcastStore = (payload, email) => {
    const msg = 'event: store\ndata: ' + JSON.stringify(payload || {}) + '\n\n';
    const target = email ? String(email).toLowerCase() : '';
    let n = 0;
    clients.forEach((c) => {
      if (target && c.email !== target) return;
      try { c.res.write(msg); n++; } catch (e) { clients.delete(c); }
    });
    return n;
  };

  let busy = false;
  setInterval(async () => {
    if (busy || !clients.size) return;
    busy = true;
    try {
      if (watermark === null) {
        watermark = Number((await pool.query('SELECT COALESCE(MAX(id),0) AS m FROM sync_cmds')).rows[0].m) || 0;
      } else {
        const r = await pool.query('SELECT id, body FROM sync_cmds WHERE id>$1 ORDER BY id LIMIT 200', [watermark]);
        for (const row of r.rows) {
          watermark = Number(row.id);
          if (sent.has(watermark)) sent.delete(watermark);
          else broadcast(watermark, row.body);
        }
      }
    } catch (e) { /* يعاود المحاولة بعد ثانية */ }
    busy = false;
  }, 1000);

  /* ---------- البحث بكود الإحالة أو البريد (للإدارة) ---------- */
  app.get('/api/ctl/find-code', ...ctl, wrap(async (req, res) => {
    const raw = String(req.query.code || '').trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    if (!raw) fail(400, 'أدخل كود الإحالة أو البريد');
    const code = raw.toUpperCase();
    const mail = raw.toLowerCase();
    const COLS = 'email,name,phone,pts,gems,usd,blk,kyc,vml,last_seen,rcode';

    let rows = (await pool.query(
      `SELECT ${COLS} FROM sync_accounts WHERE UPPER(COALESCE(rcode,''))=$1 OR LOWER(email)=$2 LIMIT 10`, [code, mail])).rows;

    if (!rows.length) { // أرقام الإحالة المميزة المنشورة من لوحة الإدارة
      try {
        const kv = await pool.query(`SELECT val->'rcx' AS rcx FROM sync_kv WHERE key='config'`);
        const rcx = (kv.rows[0] && kv.rows[0].rcx) || {};
        const em = Object.keys(rcx).find((k) => String(rcx[k]).toUpperCase() === code);
        if (em) rows = (await pool.query(`SELECT ${COLS} FROM sync_accounts WHERE LOWER(email)=$1 LIMIT 1`, [em.toLowerCase()])).rows;
      } catch (e) { /* تجاهل */ }
    }
    if (!rows.length) { // الحسابات القديمة في جدول users
      try {
        rows = (await pool.query(
          `SELECT email,name,phone,pts,gems,usd,banned AS blk,(kyc>0) AS kyc,ref_code AS rcode
           FROM users WHERE UPPER(COALESCE(ref_code,''))=$1 OR LOWER(email)=$2 LIMIT 10`, [code, mail])).rows;
      } catch (e) { /* تجاهل */ }
    }
    if (!rows.length) fail(404, 'لا يوجد حساب بهذا الكود أو البريد');
    const fix = (u) => ({ ...u, pts: Number(u.pts) || 0, gems: Number(u.gems) || 0, usd: Number(u.usd) || 0 });
    res.json({ ok: true, user: fix(rows[0]), users: rows.map(fix) });
  }));

  console.log('instant-sync: SSE + find-code جاهزة');
};

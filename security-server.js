/**
 * security-server.js — بصمة الجهاز + كشف VPN + تلاعب الوقت + حد الأجهزة
 *  POST /api/security/beacon                 : من التطبيق (بدون تسجيل دخول)
 *  GET  /api/ctl/security/config|alerts|devices   : للإدارة (X-Admin-Key)
 *  POST /api/ctl/security/config|alerts/:id/read|alerts/read-all|device/ban|device/remove
 * الجداول user_devices و security_alerts معرّفة في db.js
 */
module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;

  /* ---------- IP / VPN ---------- */
  const ipCache = new Map();
  const IP_TTL = 24 * 60 * 60 * 1000;
  const isPrivate = (ip) => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip);

  async function checkIp(ip) {
    if (isPrivate(ip)) return { country: '', isVpn: false };
    const c = ipCache.get(ip);
    if (c && Date.now() - c.t < IP_TTL) return c;
    const res = { country: '', isVpn: false, t: Date.now() };
    try {
      const r = await fetch('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,countryCode,proxy,hosting',
        { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        const j = await r.json();
        if (j.status === 'success') { res.country = j.countryCode || ''; res.isVpn = !!(j.proxy || j.hosting); }
      }
    } catch (e) { /* خدمة خارجية: عند الفشل لا نعتبره VPN */ }
    if (ipCache.size > 20000) ipCache.clear();
    ipCache.set(ip, res);
    return res;
  }
  const realIp = (req) => String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || '').trim();

  /* ---------- الإعدادات (مخزنة مؤقتاً 30 ثانية) ---------- */
  let cfgCache = null, cfgAt = 0;
  async function getConfig(force) {
    if (!force && cfgCache && Date.now() - cfgAt < 30000) return cfgCache;
    const r = await pool.query(`SELECT val FROM sync_kv WHERE key='security'`);
    const v = (r.rowCount && r.rows[0].val) || {};
    cfgCache = {
      maxDevices: Math.max(1, Math.min(+v.maxDevices || 2, 20)),
      enforce: v.enforce === true,
      blockVpn: v.blockVpn === true,
      blockTimeTamper: v.blockTimeTamper === true,
    };
    cfgAt = Date.now();
    return cfgCache;
  }

  async function pushAlert(kind, email, meta) {
    try {
      const recent = await pool.query(
        `SELECT 1 FROM security_alerts WHERE kind=$1 AND email=$2 AND created_at > NOW() - INTERVAL '1 hour' LIMIT 1`, [kind, email]);
      if (recent.rowCount) return;
      await pool.query(`INSERT INTO security_alerts(kind,email,meta) VALUES($1,$2,$3)`, [kind, email, JSON.stringify(meta || {})]);
    } catch (e) { /* لا نفشل الطلب بسبب التنبيه */ }
  }

  /* ---------- beacon ---------- */
  const lastBeacon = new Map();
  app.post('/api/security/beacon', wrap(async (req, res) => {
    const serverTime = Date.now();
    const b = req.body || {};
    const fp = String(b.fp || '').slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const out = { serverTime, deviceCount: 0, block: false };
    if (!fp) return res.json(out);

    const key = fp + '|' + email;
    if (serverTime - (lastBeacon.get(key) || 0) < 15000) return res.json(out); // حماية من الإغراق
    lastBeacon.set(key, serverTime);
    if (lastBeacon.size > 50000) lastBeacon.clear();

    const ip = realIp(req);
    const ua = String(b.ua || req.headers['user-agent'] || '').slice(0, 400);
    const tz = String(b.tz || '').slice(0, 60);
    const clientTime = Number(b.clientTime) || 0;
    const flags = (Array.isArray(b.flags) ? b.flags : []).slice(0, 10);
    const cfg = await getConfig();

    const drift = clientTime ? Math.abs(serverTime - clientTime) : 0;
    const timeTampered = drift > 120000 || flags.some((f) => f && f.type === 'time_jump');
    const ipInfo = await checkIp(ip);

    let deviceCount = 0, banned = false, over = false;
    if (email) {
      try {
        await pool.query(
          `INSERT INTO user_devices(email,fingerprint,ua,ip,country,tz,is_vpn)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (email,fingerprint) DO UPDATE SET last_seen=NOW(), ua=EXCLUDED.ua, ip=EXCLUDED.ip,
             country=EXCLUDED.country, tz=EXCLUDED.tz, is_vpn=EXCLUDED.is_vpn`,
          [email, fp, ua, ip, ipInfo.country, tz, !!ipInfo.isVpn]);
        const rows = (await pool.query(
          `SELECT fingerprint, banned FROM user_devices WHERE email=$1 ORDER BY first_seen ASC, id ASC`, [email])).rows;
        deviceCount = rows.length;
        const idx = rows.findIndex((r) => r.fingerprint === fp);
        banned = idx >= 0 && rows[idx].banned === true;
        over = idx >= cfg.maxDevices; // الأجهزة الأولى تبقى مسموحة، الزائدة فقط تُحجب
      } catch (e) { console.error('security devices:', e.message); }
    }
    out.deviceCount = deviceCount;

    if (email && deviceCount > cfg.maxDevices)
      await pushAlert('multi_device', email, { count: deviceCount, max: cfg.maxDevices, fp: fp.slice(0, 10), ip, country: ipInfo.country });
    if (email && timeTampered) await pushAlert('time_tamper', email, { drift, fp: fp.slice(0, 10), ip });
    if (email && ipInfo.isVpn) await pushAlert('vpn', email, { ip, country: ipInfo.country, fp: fp.slice(0, 10) });

    if (banned) { out.block = true; out.reason = 'تم إيقاف هذا الجهاز من الإدارة. تواصل مع الدعم.'; }
    else if (cfg.blockVpn && ipInfo.isVpn) { out.block = true; out.reason = 'لا يمكن استخدام التطبيق عبر VPN أو Proxy. أوقفه ثم أعد المحاولة.'; }
    else if (cfg.blockTimeTamper && timeTampered) { out.block = true; out.reason = 'تم اكتشاف تغيير في ساعة الجهاز. فعّل الضبط التلقائي للوقت ثم أعد المحاولة.'; }
    else if (cfg.enforce && over) { out.block = true; out.reason = 'حسابك مسجّل على ' + deviceCount + ' أجهزة والحد الأقصى ' + cfg.maxDevices + '. تواصل مع الدعم لإزالة الأجهزة القديمة.'; }
    res.json(out);
  }));

  /* ---------- الإدارة ---------- */
  app.get('/api/ctl/security/alerts', ...ctl, wrap(async (req, res) => {
    const limit = Math.min(+req.query.limit || 100, 500);
    const alerts = (await pool.query(
      `SELECT id,kind,email,meta,is_read,created_at FROM security_alerts ORDER BY id DESC LIMIT $1`, [limit])).rows;
    const unread = (await pool.query(`SELECT COUNT(*)::int AS n FROM security_alerts WHERE is_read=FALSE`)).rows[0].n;
    res.json({ alerts, unread });
  }));
  app.post('/api/ctl/security/alerts/read-all', ...ctl, wrap(async (_req, res) => {
    await pool.query(`UPDATE security_alerts SET is_read=TRUE WHERE is_read=FALSE`);
    res.json({ ok: true });
  }));
  app.post('/api/ctl/security/alerts/:id/read', ...ctl, wrap(async (req, res) => {
    await pool.query(`UPDATE security_alerts SET is_read=TRUE WHERE id=$1`, [+req.params.id || 0]);
    res.json({ ok: true });
  }));

  app.get('/api/ctl/security/devices', ...ctl, wrap(async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (email) {
      const devices = (await pool.query(`SELECT * FROM user_devices WHERE email=$1 ORDER BY first_seen ASC`, [email])).rows;
      return res.json({ devices });
    }
    const users = (await pool.query(
      `SELECT email, COUNT(*)::int AS n, MAX(last_seen) AS last_seen FROM user_devices
       GROUP BY email HAVING COUNT(*)>1 ORDER BY n DESC, MAX(last_seen) DESC LIMIT 200`)).rows;
    res.json({ users });
  }));

  app.post('/api/ctl/security/device/ban', ...ctl, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fp = String(req.body.fp || '');
    if (!email || !fp) fail(400, 'بيانات ناقصة');
    await pool.query(`UPDATE user_devices SET banned=$3 WHERE email=$1 AND fingerprint=$2`, [email, fp, req.body.banned !== false]);
    res.json({ ok: true });
  }));
  app.post('/api/ctl/security/device/remove', ...ctl, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fp = String(req.body.fp || '');
    if (!email || !fp) fail(400, 'بيانات ناقصة');
    await pool.query(`DELETE FROM user_devices WHERE email=$1 AND fingerprint=$2`, [email, fp]);
    res.json({ ok: true });
  }));

  app.get('/api/ctl/security/config', ...ctl, wrap(async (_req, res) => res.json(await getConfig(true))));
  app.post('/api/ctl/security/config', ...ctl, wrap(async (req, res) => {
    const b = req.body || {};
    const val = {
      maxDevices: Math.max(1, Math.min(+b.maxDevices || 2, 20)),
      enforce: !!b.enforce, blockVpn: !!b.blockVpn, blockTimeTamper: !!b.blockTimeTamper,
    };
    await pool.query(
      `INSERT INTO sync_kv(key,val,updated_at) VALUES('security',$1,NOW())
       ON CONFLICT (key) DO UPDATE SET val=EXCLUDED.val, updated_at=NOW()`, [JSON.stringify(val)]);
    await getConfig(true);
    res.json({ ok: true, config: val });
  }));

  console.log('security-server: beacon + تنبيهات + أجهزة جاهزة');
};

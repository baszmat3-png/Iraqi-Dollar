/**
 * rooms-ext.js — الرومات الصوتية
 *  - شراء روم ومايكات إضافية بالنقاط (الأسعار من لوحة التحكم)
 *  - صاحب الروم والمشرفون يتحكمون بمن يصعد للمايك / الكتم / الطرد / الحظر
 *  - هدايا داخل الروم: نسبة لصاحب الروم + نسبة تُوزَّع بالتساوي على من بالروم (تُضبط من لوحة التحكم)
 *  - بث فوري عبر SSE + تمرير إشارات WebRTC (الصوت نفسه يمر بين الأجهزة مباشرة)
 *  - موسيقى خلفية متزامنة (رابط صوتي أو من مكتبة الإدارة)
 *  - الأرباح: شراء الروم + رسوم المايكات + حصة التطبيق من الهدايا تُسجَّل في دفتر «المالية» (fin_ev) فتدخل في أرباح صاحب التطبيق
 *  - الإشارات: طابور لكل عضو + دفعات (sigb) كي لا تضيع إشارة الاتصال قبل ربط البث
 *
 *  GET  /api/rooms/config      : الأسعار والنسب + خوادم ICE
 *  GET  /api/rooms/list        : الرومات النشطة
 *  POST /api/rooms/mine|create|update|buy-mic|close|join|leave|act|gift
 *  GET  /api/rooms/stream?tok= : بث الأحداث (SSE)
 *  /api/ctl/rooms*             : لوحة التحكم (X-Admin-Key)
 */
const crypto = require('crypto');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const clean = (v, n) => txt(v, n).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
const num = (v, d, lo, hi) => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const NTHEMES = 8;

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '96kb' });

  /* ======================= قاعدة البيانات ======================= */
  const ddl = [
    `CREATE TABLE IF NOT EXISTS rooms(
       id SERIAL PRIMARY KEY, owner_email TEXT NOT NULL, name TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '',
       emoji TEXT NOT NULL DEFAULT '🎙️', theme INT NOT NULL DEFAULT 0, mics INT NOT NULL DEFAULT 2,
       pin TEXT NOT NULL DEFAULT '', open_mic BOOLEAN NOT NULL DEFAULT FALSE, welcome TEXT NOT NULL DEFAULT '',
       active BOOLEAN NOT NULL DEFAULT TRUE, gifts_total BIGINT NOT NULL DEFAULT 0, owner_earn BIGINT NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_active TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS rooms_owner_idx ON rooms(LOWER(owner_email))`,
    `CREATE TABLE IF NOT EXISTS room_admins(room_id INT NOT NULL, email TEXT NOT NULL, PRIMARY KEY(room_id,email))`,
    `CREATE TABLE IF NOT EXISTS room_bans(room_id INT NOT NULL, email TEXT NOT NULL, PRIMARY KEY(room_id,email))`,
    `CREATE TABLE IF NOT EXISTS room_gift_log(
       id BIGSERIAL PRIMARY KEY, room_id INT NOT NULL, from_email TEXT NOT NULL, gift_id INT, name TEXT NOT NULL, emoji TEXT NOT NULL,
       price BIGINT NOT NULL, qty INT NOT NULL, total BIGINT NOT NULL, owner_cut BIGINT NOT NULL DEFAULT 0,
       aud_cut BIGINT NOT NULL DEFAULT 0, aud_n INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS room_music(
       id SERIAL PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, sort INT NOT NULL DEFAULT 0)`,
    `ALTER TABLE room_music ADD COLUMN IF NOT EXISTS cat TEXT NOT NULL DEFAULT 'other'`,
    `CREATE TABLE IF NOT EXISTS room_music_files(id SERIAL PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS room_settings(k TEXT PRIMARY KEY, v JSONB NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS room_sales(
       id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, room_id INT, kind TEXT NOT NULL, pts BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS room_sales_room_idx ON room_sales(room_id)`,
    `CREATE INDEX IF NOT EXISTS room_gift_log_room_idx ON room_gift_log(room_id)`,
  ];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---- ربط الأرباح بدفتر المالية (fin_ev): دينار لكل نقطة من إعدادات التطبيق ---- */
  async function ptRate(cl) {
    const r = (await (cl || pool).query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const c = (r && r.val && r.val.cfg) || {};
    return (Number(c.agRate) > 0 ? Number(c.agRate) : 132) / 1000;
  }
  async function finIn(cl, uid, email, cat, pts, note) {
    pts = Math.floor(Number(pts) || 0); if (!(pts > 0)) return;
    await cl.query('SAVEPOINT fin_sp'); // تسجيل الأرباح لا يجوز أن يُفشل عملية الشراء نفسها
    try {
      const pr = await ptRate(cl);
      await cl.query(`INSERT INTO fin_ev(uid,email,kind,cat,pts,iqd,note,src) VALUES($1,$2,'in',$3,$4,$5,$6,'auto') ON CONFLICT DO NOTHING`,
        [uid, email, cat, pts, Math.round(pts * pr * 100) / 100, txt(note, 80)]);
      await cl.query('RELEASE SAVEPOINT fin_sp');
    } catch (e) { console.error('rooms-ext fin log:', e.message); await cl.query('ROLLBACK TO SAVEPOINT fin_sp'); }
  }
  async function backfillFin() { // يملأ ما فات من مبيعات وهدايا الرومات السابقة (آمن للتكرار)
    const pr = await ptRate();
    await q(`INSERT INTO fin_ev(uid,ts,email,kind,cat,pts,iqd,note,src)
      SELECT 'rm:s:'||s.id, s.created_at, s.email, 'in', CASE WHEN s.kind='create' THEN 'room_create' ELSE 'room_mic' END, s.pts,
             ROUND((s.pts*$1::numeric),2), CASE WHEN s.kind='create' THEN 'شراء روم' ELSE 'رسوم مايك روم' END, 'auto'
        FROM room_sales s WHERE s.pts>0 ON CONFLICT DO NOTHING`, [pr]);
    await q(`INSERT INTO fin_ev(uid,ts,email,kind,cat,pts,iqd,note,src)
      SELECT 'rm:g:'||g.id, g.created_at, g.from_email, 'in', 'room_gift', (g.total-g.owner_cut-g.aud_cut),
             ROUND(((g.total-g.owner_cut-g.aud_cut)*$1::numeric),2), 'حصة التطبيق من هدية روم', 'auto'
        FROM room_gift_log g WHERE (g.total-g.owner_cut-g.aud_cut)>0 ON CONFLICT DO NOTHING`, [pr]);
  }
  const ready = (async () => {
    for (let t = 0; t < 10; t++) {
      try { for (const s of ddl) await q(s); break; }
      catch (e) { if (t === 9) throw e; await sleep(1500); }
    }
    for (let t = 0; t < 6; t++) {
      try { await backfillFin(); break; }
      catch (e) { if (t === 5) console.error('rooms-ext fin backfill:', e.message); else await sleep(2500); }
    }
  })().catch((e) => console.error('rooms-ext schema:', e.message));
  app.use(['/api/rooms', '/api/ctl/rooms'], (_req, _res, next) => ready.then(() => next(), next));

  /* ======================= الإعدادات ======================= */
  const DEF = { enabled: true, createPrice: 250000, baseMics: 2, maxMics: 8, micPrice: 100000, maxMembers: 40, ownerPct: 20, audPct: 50, maxOwned: 1, chatCooldown: 1 };
  async function cfg() {
    const r = (await q(`SELECT v FROM room_settings WHERE k='cfg'`)).rows[0];
    const v = Object.assign({}, DEF, (r && r.v) || {});
    v.enabled = v.enabled !== false;
    v.createPrice = num(v.createPrice, DEF.createPrice, 0, 1e12);
    v.micPrice = num(v.micPrice, DEF.micPrice, 0, 1e12);
    v.baseMics = num(v.baseMics, 2, 1, 12);
    v.maxMics = Math.max(v.baseMics, num(v.maxMics, 8, 1, 12));
    v.maxMembers = num(v.maxMembers, 40, 2, 200);
    v.ownerPct = num(v.ownerPct, 20, 0, 100);
    v.audPct = num(v.audPct, 50, 0, 100);
    if (v.ownerPct + v.audPct > 100) v.audPct = 100 - v.ownerPct;
    v.maxOwned = num(v.maxOwned, 1, 1, 20);
    return v;
  }
  function iceServers() {
    try { if (process.env.ROOMS_ICE_SERVERS) return JSON.parse(process.env.ROOMS_ICE_SERVERS); } catch (_) {}
    const s = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
    if (process.env.TURN_URL) {
      const urls = process.env.TURN_URL.split(',').map((x) => x.trim()).filter(Boolean);
      if (process.env.TURN_SECRET) { // coturn (use-auth-secret): بيانات دخول مؤقتة 12 ساعة
        const user = String(Math.floor(Date.now() / 1000) + 43200);
        s.push({ urls, username: user, credential: crypto.createHmac('sha1', process.env.TURN_SECRET).update(user).digest('base64') });
      } else s.push({ urls, username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
    }
    return s;
  }

  /* ======================= الحالة الحيّة (في الذاكرة) ======================= */
  const live = new Map(); // roomId -> L
  const byTok = new Map(); // tok -> {L, m}
  const uidOf = new Map(); // email -> roomId (غرفة واحدة لكل مستخدم)

  const roleOf = (L, email) => (email === L.row.owner ? 'owner' : L.admins.has(email) ? 'admin' : 'member');
  const isMod = (L, email) => { const r = roleOf(L, email); return r === 'owner' || r === 'admin'; };

  function write(m, ev, data) {
    if (!m.res) return;
    try { m.res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  }
  function deliver(m, payload) { // إن لم يتصل بث العضو بعد نحفظ الإشارة ونُسلّمها فور اتصاله (كانت تضيع فيصمت الصوت)
    if (m.res) return write(m, 'sig', payload);
    const q2 = m.sq || (m.sq = []);
    if (q2.length > 150) q2.shift();
    q2.push({ p: payload, t: Date.now() });
  }
  function bcast(L, ev, data, except) { L.members.forEach((m) => { if (m.email !== except) write(m, ev, data); }); }
  function snapshot(L) {
    const mic = new Map(); L.mics.forEach((s, i) => { if (s.email) mic.set(s.email, i); });
    return {
      room: {
        id: L.row.id, name: L.row.name, descr: L.row.descr, emoji: L.row.emoji, theme: L.row.theme, mics: L.mics.length,
        openMic: L.row.open_mic, welcome: L.row.welcome, locked: !!L.row.pin, ownerUid: L.ownerUid, music: L.music,
      },
      members: [...L.members.values()].map((m) => ({
        uid: m.uid, name: m.name, av: m.av || 0, j: m.joined, role: roleOf(L, m.email), hand: L.hands.has(m.email),
        mic: mic.has(m.email) ? mic.get(m.email) : -1, muted: L.muted.has(m.email),
      })),
      mics: L.mics.map((s) => ({ uid: s.email && L.members.has(s.email) ? L.members.get(s.email).uid : null, locked: !!s.locked })),
      n: L.members.size, t: Date.now(),
    };
  }
  let pend = new Set();
  function push(L) { // تجميع التحديثات المتتالية في بثّ واحد
    if (pend.has(L.row.id)) return; pend.add(L.row.id);
    setTimeout(() => { pend.delete(L.row.id); if (live.get(L.row.id) === L) bcast(L, 'state', snapshot(L)); }, 60);
  }
  function sys(L, text) { const c = { id: ++L.cid, sys: 1, text, t: Date.now() }; L.chat.push(c); if (L.chat.length > 60) L.chat.shift(); bcast(L, 'chat', c); }

  async function loadRoom(id) {
    let L = live.get(id);
    if (L) return L;
    const row = (await q(`SELECT * FROM rooms WHERE id=$1 AND active`, [id])).rows[0];
    if (!row) return null;
    L = live.get(id); if (L) return L; // سباق متزامن
    const owner = String(row.owner_email).toLowerCase();
    const ad = (await q(`SELECT email FROM room_admins WHERE room_id=$1`, [id])).rows.map((r) => String(r.email).toLowerCase());
    const bn = (await q(`SELECT email FROM room_bans WHERE room_id=$1`, [id])).rows.map((r) => String(r.email).toLowerCase());
    const ou = (await q(`SELECT uid FROM sync_accounts WHERE LOWER(email)=$1`, [owner])).rows[0];
    L = {
      row: Object.assign({}, row, { owner }), admins: new Set(ad), bans: new Set(bn), ownerUid: ou ? ou.uid : '',
      members: new Map(), mics: Array.from({ length: row.mics }, () => ({ email: '', locked: false })),
      hands: new Set(), muted: new Set(), chat: [], cid: 0, music: { url: '', title: '', playing: false, pos: 0, ts: 0 },
    };
    live.set(id, L);
    return L;
  }
  function dropMember(L, m, why) {
    if (!L.members.has(m.email) || L.members.get(m.email) !== m) return;
    clearTimeout(m.gone);
    L.members.delete(m.email); byTok.delete(m.tok); if (uidOf.get(m.email) === L.row.id) uidOf.delete(m.email);
    L.hands.delete(m.email); L.muted.delete(m.email);
    L.mics.forEach((s) => { if (s.email === m.email) s.email = ''; });
    if (m.res) { try { if (why) write(m, why, {}); m.res.end(); } catch (_) {} m.res = null; }
    if (!L.members.size) { live.delete(L.row.id); pend.delete(L.row.id); return; }
    push(L);
  }
  function closeLive(id, ev) {
    const L = live.get(id); if (!L) return;
    [...L.members.values()].forEach((m) => dropMember(L, m, ev || 'closed'));
    live.delete(id);
  }
  setInterval(() => { // نبض حفظ الاتصال
    live.forEach((L) => L.members.forEach((m) => { if (m.res) { try { m.res.write(':\n\n'); } catch (_) {} } }));
  }, 15000).unref();
  setInterval(() => { live.forEach((L) => { if (L.members.size) q(`UPDATE rooms SET last_active=NOW() WHERE id=$1`, [L.row.id]).catch(() => {}); }); }, 120000).unref();

  /* ======================= أدوات الحساب والرصيد ======================= */
  async function acct(e, h, cl) {
    e = txt(e, 200).toLowerCase(); h = txt(h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = (await (cl || pool).query(`SELECT email,name,uid,pts,blk,demo FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2${cl ? ' FOR UPDATE' : ''}`, [e, h])).rows[0];
    if (!r) fail(401, 'غير مسجّل الدخول');
    if (r.blk) fail(403, 'الحساب موقوف');
    return { email: String(r.email).toLowerCase(), name: r.name || String(r.email).split('@')[0], uid: r.uid, pts: Number(r.pts), demo: !!r.demo };
  }
  const SQL_AV = `(SELECT (EXTRACT(EPOCH FROM v.updated_at)*1000)::bigint FROM avatars v WHERE v.email=LOWER(a.email))`;
  async function addCmd(cl, email, pts, r, x) {
    const cm = { t: 'adj', e: email, d: { pts }, gf: { r, x } };
    const id = (await cl.query('INSERT INTO sync_cmds(body) VALUES($1) RETURNING id', [JSON.stringify(cm)])).rows[0].id;
    return { id, cm };
  }
  function fire(list) { if (app.locals.broadcastCmd) list.forEach((c) => { try { app.locals.broadcastCmd(c.id, c.cm); } catch (_) {} }); }
  async function withTx(fn) {
    const cl = await pool.connect();
    try { await cl.query('BEGIN'); const out = await fn(cl); await cl.query('COMMIT'); return out; }
    catch (e) { try { await cl.query('ROLLBACK'); } catch (_) {} throw e; }
    finally { cl.release(); }
  }
  async function debit(cl, me, amount, kind, roomId, label) {
    if (amount > 0) {
      if (me.pts < amount) fail(402, 'رصيد النقاط غير كافٍ');
      await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1`, [me.email, amount]);
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [me.email, amount]);
    }
    const sid = (await cl.query(`INSERT INTO room_sales(email,room_id,kind,pts) VALUES($1,$2,$3,$4) RETURNING id`, [me.email, roomId || null, kind, amount])).rows[0].id;
    await finIn(cl, 'rm:s:' + sid, me.email, kind === 'create' ? 'room_create' : 'room_mic', amount, kind === 'create' ? 'شراء روم' : 'رسوم مايك روم');
    return amount > 0 ? [await addCmd(cl, me.email, -amount, label, '')] : [];
  }
  const pubRoom = (r, c) => ({ id: r.id, name: r.name, emoji: r.emoji, theme: r.theme, descr: r.descr, welcome: r.welcome || '', mics: r.mics, locked: !!r.pin, openMic: r.open_mic, n: c, active: r.active });

  /* ======================= واجهة التطبيق ======================= */
  app.get('/api/rooms/config', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const c = await cfg();
    res.json({ ok: true, cfg: c, ice: iceServers(), themes: NTHEMES });
  }));

  app.get('/api/rooms/list', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const c = await cfg();
    if (!c.enabled) return res.json({ ok: true, enabled: false, rooms: [] });
    const rows = (await q(`SELECT r.*, a.name AS oname, a.uid AS ouid, ${SQL_AV} AS oav
      FROM rooms r LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(r.owner_email) WHERE r.active ORDER BY r.last_active DESC LIMIT 120`)).rows;
    const out = rows.map((r) => {
      const L = live.get(r.id), spk = L ? L.mics.filter((s) => s.email).length : 0;
      return Object.assign(pubRoom(r, L ? L.members.size : 0), { owner: r.oname || '', ouid: r.ouid || '', oav: Number(r.oav) || 0, spk });
    }).sort((a, b) => b.n - a.n || b.id - a.id);
    res.json({ ok: true, enabled: true, rooms: out });
  }));

  app.post('/api/rooms/mine', jsonBody, wrap(async (req, res) => {
    const me = await acct(req.body.e, req.body.h);
    const rows = (await q(`SELECT * FROM rooms WHERE LOWER(owner_email)=$1 AND active ORDER BY id`, [me.email])).rows;
    const adm = (await q(`SELECT r.* FROM rooms r JOIN room_admins a ON a.room_id=r.id WHERE a.email=$1 AND r.active`, [me.email])).rows;
    res.json({ ok: true, owned: rows.map((r) => pubRoom(r, live.get(r.id) ? live.get(r.id).members.size : 0)), admin: adm.map((r) => pubRoom(r, live.get(r.id) ? live.get(r.id).members.size : 0)), pts: me.pts, uid: me.uid });
  }));

  app.post('/api/rooms/create', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, c = await cfg();
    if (!c.enabled) fail(403, 'الرومات متوقفة حالياً');
    const name = clean(b.name, 40); if (name.length < 3) fail(400, 'اسم الروم قصير (3 أحرف على الأقل)');
    const descr = clean(b.descr, 120), emoji = txt(b.emoji, 8) || '🎙️', theme = num(b.theme, 0, 0, NTHEMES - 1);
    const out = await withTx(async (cl) => {
      const me = await acct(b.e, b.h, cl);
      if (me.demo) fail(403, 'الحساب التجريبي لا يمكنه إنشاء روم');
      const own = Number((await cl.query(`SELECT COUNT(*)::int n FROM rooms WHERE LOWER(owner_email)=$1 AND active`, [me.email])).rows[0].n);
      if (own >= c.maxOwned) fail(400, 'وصلت للحد الأقصى من الرومات التي يمكنك امتلاكها');
      const room = (await cl.query(`INSERT INTO rooms(owner_email,name,descr,emoji,theme,mics) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [me.email, name, descr, emoji, theme, c.baseMics])).rows[0];
      const cmds = await debit(cl, me, c.createPrice, 'create', room.id, 'شراء روم');
      return { room, cmds, bal: me.pts - c.createPrice };
    });
    fire(out.cmds);
    res.json({ ok: true, room: pubRoom(out.room, 0), bal: out.bal });
  }));

  app.post('/api/rooms/update', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, me = await acct(b.e, b.h), id = num(b.id, 0, 0, 1e9);
    const r = (await q(`SELECT * FROM rooms WHERE id=$1 AND active`, [id])).rows[0];
    if (!r || String(r.owner_email).toLowerCase() !== me.email) fail(403, 'هذا الروم ليس لك');
    const f = {
      name: b.name != null ? clean(b.name, 40) : r.name, descr: b.descr != null ? clean(b.descr, 120) : r.descr,
      emoji: b.emoji != null ? (txt(b.emoji, 8) || r.emoji) : r.emoji, theme: b.theme != null ? num(b.theme, r.theme, 0, NTHEMES - 1) : r.theme,
      welcome: b.welcome != null ? clean(b.welcome, 160) : r.welcome, open_mic: b.openMic != null ? !!b.openMic : r.open_mic,
      pin: b.pin != null ? txt(b.pin, 8).replace(/[^0-9a-zA-Z]/g, '') : r.pin,
    };
    if (f.name.length < 3) fail(400, 'اسم الروم قصير');
    await q(`UPDATE rooms SET name=$2,descr=$3,emoji=$4,theme=$5,welcome=$6,open_mic=$7,pin=$8 WHERE id=$1`, [id, f.name, f.descr, f.emoji, f.theme, f.welcome, f.open_mic, f.pin]);
    const L = live.get(id); if (L) { Object.assign(L.row, f); push(L); }
    res.json({ ok: true });
  }));

  app.post('/api/rooms/buy-mic', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, c = await cfg(), id = num(b.id, 0, 0, 1e9);
    const out = await withTx(async (cl) => {
      const me = await acct(b.e, b.h, cl);
      if (me.demo) fail(403, 'الحساب التجريبي لا يمكنه الشراء');
      const r = (await cl.query(`SELECT * FROM rooms WHERE id=$1 AND active FOR UPDATE`, [id])).rows[0];
      if (!r || String(r.owner_email).toLowerCase() !== me.email) fail(403, 'هذا الروم ليس لك');
      if (r.mics >= c.maxMics) fail(400, 'وصل الروم لأقصى عدد مايكات');
      await cl.query(`UPDATE rooms SET mics=mics+1 WHERE id=$1`, [id]);
      const cmds = await debit(cl, me, c.micPrice, 'mic', id, 'شراء مايك للروم');
      return { cmds, mics: r.mics + 1, bal: me.pts - c.micPrice };
    });
    fire(out.cmds);
    const L = live.get(id); if (L) { L.row.mics = out.mics; while (L.mics.length < out.mics) L.mics.push({ email: '', locked: false }); sys(L, '🎤 تمت إضافة مايك جديد للروم'); push(L); }
    res.json({ ok: true, mics: out.mics, bal: out.bal });
  }));

  app.post('/api/rooms/close', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, me = await acct(b.e, b.h), id = num(b.id, 0, 0, 1e9);
    const r = (await q(`SELECT owner_email FROM rooms WHERE id=$1 AND active`, [id])).rows[0];
    if (!r || String(r.owner_email).toLowerCase() !== me.email) fail(403, 'هذا الروم ليس لك');
    await q(`UPDATE rooms SET active=FALSE WHERE id=$1`, [id]);
    closeLive(id);
    res.json({ ok: true });
  }));

  /* ---------- الدخول والبث ---------- */
  app.post('/api/rooms/join', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, c = await cfg();
    if (!c.enabled) fail(403, 'الرومات متوقفة حالياً');
    const me = await acct(b.e, b.h), id = num(b.id, 0, 0, 1e9);
    const L = await loadRoom(id); if (!L) fail(404, 'هذا الروم غير موجود أو أُغلق');
    if (L.bans.has(me.email)) fail(403, 'تم حظرك من هذا الروم');
    const mod = isMod(L, me.email);
    if (L.row.pin && !mod && txt(b.pin, 8) !== L.row.pin) fail(403, b.pin ? 'الرمز غير صحيح' : 'pin');
    const old = L.members.get(me.email);
    if (!old && L.members.size >= c.maxMembers) fail(409, 'الروم ممتلئ');
    // غرفة واحدة لكل مستخدم: نُخرجه من أي روم آخر
    const prev = uidOf.get(me.email);
    if (prev && prev !== id) { const PL = live.get(prev); const pm = PL && PL.members.get(me.email); if (pm) dropMember(PL, pm, 'moved'); }
    if (old) dropMember(L, old, 'moved');
    live.set(id, L);
    const av = Number((await q(`SELECT (EXTRACT(EPOCH FROM updated_at)*1000)::bigint AS v FROM avatars WHERE email=$1`, [me.email]).catch(() => ({ rows: [] }))).rows[0]?.v) || 0;
    const m = { email: me.email, uid: me.uid, name: me.name, av, tok: crypto.randomBytes(18).toString('hex'), res: null, gone: null, joined: Date.now(), n: 0, w: 0, sq: [] };
    L.members.set(me.email, m); byTok.set(m.tok, { L, m }); uidOf.set(me.email, id);
    if (!old) sys(L, '👋 ' + me.name + ' دخل الروم');
    push(L);
    res.json({ ok: true, tok: m.tok, me: { uid: me.uid, name: me.name, role: roleOf(L, me.email) }, state: snapshot(L), chat: L.chat.slice(-40), pts: me.pts });
  }));

  app.get('/api/rooms/stream', (req, res) => {
    const ent = byTok.get(txt(req.query.tok, 80));
    if (!ent) return res.status(401).end();
    const { L, m } = ent;
    try { req.socket.setNoDelay(true); req.socket.setKeepAlive(true, 10000); req.socket.setTimeout(0); } catch (_) {}
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders && res.flushHeaders();
    if (m.res) { try { m.res.end(); } catch (_) {} }
    clearTimeout(m.gone); m.res = res;
    res.write('retry: 1000\n:' + ' '.repeat(2048) + '\n\n'); // الحشو يُجبر الوسطاء (البروكسي) على تمرير البث فوراً بلا تخزين مؤقت
    write(m, 'state', snapshot(L));
    // سلّم الإشارات المحجوزة (عروض اتصال وصلت قبل ربط البث)
    const held = m.sq.splice(0); held.forEach((x) => { if (Date.now() - x.t < 25000) write(m, 'sig', x.p); });
    // أخبر المتحدثين الحاليين أن هذا العضو صار قابلاً للاستقبال ليبدؤوا الاتصال به فوراً
    L.mics.forEach((s2) => { if (s2.email && s2.email !== m.email) { const sp = L.members.get(s2.email); if (sp) write(sp, 'peerup', { uid: m.uid, j: m.joined }); } });
    // وإن كان هو متحدثاً (إعادة اتصال) فليُعد كل المستمعين بناء الاستقبال منه
    if (L.mics.some((s2) => s2.email === m.email)) write(m, 'peerup', { all: 1 });
    res.on('close', () => { // (res وليس req: في Node الحديث يُطلق req 'close' فور اكتمال الطلب)
      if (m.res !== res) return;
      m.res = null;
      m.gone = setTimeout(() => { if (!m.res) { const x = L.members.get(m.email); if (x === m) { sys(L, '👋 ' + m.name + ' غادر الروم'); dropMember(L, m); } } }, 12000);
    });
  });

  app.post('/api/rooms/leave', jsonBody, wrap(async (req, res) => {
    const ent = byTok.get(txt(req.body.tok, 80));
    if (ent) { sys(ent.L, '👋 ' + ent.m.name + ' غادر الروم'); dropMember(ent.L, ent.m); }
    res.json({ ok: true });
  }));

  /* ---------- الأوامر داخل الروم ---------- */
  const SEATFREE = (L) => L.mics.findIndex((s) => !s.email && !s.locked);
  function seatOf(L, email) { return L.mics.findIndex((s) => s.email === email); }
  const byUid = (L, uid) => [...L.members.values()].find((x) => x.uid === uid);

  app.post('/api/rooms/act', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, ent = byTok.get(txt(b.tok, 80));
    if (!ent) fail(401, 'انتهت جلسة الروم، ادخل من جديد');
    const { L, m } = ent, a = txt(b.a, 20), now = Date.now();
    if (now - m.w > 10000) { m.w = now; m.n = 0; m.sn = 0; }
    if (a === 'sig' || a === 'sigb') { if (++m.sn > 1500) return res.json({ ok: true }); } else if (++m.n > 60) fail(429, 'بطّئ قليلاً');
    const mod = isMod(L, m.email), owner = m.email === L.row.owner;
    const tgt = () => { const t = byUid(L, txt(b.uid, 64)); if (!t) fail(404, 'المستخدم ليس في الروم'); return t; };
    const guardMod = (t) => { if (t.email === L.row.owner) fail(403, 'لا يمكن التحكم بصاحب الروم'); if (!owner && roleOf(L, t.email) === 'admin') fail(403, 'لا يمكن التحكم بمشرف آخر'); };

    switch (a) {
      case 'chat': {
        const text = clean(b.text, 300); if (!text) return res.json({ ok: true });
        if (now - (m.lastChat || 0) < 700) fail(429, 'بطّئ قليلاً');
        m.lastChat = now;
        const cm = { id: ++L.cid, uid: m.uid, name: m.name, role: roleOf(L, m.email), text, t: now };
        L.chat.push(cm); if (L.chat.length > 60) L.chat.shift(); bcast(L, 'chat', cm);
        break;
      }
      case 'hand': {
        if (seatOf(L, m.email) >= 0) break;
        if (b.on) {
          if (L.row.open_mic || mod) { const i = SEATFREE(L); if (i < 0) fail(409, 'كل المايكات مشغولة'); L.mics[i].email = m.email; L.hands.delete(m.email); write(m, 'seat', { slot: i }); }
          else L.hands.add(m.email);
        } else L.hands.delete(m.email);
        push(L); break;
      }
      case 'mic_leave': { const i = seatOf(L, m.email); if (i >= 0) { L.mics[i].email = ''; push(L); } break; }
      case 'mic_take': { // أخذ مايك بنفسي: المشرفون دائماً، والباقون إن كان الروم «مايك مفتوح»
        if (!mod && !L.row.open_mic) fail(403, 'اطلب المايك من صاحب الروم أو المشرف');
        if (seatOf(L, m.email) >= 0) break;
        const want = num(b.slot, -1, -1, 11), i = want >= 0 && L.mics[want] && !L.mics[want].email && (!L.mics[want].locked || mod) ? want : SEATFREE(L);
        if (i < 0) fail(409, 'كل المايكات مشغولة');
        L.mics[i].email = m.email; L.hands.delete(m.email); write(m, 'seat', { slot: i }); push(L); break;
      }
      case 'mod_up': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const t = tgt(); if (seatOf(L, t.email) >= 0) break;
        const want = num(b.slot, -1, -1, 11), i = want >= 0 && L.mics[want] && !L.mics[want].email ? want : SEATFREE(L);
        if (i < 0) fail(409, 'كل المايكات مشغولة أو مقفلة');
        L.mics[i].email = t.email; L.hands.delete(t.email); L.muted.delete(t.email);
        write(t, 'seat', { slot: i }); sys(L, '🎤 ' + t.name + ' صعد إلى المايك'); push(L); break;
      }
      case 'mod_down': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const t = tgt(); guardMod(t); const i = seatOf(L, t.email);
        if (i >= 0) { L.mics[i].email = ''; write(t, 'unseat', {}); push(L); } break;
      }
      case 'mod_mute': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const t = tgt(); guardMod(t);
        if (b.on) L.muted.add(t.email); else L.muted.delete(t.email);
        write(t, 'mute', { on: !!b.on }); push(L); break;
      }
      case 'mod_lock': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const i = num(b.slot, -1, -1, 11); if (!L.mics[i]) fail(400, 'مايك غير صحيح');
        if (b.on && L.mics[i].email) { const t = L.members.get(L.mics[i].email); L.mics[i].email = ''; if (t) write(t, 'unseat', {}); }
        L.mics[i].locked = !!b.on; push(L); break;
      }
      case 'mod_kick': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const t = tgt(); guardMod(t);
        if (b.ban) { L.bans.add(t.email); await q(`INSERT INTO room_bans(room_id,email) VALUES($1,$2) ON CONFLICT DO NOTHING`, [L.row.id, t.email]); }
        sys(L, '🚫 ' + t.name + (b.ban ? ' تم حظره من الروم' : ' تم طرده من الروم'));
        dropMember(L, t, b.ban ? 'banned' : 'kicked'); break;
      }
      case 'mod_admin': {
        if (!owner) fail(403, 'لصاحب الروم فقط');
        const t = tgt(); if (t.email === L.row.owner) break;
        if (b.on) {
          if (L.admins.size >= 5) fail(400, 'الحد الأقصى 5 مشرفين');
          L.admins.add(t.email); await q(`INSERT INTO room_admins(room_id,email) VALUES($1,$2) ON CONFLICT DO NOTHING`, [L.row.id, t.email]); sys(L, '🛡️ ' + t.name + ' أصبح مشرفاً');
        } else { L.admins.delete(t.email); await q(`DELETE FROM room_admins WHERE room_id=$1 AND email=$2`, [L.row.id, t.email]); }
        push(L); break;
      }
      case 'music': {
        if (!mod) fail(403, 'للمشرفين فقط');
        const op = txt(b.op, 8);
        if (op === 'play') {
          const url = txt(b.url, 500);
          if (url) { if (!/^https:\/\/[^\s]+$/i.test(url) && !/^\/api\/rooms\/music\/file\/\d+$/.test(url)) fail(400, 'رابط الموسيقى يجب أن يبدأ بـ https://'); L.music = { url, title: clean(b.title, 60) || 'موسيقى', playing: true, pos: 0, ts: now }; }
          else if (L.music.url) L.music = Object.assign({}, L.music, { playing: true, ts: now });
          else fail(400, 'اختر موسيقى أولاً');
        } else if (op === 'pause') { if (L.music.playing) L.music = Object.assign({}, L.music, { playing: false, pos: L.music.pos + (now - L.music.ts) / 1000, ts: now }); }
        else if (op === 'stop') L.music = { url: '', title: '', playing: false, pos: 0, ts: 0 };
        push(L); break;
      }
      case 'sig': { // تمرير إشارات WebRTC بين عضوين في نفس الروم
        const t = byUid(L, txt(b.to, 64)); if (!t) break;
        const d = b.d; if (!d || JSON.stringify(d).length > 9000) break;
        deliver(t, { from: m.uid, d }); break;
      }
      case 'sigb': { // دفعة إشارات في طلب واحد (أسرع وأقل ضغطاً من إشارة لكل طلب)
        const list = Array.isArray(b.list) ? b.list.slice(0, 80) : []; let size = 0;
        for (const it of list) {
          const t = byUid(L, txt(it && it.to, 64)); if (!t || !it.d) continue;
          const len = JSON.stringify(it.d).length; if (len > 9000) continue;
          size += len; if (size > 160000) break;
          deliver(t, { from: m.uid, d: it.d });
        }
        break;
      }
      default: fail(400, 'أمر غير معروف');
    }
    res.json({ ok: true });
  }));

  /* ---------- الهدايا داخل الروم ---------- */
  app.post('/api/rooms/gift', jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, ent = byTok.get(txt(b.tok, 80));
    if (!ent) fail(401, 'انتهت جلسة الروم، ادخل من جديد');
    const { L, m } = ent, c = await cfg();
    const gcfg = ((await q(`SELECT v FROM gift_settings WHERE k='cfg'`)).rows[0] || {}).v || {};
    if (gcfg.enabled === false) fail(403, 'الهدايا متوقفة حالياً');
    const maxQty = Math.max(1, Math.min(99, Number(gcfg.maxQty) || 10));
    const gid = num(b.gift, 0, 0, 1e9), qty = num(b.qty, 1, 1, maxQty);
    if (!gid) fail(400, 'اختر هدية');
    const tgt = b.to ? byUid(L, txt(b.to, 64)) : null;

    const out = await withTx(async (cl) => {
      const row = (await cl.query(`SELECT email,name,pts,blk,demo FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE`, [m.email])).rows[0];
      if (!row || row.blk) fail(403, 'الحساب موقوف');
      if (row.demo) fail(403, 'الحساب التجريبي لا يمكنه إرسال الهدايا');
      const g = (await cl.query(`SELECT id,name,emoji,price FROM gift_catalog WHERE id=$1 AND active`, [gid])).rows[0];
      if (!g) fail(404, 'هذه الهدية غير متاحة');
      const price = Number(g.price), total = price * qty;
      if (!(total > 0)) fail(400, 'سعر الهدية غير صالح');
      if (Number(row.pts) < total) fail(402, 'رصيد النقاط غير كافٍ');

      const ownerCut = m.email === L.row.owner ? 0 : Math.floor((total * c.ownerPct) / 100);
      const aud = [...L.members.values()].filter((x) => x.email !== m.email && x.email !== L.row.owner).map((x) => x.email);
      const audPool = Math.floor((total * c.audPct) / 100), per = aud.length ? Math.floor(audPool / aud.length) : 0;

      await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1`, [m.email, total]);
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [m.email, total]);
      const cmds = [await addCmd(cl, m.email, -total, 'هدية في روم', g.name + (qty > 1 ? ' ×' + qty : '') + ' ← ' + L.row.name)];
      if (ownerCut > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [L.row.owner, ownerCut]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [L.row.owner, ownerCut]);
        cmds.push(await addCmd(cl, L.row.owner, ownerCut, 'نصيب صاحب الروم', g.name + (qty > 1 ? ' ×' + qty : '') + ' من ' + m.name));
      }
      if (per > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=ANY($1)`, [aud, per]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=ANY($1)`, [aud, per]);
        for (const em of aud) cmds.push(await addCmd(cl, em, per, 'نصيب من هدية روم', g.name + (qty > 1 ? ' ×' + qty : '') + ' من ' + m.name));
      }
      const glog = (await cl.query(`INSERT INTO room_gift_log(room_id,from_email,gift_id,name,emoji,price,qty,total,owner_cut,aud_cut,aud_n) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [L.row.id, m.email, g.id, g.name, g.emoji, price, qty, total, ownerCut, per * aud.length, aud.length])).rows[0].id;
      const appCut = total - ownerCut - per * aud.length; // حصة صاحب التطبيق (الباقي بعد صاحب الروم والحاضرين)
      await finIn(cl, 'rm:g:' + glog, m.email, 'room_gift', appCut, 'حصة التطبيق من هدية ' + g.name + ' في ' + L.row.name);
      await cl.query(`UPDATE rooms SET gifts_total=gifts_total+$2, owner_earn=owner_earn+$3, last_active=NOW() WHERE id=$1`, [L.row.id, total, ownerCut]);
      return { g, price, total, ownerCut, per, audN: aud.length, appCut, cmds, bal: Number(row.pts) - total };
    });
    fire(out.cmds);
    const ev = { id: ++L.cid, from: m.uid, fromName: m.name, emoji: out.g.emoji, name: out.g.name, qty, total: out.total, to: tgt ? tgt.uid : '', toName: tgt ? tgt.name : '', t: Date.now() };
    bcast(L, 'gift', ev);
    sys(L, '🎁 ' + m.name + ' أرسل ' + out.g.emoji + ' ' + out.g.name + (qty > 1 ? ' ×' + qty : '') + (tgt ? ' إلى ' + tgt.name : ''));
    res.json({ ok: true, bal: out.bal, ownerCut: out.ownerCut, per: out.per, audN: out.audN });
  }));

  /* ======================= لوحة التحكم ======================= */
  app.get('/api/ctl/rooms', ...ctl, wrap(async (_req, res) => {
    const c = await cfg(), pr = await ptRate();
    const rooms = (await q(`SELECT r.id,r.name,r.emoji,r.descr,r.owner_email,r.mics,r.active,r.open_mic,(r.pin<>'') AS locked,
        r.gifts_total::float8 gt,r.owner_earn::float8 oe,r.created_at,r.last_active,a.name AS oname,
        COALESCE((SELECT SUM(s.pts) FROM room_sales s WHERE s.room_id=r.id),0)::float8 paid,
        COALESCE((SELECT SUM(g.total-g.owner_cut-g.aud_cut) FROM room_gift_log g WHERE g.room_id=r.id),0)::float8 app_cut
      FROM rooms r LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(r.owner_email) ORDER BY r.active DESC, r.id DESC LIMIT 200`)).rows
      .map((r) => Object.assign(r, { n: live.get(r.id) ? live.get(r.id).members.size : 0, spk: live.get(r.id) ? live.get(r.id).mics.filter((x) => x.email).length : 0 }));
    const st = (await q(`SELECT
      (SELECT COUNT(*)::int FROM rooms WHERE active) rooms, (SELECT COUNT(*)::int FROM rooms) rooms_all,
      COALESCE((SELECT SUM(pts) FROM room_sales WHERE kind='create'),0)::float8 create_pts, (SELECT COUNT(*)::int FROM room_sales WHERE kind='create' AND pts>0) create_n,
      COALESCE((SELECT SUM(pts) FROM room_sales WHERE kind='mic'),0)::float8 mic_pts, (SELECT COUNT(*)::int FROM room_sales WHERE kind='mic' AND pts>0) mic_n,
      COALESCE((SELECT SUM(pts) FROM room_sales),0)::float8 sales,
      COALESCE((SELECT SUM(total) FROM room_gift_log),0)::float8 gifts, (SELECT COUNT(*)::int FROM room_gift_log) gift_n,
      COALESCE((SELECT SUM(owner_cut) FROM room_gift_log),0)::float8 oc, COALESCE((SELECT SUM(aud_cut) FROM room_gift_log),0)::float8 ac`)).rows[0];
    st.app_gift = st.gifts - st.oc - st.ac;
    st.profit = st.sales + st.app_gift;
    const per = (await q(`SELECT
      COALESCE((SELECT SUM(pts) FROM room_sales WHERE created_at > NOW()-INTERVAL '1 day'),0)::float8 s1,
      COALESCE((SELECT SUM(pts) FROM room_sales WHERE created_at > NOW()-INTERVAL '7 days'),0)::float8 s7,
      COALESCE((SELECT SUM(pts) FROM room_sales WHERE created_at > NOW()-INTERVAL '30 days'),0)::float8 s30,
      COALESCE((SELECT SUM(total-owner_cut-aud_cut) FROM room_gift_log WHERE created_at > NOW()-INTERVAL '1 day'),0)::float8 g1,
      COALESCE((SELECT SUM(total-owner_cut-aud_cut) FROM room_gift_log WHERE created_at > NOW()-INTERVAL '7 days'),0)::float8 g7,
      COALESCE((SELECT SUM(total-owner_cut-aud_cut) FROM room_gift_log WHERE created_at > NOW()-INTERVAL '30 days'),0)::float8 g30`)).rows[0];
    st.d1 = per.s1 + per.g1; st.d7 = per.s7 + per.g7; st.d30 = per.s30 + per.g30;
    st.pr = pr; // دينار لكل نقطة
    const music = (await q(`SELECT id,title,url,active,sort,cat FROM room_music ORDER BY cat,sort,id`)).rows;
    const live_n = [...live.values()].reduce((x, L) => x + L.members.size, 0);
    res.json({ ok: true, cfg: c, rooms, stats: Object.assign(st, { live: live_n }), music });
  }));
  app.get('/api/ctl/rooms/detail', ...ctl, wrap(async (req, res) => { // تفاصيل روم واحد للإدارة
    const id = num(req.query.id, 0, 0, 1e9);
    const r = (await q(`SELECT r.*, a.name AS oname, a.uid AS ouid FROM rooms r LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(r.owner_email) WHERE r.id=$1`, [id])).rows[0];
    if (!r) fail(404, 'الروم غير موجود');
    const sales = (await q(`SELECT kind,COUNT(*)::int n,COALESCE(SUM(pts),0)::float8 pts FROM room_sales WHERE room_id=$1 GROUP BY kind`, [id])).rows;
    const gs = (await q(`SELECT COUNT(*)::int n,COALESCE(SUM(total),0)::float8 total,COALESCE(SUM(owner_cut),0)::float8 oc,COALESCE(SUM(aud_cut),0)::float8 ac FROM room_gift_log WHERE room_id=$1`, [id])).rows[0];
    const gifts = (await q(`SELECT g.name,g.emoji,g.qty,g.total::float8 total,g.owner_cut::float8 owner_cut,g.aud_cut::float8 aud_cut,g.aud_n,g.created_at,COALESCE(a.name,g.from_email) AS frm
      FROM room_gift_log g LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(g.from_email) WHERE g.room_id=$1 ORDER BY g.id DESC LIMIT 30`, [id])).rows;
    const admins = (await q(`SELECT email FROM room_admins WHERE room_id=$1`, [id])).rows.map((x) => x.email);
    const bans = (await q(`SELECT email FROM room_bans WHERE room_id=$1`, [id])).rows.map((x) => x.email);
    const L = live.get(id);
    const members = L ? [...L.members.values()].map((m) => ({ uid: m.uid, name: m.name, email: m.email, role: roleOf(L, m.email), mic: L.mics.findIndex((x) => x.email === m.email) })) : [];
    res.json({ ok: true, room: { id: r.id, name: r.name, descr: r.descr, emoji: r.emoji, theme: r.theme, mics: r.mics, open_mic: r.open_mic, pin: r.pin, welcome: r.welcome,
      active: r.active, owner_email: r.owner_email, oname: r.oname || '', ouid: r.ouid || '', created_at: r.created_at, last_active: r.last_active }, sales, gs, gifts, admins, bans, members });
  }));
  app.post('/api/ctl/rooms/update', ...ctl, jsonBody, wrap(async (req, res) => { // تعديل روم من لوحة التحكم
    const b = req.body || {}, id = num(b.id, 0, 0, 1e9);
    const r = (await q(`SELECT * FROM rooms WHERE id=$1`, [id])).rows[0]; if (!r) fail(404, 'الروم غير موجود');
    const f = {
      name: b.name != null ? clean(b.name, 40) : r.name, descr: b.descr != null ? clean(b.descr, 120) : r.descr,
      welcome: b.welcome != null ? clean(b.welcome, 160) : r.welcome, mics: b.mics != null ? num(b.mics, r.mics, 1, 12) : r.mics,
      open_mic: b.openMic != null ? !!b.openMic : r.open_mic, pin: b.clearPin ? '' : r.pin, active: b.active != null ? !!b.active : r.active,
    };
    if (f.name.length < 3) fail(400, 'اسم الروم قصير (3 أحرف على الأقل)');
    await q(`UPDATE rooms SET name=$2,descr=$3,welcome=$4,mics=$5,open_mic=$6,pin=$7,active=$8 WHERE id=$1`, [id, f.name, f.descr, f.welcome, f.mics, f.open_mic, f.pin, f.active]);
    if (b.unbanAll) { await q(`DELETE FROM room_bans WHERE room_id=$1`, [id]); const L0 = live.get(id); if (L0) L0.bans.clear(); }
    const L = live.get(id);
    if (!f.active) closeLive(id);
    else if (b.eject) closeLive(id, 'kicked');
    else if (L) {
      Object.assign(L.row, { name: f.name, descr: f.descr, welcome: f.welcome, open_mic: f.open_mic, pin: f.pin }); L.row.mics = f.mics;
      while (L.mics.length < f.mics) L.mics.push({ email: '', locked: false });
      while (L.mics.length > f.mics) { const sl = L.mics.pop(); if (sl.email) { const t = L.members.get(sl.email); if (t) write(t, 'unseat', {}); } }
      push(L);
    }
    res.json({ ok: true });
  }));
  app.post('/api/ctl/rooms/kick', ...ctl, jsonBody, wrap(async (req, res) => { // طرد/حظر متواجد من لوحة التحكم
    const b = req.body || {}, id = num(b.id, 0, 0, 1e9), L = live.get(id);
    const t = L && byUid(L, txt(b.uid, 64)); if (!t) fail(404, 'المستخدم ليس في الروم الآن');
    if (b.ban) { L.bans.add(t.email); await q(`INSERT INTO room_bans(room_id,email) VALUES($1,$2) ON CONFLICT DO NOTHING`, [id, t.email]); }
    sys(L, '🚫 ' + t.name + (b.ban ? ' تم حظره من الروم' : ' تم طرده من الروم'));
    dropMember(L, t, b.ban ? 'banned' : 'kicked');
    res.json({ ok: true });
  }));
  app.post('/api/ctl/rooms/config', ...ctl, jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const v = {
      enabled: !!b.enabled, createPrice: num(b.createPrice, DEF.createPrice, 0, 1e12), micPrice: num(b.micPrice, DEF.micPrice, 0, 1e12),
      baseMics: num(b.baseMics, 2, 1, 12), maxMics: num(b.maxMics, 8, 1, 12), maxMembers: num(b.maxMembers, 40, 2, 200),
      ownerPct: num(b.ownerPct, 20, 0, 100), audPct: num(b.audPct, 50, 0, 100), maxOwned: num(b.maxOwned, 1, 1, 20),
    };
    if (v.ownerPct + v.audPct > 100) fail(400, 'مجموع نسبة صاحب الروم ونسبة الحاضرين يجب ألا يتجاوز 100٪');
    await q(`INSERT INTO room_settings(k,v) VALUES('cfg',$1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [JSON.stringify(v)]);
    res.json({ ok: true, cfg: await cfg() });
  }));
  app.post('/api/ctl/rooms/close', ...ctl, jsonBody, wrap(async (req, res) => {
    const id = num((req.body || {}).id, 0, 0, 1e9); if (!id) fail(400, 'روم غير صحيح');
    await q(`UPDATE rooms SET active=FALSE WHERE id=$1`, [id]); closeLive(id); res.json({ ok: true });
  }));
  app.post('/api/ctl/rooms/grant', ...ctl, jsonBody, wrap(async (req, res) => { // منح روم مجاناً لمستخدم
    const b = req.body || {}, email = txt(b.email, 200).toLowerCase(), name = clean(b.name, 40) || 'روم جديد';
    const u = (await q(`SELECT email FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0]; if (!u) fail(404, 'المستخدم غير موجود');
    const c = await cfg();
    const r = (await q(`INSERT INTO rooms(owner_email,name,mics) VALUES($1,$2,$3) RETURNING id`, [String(u.email).toLowerCase(), name, c.baseMics])).rows[0];
    res.json({ ok: true, id: r.id });
  }));
  const CATS = ['energetic', 'iraqi', 'other'];
  const okUrl = (u) => /^https:\/\/[^\s]+$/i.test(u) || /^\/api\/rooms\/music\/file\/\d+$/.test(u);
  app.post('/api/ctl/rooms/music/save', ...ctl, jsonBody, wrap(async (req, res) => {
    const b = req.body || {}, title = clean(b.title, 60), url = txt(b.url, 500), id = num(b.id, 0, 0, 1e9);
    const cat = CATS.includes(b.cat) ? b.cat : 'other';
    if (!title) fail(400, 'اكتب اسم المقطع'); if (!okUrl(url)) fail(400, 'الرابط يجب أن يبدأ بـ https://');
    const active = b.active !== false && b.active !== 0, sort = num(b.sort, 0, 0, 100000);
    if (id) await q(`UPDATE room_music SET title=$2,url=$3,active=$4,sort=$5,cat=$6 WHERE id=$1`, [id, title, url, active, sort, cat]);
    else await q(`INSERT INTO room_music(title,url,active,sort,cat) VALUES($1,$2,$3,$4,$5)`, [title, url, active, sort || 10, cat]);
    res.json({ ok: true });
  }));
  // رفع ملف صوتي مباشرة (حتى 12MB) ← يُخزَّن في قاعدة البيانات ويُقدَّم من السيرفر
  app.post('/api/ctl/rooms/music/upload', ...ctl, express.raw({ type: () => true, limit: '12mb' }), wrap(async (req, res) => {
    const mime = String(req.get('x-mime') || req.get('content-type') || '').toLowerCase();
    if (!/^audio\/(mpeg|mp3|mp4|aac|x-m4a|m4a|ogg|wav|x-wav|webm)$/.test(mime)) fail(400, 'نوع الملف غير مدعوم (استخدم mp3 أو m4a أو ogg أو wav)');
    if (!Buffer.isBuffer(req.body) || req.body.length < 2000) fail(400, 'الملف فارغ أو غير صالح');
    const title = clean(decodeURIComponent(String(req.get('x-title') || '')), 60), cat = CATS.includes(req.get('x-cat')) ? req.get('x-cat') : 'other';
    if (!title) fail(400, 'اكتب اسم المقطع');
    const f = (await q(`INSERT INTO room_music_files(mime,data) VALUES($1,$2) RETURNING id`, [mime, req.body])).rows[0];
    await q(`INSERT INTO room_music(title,url,active,sort,cat) VALUES($1,$2,TRUE,10,$3)`, [title, '/api/rooms/music/file/' + f.id, cat]);
    res.json({ ok: true });
  }));
  app.get('/api/rooms/music/file/:id', wrap(async (req, res) => {
    const r = (await q(`SELECT mime,data FROM room_music_files WHERE id=$1`, [num(req.params.id, 0, 0, 1e9)])).rows[0]; if (!r) return res.status(404).end();
    const d = r.data, size = d.length, m = /bytes=(\d*)-(\d*)/.exec(req.get('range') || '');
    res.set({ 'Content-Type': r.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
    if (m) { let a = m[1] === '' ? Math.max(0, size - +m[2]) : +m[1], z = m[1] !== '' && m[2] !== '' ? Math.min(+m[2], size - 1) : size - 1; if (m[1] === '') z = size - 1; if (a > z || a >= size) return res.status(416).set('Content-Range', 'bytes */' + size).end(); res.status(206).set({ 'Content-Range': `bytes ${a}-${z}/${size}`, 'Content-Length': z - a + 1 }); return res.end(d.subarray(a, z + 1)); }
    res.set('Content-Length', size); res.end(d);
  }));
  app.post('/api/ctl/rooms/music/delete', ...ctl, jsonBody, wrap(async (req, res) => {
    const id = num((req.body || {}).id, 0, 0, 1e9), r = (await q(`SELECT url FROM room_music WHERE id=$1`, [id])).rows[0];
    await q(`DELETE FROM room_music WHERE id=$1`, [id]);
    const fm = r && /\/file\/(\d+)$/.exec(r.url); if (fm) await q(`DELETE FROM room_music_files WHERE id=$1`, [+fm[1]]);
    res.json({ ok: true });
  }));
  // مكتبة الموسيقى للمستخدمين
  app.get('/api/rooms/music', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, tracks: (await q(`SELECT id,title,url,cat FROM room_music WHERE active ORDER BY sort,id`)).rows });
  }));
};

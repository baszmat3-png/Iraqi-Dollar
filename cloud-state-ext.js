/* cloud-state-ext.js — المزامنة السحابية لحالة كل حساب (الواجهة موجودة في index.html: CLD*)
 *  POST /api/v1/login         {email,h}                    -> {token}
 *  GET  /api/v1/state[?since] (Bearer)                     -> {ok,ver,state?,boot?}
 *  PUT  /api/v1/state         {base,state,dev} (Bearer)    -> {ok,ver} | 409 {state,ver}
 * المرجع في الأرصدة والعدادات هو sync_accounts (الإدارة + التقارير): يُدمج دائماً فوق الحالة المخزّنة عند القراءة،
 * فيجد المستخدم نقاطه وجواهره ودولاره وعداداته في أي جهاز. وتُرفق cv (آخر أمر إدارة مُطبَّق) كي لا يُطبَّق الأمر مرتين.
 * التركيب في server.js:  const CLOUD = require('./cloud-state-ext'); CLOUD.parsers(app, express);  ... CLOUD.routes(app, { pool, wrap, fail });
 */
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'cloud-state-secret';
const b64 = (s) => Buffer.from(s).toString('base64url');
const mac = (s) => crypto.createHmac('sha256', SECRET).update('cld:' + s).digest('base64url');
const mk = (email) => { const p = b64(JSON.stringify({ e: email, t: Date.now() })); return p + '.' + mac(p); };
const ck = (tok) => {
  const [p, m] = String(tok || '').split('.');
  if (!p || !m) return null;
  const x = mac(p);
  if (x.length !== m.length || !crypto.timingSafeEqual(Buffer.from(x), Buffer.from(m))) return null;
  try { const j = JSON.parse(Buffer.from(p, 'base64url').toString()); return j && j.e ? String(j.e).toLowerCase() : null; } catch (e) { return null; }
};

const js = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } } return v; };

exports.parsers = (app, express) => { app.use('/api/v1', express.json({ limit: '3mb' })); };

exports.routes = (app, { pool, wrap, fail }) => {
  const ready = pool.query(`CREATE TABLE IF NOT EXISTS cloud_state(
      email TEXT PRIMARY KEY, ver INT NOT NULL DEFAULT 0, state JSONB, dev TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch((e) => console.error('cloud_state', e.message));
  const hits = new Map();
  const limited = (ip) => { const t = Date.now(), a = (hits.get(ip) || []).filter((x) => t - x < 60000); a.push(t); hits.set(ip, a); if (hits.size > 5000) hits.clear(); return a.length > 30; };
  const auth = (req) => { const e = ck(String(req.headers.authorization || '').replace(/^Bearer /, '')); if (!e) fail(401, 'غير مصرّح'); return e; };

  // آخر رقم أمر يُقرأ قبل الرصيد: كل أمر ≤ cv تكون نتيجته داخل الرصيد المقروء بعده
  async function truth(email) {
    const cv = Number((await pool.query('SELECT COALESCE(MAX(id),0) m FROM sync_cmds')).rows[0].m);
    const a = (await pool.query('SELECT pts,gems,usd,cl FROM sync_accounts WHERE LOWER(email)=$1', [email])).rows[0];
    if (!a) return null;
    const now = Date.now();
    const cl = (Array.isArray(js(a.cl)) ? js(a.cl) : []).filter((c) => c && Number(c.e) > now).map((c) => ({ i: Number(c.i), e: Number(c.e) }));
    return { cv, pts: Number(a.pts) || 0, gems: Number(a.gems) || 0, usd: Number(a.usd) || 0, cl };
  }
  const merged = (st, t) => ({ ...st, core: { ...(st.core || {}), pts: t.pts, gems: t.gems, usd: t.usd, cl: t.cl }, cv: t.cv });

  app.post('/api/v1/login', wrap(async (req, res) => {
    if (limited(req.ip)) fail(429, 'محاولات كثيرة، حاول بعد دقيقة');
    const e = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200), h = String((req.body && req.body.h) || '').slice(0, 200);
    if (!e || !h) fail(401, 'بيانات ناقصة');
    const r = (await pool.query('SELECT email, blk FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2', [e, h])).rows[0];
    if (!r) fail(401, 'بيانات الدخول غير صحيحة');
    if (r.blk) fail(403, 'الحساب محظور');
    res.json({ ok: true, token: mk(e) });
  }));

  app.get('/api/v1/state', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const e = auth(req); await ready;
    const t = await truth(e); if (!t) fail(404, 'الحساب غير موجود');
    const row = (await pool.query('SELECT ver, state FROM cloud_state WHERE email=$1', [e])).rows[0];
    if (row) row.state = js(row.state);
    if (!row || !row.state || !row.state.core) return res.json({ ok: true, ver: 0, boot: { pts: t.pts, gems: t.gems, usd: t.usd, cl: t.cl }, cv: t.cv });
    const since = req.query.since;
    if (since !== undefined && Number(since) === Number(row.ver)) return res.json({ ok: true, ver: Number(row.ver) });
    res.json({ ok: true, ver: Number(row.ver), state: merged(row.state, t) });
  }));

  app.put('/api/v1/state', wrap(async (req, res) => {
    const e = auth(req); await ready;
    const st = req.body && req.body.state, base = Math.floor(Number(req.body && req.body.base)) || 0;
    if (!st || typeof st !== 'object' || !st.core || typeof st.core !== 'object') fail(400, 'حالة غير صحيحة');
    const clean = { core: st.core, led: Array.isArray(st.led) ? st.led.slice(0, 500) : [], rfl: Array.isArray(st.rfl) ? st.rfl.slice(0, 200) : [] };
    const t = await truth(e); if (!t) fail(404, 'الحساب غير موجود');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const row = (await c.query('SELECT ver, state FROM cloud_state WHERE email=$1 FOR UPDATE', [e])).rows[0];
      if (row) row.state = js(row.state);
      const cur = row ? Number(row.ver) : 0;
      if (row && cur !== base) { await c.query('ROLLBACK'); return res.status(409).json({ ok: false, ver: cur, state: merged(row.state || clean, t) }); }
      const ver = cur + 1;
      await c.query(`INSERT INTO cloud_state(email,ver,state,dev,updated_at) VALUES($1,$2,$3::jsonb,$4,NOW())
                     ON CONFLICT (email) DO UPDATE SET ver=$2, state=$3::jsonb, dev=$4, updated_at=NOW()`,
        [e, ver, JSON.stringify(clean), String((req.body && req.body.dev) || '').slice(0, 40)]);
      await c.query('COMMIT');
      res.json({ ok: true, ver });
    } catch (err) { try { await c.query('ROLLBACK'); } catch (x) {} throw err; } finally { c.release(); }
  }));
};

/* دمج الأرصدة بالفروقات (لا استبدال مطلق): كل جهاز يرسل رصيده المحلي l وآخر رصيد استلمه k.
 * الفرق = l − (آخر رصيد يعرف السيرفر أن الجهاز يملكه) يُضاف إلى رصيد السيرفر، فلا تضيع تعديلات الإدارة ولا أرباح جهاز آخر.
 * جهاز بلا سجل سابق (ترحيل): الأكبر بين رصيده ورصيد السيرفر. */
let devReady = null;
exports.mergeBal = async (pool, email, cid, l, k) => {
  if (!devReady) devReady = pool.query(`CREATE TABLE IF NOT EXISTS dev_bal(email TEXT NOT NULL, cid TEXT NOT NULL, sp NUMERIC, sg NUMERIC, su NUMERIC, rp NUMERIC, rg NUMERIC, ru NUMERIC, at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY(email,cid))`).catch((e) => { devReady = null; throw e; });
  await devReady;
  const em = String(email).toLowerCase();
  const num = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };
  const L = [Math.max(0, Math.floor(num(l[0]))), Math.max(0, Math.floor(num(l[1]))), Math.max(0, Math.round(num(l[2]) * 100) / 100)];
  const K = Array.isArray(k) && k.length === 3 ? [num(k[0]), num(k[1]), num(k[2])] : null;
  const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && Math.abs(a[2] - b[2]) < 0.005;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const cur = (await c.query('SELECT pts,gems,usd FROM sync_accounts WHERE LOWER(email)=$1 FOR UPDATE', [em])).rows[0];
    if (!cur) { await c.query('ROLLBACK'); return null; }
    const C = [num(cur.pts), num(cur.gems), num(cur.usd)];
    const dv = (await c.query('SELECT sp,sg,su,rp,rg,ru FROM dev_bal WHERE email=$1 AND cid=$2', [em, cid])).rows[0];
    let R;
    if (!dv) {
      // جهاز بلا سجل: إن كان للحساب أجهزة معروفة فالسيرفر هو المرجع (وإلا فقد يعيد جهاز قديم رصيداً مصفّراً/معدّلاً من الإدارة)؛ أول جهاز للحساب (ترحيل) يأخذ الأكبر
      const known = (await c.query('SELECT 1 FROM dev_bal WHERE email=$1 LIMIT 1', [em])).rows.length > 0;
      R = known ? C.slice() : [Math.max(C[0], L[0]), Math.max(C[1], L[1]), Math.max(C[2], L[2])];
    }
    else {
      const sent = [num(dv.sp), num(dv.sg), num(dv.su)], ret = [num(dv.rp), num(dv.rg), num(dv.ru)];
      const base = eq(K, ret) ? ret : sent;   // لم يستلم الرد السابق => نقارن بما أرسله آخر مرة
      R = [Math.max(0, Math.round(C[0] + L[0] - base[0])), Math.max(0, Math.round(C[1] + L[1] - base[1])), Math.max(0, Math.round((C[2] + L[2] - base[2]) * 100) / 100)];
    }
    await c.query(`INSERT INTO dev_bal(email,cid,sp,sg,su,rp,rg,ru,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                   ON CONFLICT (email,cid) DO UPDATE SET sp=$3,sg=$4,su=$5,rp=$6,rg=$7,ru=$8,at=NOW()`, [em, cid, L[0], L[1], L[2], R[0], R[1], R[2]]);
    if (R[0] !== C[0] || R[1] !== C[1] || Math.abs(R[2] - C[2]) > 0.004) await c.query('UPDATE sync_accounts SET pts=$2,gems=$3,usd=$4 WHERE LOWER(email)=$1', [em, R[0], R[1], R[2]]);
    await c.query('COMMIT');
    return R;
  } catch (e) { try { await c.query('ROLLBACK'); } catch (x) {} throw e; } finally { c.release(); }
};

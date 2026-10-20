/**
 * staff-ext.js — حسابات الموظفين وصلاحياتهم على السيرفر
 *  POST /api/ctl/staff-login {u,h}      : دخول موظف (من أي جهاز) → توكن موقّع بمدة 10 ساعات
 *  POST /api/ctl/staff/sync  {list}     : (للمالك فقط: مفتاح الإدارة أو توكن المالك) مزامنة قائمة الموظفين مع السيرفر
 * وتُفرض الصلاحيات في ctlAuth (server.js) لكل مسار /api/ctl/*: توكن الموظف لا يعمل إلا على المسارات المسموحة له،
 * وما لا يوجد له تصنيف صلاحية = للمالك فقط. تُخزَّن بصمة كلمة المرور مشفّرة بـ scrypt (لا تصلح للدخول وحدها).
 */
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const mac = (s) => crypto.createHmac('sha256', crypto.createHash('sha256').update('staff-key|' + SECRET).digest()).update(s).digest('base64url');
const TTL = 10 * 3600 * 1000;
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const PERM_KEYS = ['stats', 'users', 'bal', 'products', 'agents', 'wd', 'support', 'cfg', 'ann', 'debt', 'chg', 'rq', 'ord', 'tx', 'ct', 'mr', 'rf', 'nw', 'dc', 'ctr2'];

// مسار → صلاحيات (any-of). null = للمالك فقط
function permFor(path, body) {
  const p = String(path || '').split('?')[0].replace(/^\/api\/ctl/, '');
  const t = body && body.t;
  if (/^\/(overview|counts|live-bal)/.test(p)) return ['stats'];
  if (/^\/users\/purge-demo/.test(p)) return null;
  if (/^\/(accounts|users|people|find|find-code|kycf)/.test(p)) return ['users', 'rq', 'bal'];
  if (/^\/cmd/.test(p)) return { adj: ['bal'], set: ['bal'], rz: ['ct'], rc: ['ct'], gc: ['ct'], blk: ['users'], nm: ['users'], kyc: ['rq', 'users'], vf: ['rq', 'users'], cfg: ['cfg'] }[t] || null;
  if (/^\/bal/.test(p)) return ['bal'];
  if (/^\/(agents|agent-buys)/.test(p)) return ['agents'];
  if (/^\/inbox/.test(p)) return ['wd', 'rq', 'ord', 'mr', 'debt', 'chg'];
  if (/^\/support/.test(p)) return ['support'];
  if (/^\/config/.test(p)) return ['cfg', 'dc', 'ann', 'nw', 'products'];
  if (/^\/news/.test(p)) return ['nw'];
  if (/^\/pts-requests/.test(p)) return ['chg'];
  if (/^\/merchants/.test(p)) return ['mr'];
  if (/^\/store\/cards/.test(p)) return ['products'];
  if (/^\/store/.test(p)) return ['ord'];
  if (/^\/counters-hub/.test(p)) return ['ct'];
  if (/^\/loans/.test(p)) return ['debt'];
  return null;
}

module.exports = (app, express, deps) => {
  const { pool, wrap, fail, ctl, ownerOk, adminOk } = deps;
  const jsonBody = express.json({ limit: '200kb' });
  const ready = pool.query(`CREATE TABLE IF NOT EXISTS staff_users(u TEXT PRIMARY KEY, h TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', perms JSONB NOT NULL DEFAULT '[]', off BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    .catch((e) => console.error('staff schema:', e.message));
  const kdf = (h, salt) => 's1:' + salt + ':' + crypto.scryptSync(String(h), salt, 32).toString('hex');
  const same = (h, stored) => { const [v, salt, hex] = String(stored).split(':'); if (v !== 's1' || !salt) return false; const a = Buffer.from(crypto.scryptSync(String(h), salt, 32).toString('hex')), b = Buffer.from(hex || ''); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  const hits = new Map();
  const limited = (ip) => { const t = Date.now(), a = (hits.get(ip) || []).filter((x) => t - x < 15 * 60000); a.push(t); hits.set(ip, a); if (hits.size > 3000) hits.clear(); return a.length > 12; };

  const cache = new Map(); // u -> {t, row}
  async function live(u) {
    const c = cache.get(u); if (c && Date.now() - c.t < 20000) return c.row;
    await ready; const row = (await pool.query(`SELECT u,role,perms,off FROM staff_users WHERE u=$1`, [u])).rows[0] || null;
    cache.set(u, { t: Date.now(), row }); return row;
  }
  const mk = (o) => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + mac(p); };
  const parse = (tok) => {
    const [p, m] = String(tok || '').split('.'); if (!p || !m) return null;
    const x = mac(p); if (x.length !== m.length || !crypto.timingSafeEqual(Buffer.from(x), Buffer.from(m))) return null;
    try { const j = JSON.parse(Buffer.from(p, 'base64url').toString()); return j && j.u && j.x > Date.now() ? j : null; } catch (_) { return null; }
  };
  // يُستدعى من ctlAuth: يرجع {ok} أو يرمي 401/403
  app.locals.staffAuth = async (req) => {
    const j = parse(req.get('x-staff-token')); if (!j) return null;
    const row = await live(j.u); if (!row || row.off) return null;
    const need = permFor(req.originalUrl, req.body);
    const perms = Array.isArray(row.perms) ? row.perms : [];
    if (!need || !need.some((k) => perms.includes(k))) return { denied: true };
    return { ok: true, u: j.u };
  };

  app.post('/api/ctl/staff-login', jsonBody, wrap(async (req, res) => {
    if (limited(req.ip)) fail(429, 'محاولات كثيرة، حاول بعد قليل');
    await ready;
    const u = txt((req.body || {}).u, 60).toLowerCase(), h = txt((req.body || {}).h, 200);
    if (!u || !h) fail(401, 'بيانات الدخول غير صحيحة');
    const r = (await pool.query(`SELECT * FROM staff_users WHERE u=$1`, [u])).rows[0];
    const ok = r && !r.off && same(h, r.h);
    if (!ok) fail(401, 'بيانات الدخول غير صحيحة');
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, u, role: r.role, p: r.perms, token: mk({ u, x: Date.now() + TTL }) });
  }));

  app.post('/api/ctl/staff/sync', jsonBody, wrap(async (req, res) => {
    if (!(ownerOk(req) || adminOk(req))) fail(403, 'للمالك فقط');
    await ready;
    const list = Array.isArray((req.body || {}).list) ? req.body.list.slice(0, 200) : [];
    const keep = [];
    for (const s of list) {
      const u = txt(s && s.u, 60).toLowerCase(); if (!/^[a-z0-9_.-]{2,60}$/.test(u)) continue;
      const perms = (Array.isArray(s.p) ? s.p : []).filter((k) => PERM_KEYS.includes(k));
      const role = s.role === 'agent' ? 'agent' : 'staff', off = !!s.off, h = txt(s.h, 200);
      keep.push(u);
      const ex = (await pool.query(`SELECT h FROM staff_users WHERE u=$1`, [u])).rows[0];
      if (ex && (!h || same(h, ex.h))) await pool.query(`UPDATE staff_users SET role=$2, perms=$3::jsonb, off=$4, updated_at=NOW() WHERE u=$1`, [u, role, JSON.stringify(perms), off]);
      else if (h) await pool.query(`INSERT INTO staff_users(u,h,role,perms,off) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT (u) DO UPDATE SET h=EXCLUDED.h, role=EXCLUDED.role, perms=EXCLUDED.perms, off=EXCLUDED.off, updated_at=NOW()`, [u, kdf(h, crypto.randomBytes(12).toString('hex')), role, JSON.stringify(perms), off]);
    }
    await pool.query(`DELETE FROM staff_users WHERE NOT (u = ANY($1))`, [keep]);
    cache.clear();
    res.json({ ok: true, n: keep.length });
  }));
};
module.exports.permFor = permFor;

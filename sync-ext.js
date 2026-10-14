/* sync-ext.js — مزامنة فورية للطلبات وطلبات السحب بين أجهزة المستخدمين ولوحة التحكم
   الاستخدام داخل server.js (مباشرةً بعد السطر const app = express()):
       require('./sync-ext')(app, express);
   يحفظ البيانات في الملف sync-data.json (أو المسار في متغير SYNC_FILE). */
const fs = require('fs'), path = require('path');
module.exports = function (app, express) {
  const FILE = process.env.SYNC_FILE || path.join(__dirname, 'sync-data.json');
  let DB = { seq: 0, ords: {}, wreq: {}, rq: {} };
  try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (j && j.ords && j.wreq) { DB = j; if (!DB.rq) DB.rq = {}; } } catch (e) {}
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => { try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(DB)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('sync save:', e.message); } }, 800); };
  const parse = express.json({ limit: '8mb' });
  const KINDS = ['ords', 'wreq', 'rq'];
  /* rq = طلبات الوكالة فقط؛ مالك السجل في الحقل e (البريد) بدل u */
  const owner = (k, r) => email(k === 'rq' ? r.e : r.u);
  const rqOk = (k, r) => k !== 'rq' || r.t === 'طلب وكالة';
  const email = x => String(x || '').trim().toLowerCase();
  const okId = x => /^[A-Za-z0-9_-]{2,24}$/.test(String(x));
  const touch = (k, id, rec) => { rec._mt = ++DB.seq; DB[k][id] = rec; return rec._mt; };
  const trim = () => KINDS.forEach(k => { const ids = Object.keys(DB[k]); if (ids.length > 5000) ids.sort((a, b) => DB[k][a]._mt - DB[k][b]._mt).slice(0, ids.length - 5000).forEach(i => delete DB[k][i]); });
  const admin = (req, res) => {
    const k = process.env.ADMIN_KEY;
    if (!k) { res.status(503).json({ error: 'ADMIN_KEY غير مضبوط' }); return 0; }
    if (req.get('X-Admin-Key') !== k) { res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' }); return 0; }
    return 1;
  };

  /* المستخدم يرفع طلباته وطلبات سحبه (جديدة، أو تحديث عدد الأقساط المسددة) */
  app.post('/api/sync/push', parse, (req, res) => {
    const b = req.body || {}, e = email(b.e);
    if (!e) return res.status(400).json({ error: 'e' });
    KINDS.forEach(k => (Array.isArray(b[k]) ? b[k] : []).slice(0, 20).forEach(r => {
      if (!r || !okId(r.id)) return;
      const id = String(r.id), ex = DB[k][id];
      if (ex) {
        if (owner(k, ex) !== e) return;
        if (k === 'ords' && +r.paid > (+ex.paid || 0) && +r.paid <= 60) { ex.paid = +r.paid; touch(k, id, ex); }
        return;
      }
      if (owner(k, r) !== e || !rqOk(k, r) || JSON.stringify(r).length > 700000) return;
      const rec = Object.assign({}, r); delete rec._mt; touch(k, id, rec);
    }));
    trim(); save(); res.json({ ok: 1, seq: DB.seq });
  });

  /* المستخدم يقرأ حالة طلباته (بدون رقم الحساب أو الباركود) */
  app.get('/api/sync/mine', (req, res) => {
    const e = email(req.query.e), since = +req.query.since || 0;
    if (!e) return res.status(400).json({ error: 'e' });
    const o = { seq: DB.seq, idx: { ords: {}, wreq: {}, rq: {} }, recs: { ords: [], wreq: [], rq: [] } };
    KINDS.forEach(k => Object.values(DB[k]).forEach(r => {
      if (owner(k, r) !== e) return;
      o.idx[k][r.id] = +r.paid || 0;
      if (r._mt > since) { const m = { id: r.id, _mt: r._mt, st: r.st, why: r.why }; if (k === 'rq') { m.s = r.s; m.rf = r.rf; } if (k === 'ords') { m.h = r.h; m.rej = r.rej; m.paid = r.paid; } o.recs[k].push(m); }
    }));
    res.set('Cache-Control', 'no-store'); res.json(o);
  });

  /* لوحة التحكم: قراءة كل الطلبات والسحوبات (بالتدريج) */
  app.get('/api/ctl/inbox', (req, res) => {
    if (!admin(req, res)) return;
    const since = +req.query.since || 0, all = [];
    KINDS.forEach(k => Object.values(DB[k]).forEach(r => { if (r._mt > since) all.push([k, r]); }));
    all.sort((a, b) => a[1]._mt - b[1]._mt);
    const o = { seq: DB.seq, ords: [], wreq: [], rq: [], next: since, more: all.length > 100 };
    all.slice(0, 100).forEach(([k, r]) => { o[k].push(r); o.next = r._mt; });
    res.set('Cache-Control', 'no-store'); res.json(o);
  });

  /* لوحة التحكم: حفظ تغيير الحالة (موافقة / رفض / تسليم / دفع) */
  app.post('/api/ctl/inbox/upsert', parse, (req, res) => {
    if (!admin(req, res)) return;
    const b = req.body || {}, k = b.kind;
    if (!KINDS.includes(k)) return res.status(400).json({ error: 'kind' });
    const mt = {};
    (Array.isArray(b.recs) ? b.recs : []).slice(0, 100).forEach(r => {
      if (!r || !okId(r.id) || !rqOk(k, r)) return;
      const id = String(r.id), ex = DB[k][id] || {}, rec = Object.assign({}, ex, r);
      if (k === 'ords') rec.paid = Math.max(+ex.paid || 0, +r.paid || 0) || rec.paid;
      mt[id] = touch(k, id, rec);
    });
    save(); res.json({ ok: 1, mt, seq: DB.seq });
  });
  return { ords: () => DB.ords };
};

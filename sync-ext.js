/* sync-ext.js — مزامنة فورية للطلبات وطلبات السحب بين أجهزة المستخدمين ولوحة التحكم
   الاستخدام داخل server.js (مباشرةً بعد السطر const app = express()):
       require('./sync-ext')(app, express);
   يحفظ البيانات في الملف sync-data.json (أو المسار في متغير SYNC_FILE). */
const fs = require('fs'), path = require('path');
module.exports = function (app, express) {
  const FILE = process.env.SYNC_FILE || path.join(__dirname, 'sync-data.json');
  let DB = { seq: 0, ords: {}, wreq: {}, rq: {} };
  try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (j && j.ords && j.wreq) { DB = j; if (!DB.rq) DB.rq = {}; } } catch (e) {}
  // ملفات التوثيق (هوية + عقد) تُخزَّن منفصلة عن سجل الطلب لأنها كبيرة
  const KFILE = FILE + '.kyc.json';
  let KF = {}; try { KF = JSON.parse(fs.readFileSync(KFILE, 'utf8')) || {}; } catch (e) {}
  let ktimer = null;
  const ksave = () => { clearTimeout(ktimer); ktimer = setTimeout(() => { try { fs.writeFileSync(KFILE + '.tmp', JSON.stringify(KF)); fs.renameSync(KFILE + '.tmp', KFILE); } catch (e) { console.error('kyc save:', e.message); } }, 800); };
  // بث فوري (SSE) لأي تغيير في الطلبات: لوحة التحكم وجهاز صاحب الطلب يسحبان التحديث لحظياً
  const ping = (rec) => { try { if (app.locals.broadcastStore) app.locals.broadcastStore({ k: 'inbox', t: rec && rec.t, e: rec && (rec.e || rec.u) }); } catch (e) {} };
  let timer = null;
  const save = () => { clearTimeout(timer); timer = setTimeout(() => { try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(DB)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('sync save:', e.message); } }, 800); };
  const parse = express.json({ limit: '8mb' });
  const KINDS = ['ords', 'wreq', 'rq'];
  /* rq = طلبات الوكالة + انضمام التجار + توثيق الهوية؛ مالك السجل في الحقل e (البريد) بدل u */
  const owner = (k, r) => email(k === 'rq' ? r.e : r.u);
  const RQT = ['طلب وكالة', 'انضمام تاجر', 'توثيق هوية'];
  const rqOk = (k, r) => k !== 'rq' || RQT.includes(r.t);
  const email = x => String(x || '').trim().toLowerCase();
  const okId = x => /^[A-Za-z0-9_-]{2,24}$/.test(String(x));
  const touch = (k, id, rec) => { rec._mt = ++DB.seq; DB[k][id] = rec; return rec._mt; };
  const trim = () => KINDS.forEach(k => { const ids = Object.keys(DB[k]); if (ids.length > 5000) ids.sort((a, b) => DB[k][a]._mt - DB[k][b]._mt).slice(0, ids.length - 5000).forEach(i => delete DB[k][i]); });
  const admin = (req, res) => {
    const k = process.env.ADMIN_KEY;
    if (!k) { res.status(503).json({ error: 'ADMIN_KEY غير مضبوط' }); return 0; }
    if (!(() => { try { const x = Buffer.from(String(req.get('X-Admin-Key') || '')), y = Buffer.from(k); return x.length === y.length && require('crypto').timingSafeEqual(x, y); } catch (e) { return false; } })()) { res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' }); return 0; }
    return 1;
  };

  /* المستخدم يرفع طلباته وطلبات سحبه (جديدة، أو تحديث عدد الأقساط المسددة) */
  /* هوية المستخدم لمسارات الطلبات: البريد المستخدم في الطلب + بصمة كلمة المرور (ترويسة x-h) */
  const needAuth = (req, res, next) => {
    const au = req.app.locals.authEmail, e = email((req.body && req.body.e) || req.query.e), h = req.get('x-h') || (req.body && req.body.h);
    if (!au || !e || !h) return res.status(401).json({ error: 'auth' });
    au(e, h).then((ok) => (ok && ok === e ? next() : res.status(401).json({ error: 'auth' }))).catch(() => res.status(401).json({ error: 'auth' }));
  };

  app.post('/api/sync/push', parse, needAuth, async (req, res) => {
    const b = req.body || {}, e = email(b.e);
    if (!e) return res.status(400).json({ error: 'e' });
    // لقطة من رصيد الدولار على الخادم لحظة وصول طلب السحب (يراها المدير للمطابقة)، وحدود منطقية للمبلغ
    let svUsd = null;
    try { const P = req.app.locals.pool; if (P && Array.isArray(b.wreq) && b.wreq.length) svUsd = Number((await P.query('SELECT usd FROM sync_accounts WHERE LOWER(email)=$1', [e])).rows[0]?.usd); } catch (x) { svUsd = null; }
    KINDS.forEach(k => (Array.isArray(b[k]) ? b[k] : []).slice(0, 20).forEach(r => {
      if (!r || !okId(r.id)) return;
      const id = String(r.id), ex = DB[k][id];
      if (ex) {
        if (owner(k, ex) !== e) return;
        if (k === 'ords' && +r.paid > (+ex.paid || 0) && +r.paid <= 60) { ex.paid = +r.paid; touch(k, id, ex); }
        return;
      }
      if (owner(k, r) !== e || !rqOk(k, r) || JSON.stringify(r).length > 700000) return;
      if (k === 'wreq') { const amt = +r.a; if (!(amt > 0) || amt > 1e6) return; }
      const rec = Object.assign({}, r); delete rec._mt;
      if (k === 'wreq' && Number.isFinite(svUsd)) rec.sv = svUsd;
      touch(k, id, rec); ping(rec);
    }));
    trim(); save(); res.json({ ok: 1, seq: DB.seq });
  });

  /* المستخدم يقرأ حالة طلباته (بدون رقم الحساب أو الباركود) */
  app.get('/api/sync/mine', needAuth, (req, res) => {
    const e = email(req.query.e), since = +req.query.since || 0;
    if (!e) return res.status(400).json({ error: 'e' });
    const o = { seq: DB.seq, idx: { ords: {}, wreq: {}, rq: {} }, recs: { ords: [], wreq: [], rq: [] } };
    KINDS.forEach(k => Object.values(DB[k]).forEach(r => {
      if (owner(k, r) !== e) return;
      o.idx[k][r.id] = +r.paid || 0;
      if (r._mt > since) { const m = { id: r.id, _mt: r._mt, st: r.st, why: r.why }; if (k === 'rq') { m.s = r.s; m.rf = r.rf; } if (k === 'ords') { m.h = r.h; m.rej = r.rej; m.paid = r.paid; } if (r.del) m.del = 1; o.recs[k].push(m); }
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
      const id = String(r.id), ex = DB[k][id] || {};
      if (ex.del && !r.del) return; // طلب محذوف: لا يُعاد إحياؤه من نسخة قديمة
      const rec = Object.assign({}, ex, r);
      if (k === 'ords') rec.paid = Math.max(+ex.paid || 0, +r.paid || 0) || rec.paid;
      mt[id] = touch(k, id, rec); ping(rec);
    });
    save(); res.json({ ok: 1, mt, seq: DB.seq });
  });
  /* المستخدم يرفع ملفات التوثيق بعد رفع الطلب نفسه */
  app.post('/api/sync/kycf', express.json({ limit: '9mb' }), needAuth, (req, res) => {
    const b = req.body || {}, e = email(b.e), id = String(b.id || '');
    if (!e || !okId(id)) return res.status(400).json({ error: 'e' });
    const rq = DB.rq[id];
    if (!rq || email(rq.e) !== e || rq.t !== 'توثيق هوية') return res.status(404).json({ error: 'no-request' });
    const f = b.f;
    if (!f || typeof f !== 'object' || JSON.stringify(f).length > 8e6) return res.status(400).json({ error: 'file' });
    KF[id] = { c: f.c || null, i: f.i || null, at: Date.now() };
    const ks = Object.keys(KF); if (ks.length > 400) ks.sort((x, y) => (KF[x].at || 0) - (KF[y].at || 0)).slice(0, ks.length - 400).forEach(x => delete KF[x]);
    ksave(); ping(rq); res.json({ ok: 1 });
  });
  app.get('/api/ctl/kycf', (req, res) => {
    if (!admin(req, res)) return;
    const f = KF[String(req.query.id || '')];
    res.set('Cache-Control', 'no-store'); res.json(f ? { ok: 1, f } : { ok: 0 });
  });
  app.get('/api/sync/kycf-has', needAuth, (req, res) => {
    const e = email(req.query.e); const ids = Object.keys(KF).filter(i => DB.rq[i] && email(DB.rq[i].e) === e);
    res.set('Cache-Control', 'no-store'); res.json({ ids });
  });
  /* لوحة التحكم: حذف طلبات المتجر نهائياً (يبقى أثر «محذوف» لمنع عودتها من أجهزة المستخدمين) */
  app.post('/api/ctl/inbox/delete', parse, (req, res) => {
    if (!admin(req, res)) return;
    const b = req.body || {};
    if (b.kind !== 'ords') return res.status(400).json({ error: 'kind' });
    const mt = {};
    (Array.isArray(b.ids) ? b.ids : []).slice(0, 500).forEach(x => {
      const id = String(x);
      if (!okId(id)) return;
      const ex = DB.ords[id] || {};
      mt[id] = touch('ords', id, { id, u: ex.u || '', paid: +ex.paid || 0, del: 1 });
    });
    save(); res.json({ ok: 1, mt, seq: DB.seq });
  });
  return { ords: () => DB.ords, wreq: () => DB.wreq };
};

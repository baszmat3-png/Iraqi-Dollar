/**
 * auth-guard.js — يحدّ من تخمين بصمة كلمة المرور (x-h) على كل مسارات /api
 *  - يُحسب فقط الطلب الذي يحمل بصمة ويردّ 401 (بصمة خاطئة)
 *  - الحد لكل بريد (20 محاولة/15 دقيقة) ولكل IP (300/15 دقيقة؛ شبكات الهاتف تشارك العنوان)
 *  - زوج (بريد + بصمة) سبق أن نجح لا يُحجب أبداً، فلا يتعطل صاحب الحساب الحقيقي
 *    إذا كان جهاز قديم ببصمة خاطئة يكرر الطلب
 */
const crypto = require('crypto');
module.exports = function () {
  const WIN = 15 * 60 * 1000, MAX_E = 20, MAX_IP = 300;
  const bad = new Map();   // مفتاح -> { n, t }
  const good = new Map();  // email|sha(h) -> وقت آخر نجاح
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32);
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch (x) { return String(v || ''); } };
  const count = (k) => { const f = bad.get(k); return f && Date.now() - f.t < WIN ? f.n : 0; };
  const hit = (k) => {
    const f = bad.get(k);
    if (!f || Date.now() - f.t >= WIN) bad.set(k, { n: 1, t: Date.now() }); else f.n++;
    if (bad.size > 50000) bad.clear();
  };
  setInterval(() => {
    const n = Date.now();
    for (const [k, f] of bad) if (n - f.t >= WIN) bad.delete(k);
    for (const [k, t] of good) if (n - t > 6 * 3600 * 1000) good.delete(k);
  }, 5 * 60 * 1000).unref();

  return function authGuard(req, res, next) {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const h = String(req.get('x-h') || b.h || '').slice(0, 200);
    if (!h) return next();
    const e = dec(req.get('x-e') || b.e || b.email || req.query.e || req.query.email).trim().toLowerCase().slice(0, 120);
    const gk = e + '|' + sha(h);
    const known = !!e && good.has(gk);
    if (!known && ((e && count('e:' + e) >= MAX_E) || count('i:' + req.ip) >= MAX_IP)) {
      return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل' });
    }
    res.on('finish', () => {
      if (res.statusCode === 401) {
        if (known) good.delete(gk); // تغيّرت كلمة المرور من جهاز آخر
        else { if (e) hit('e:' + e); hit('i:' + req.ip); }
      } else if (e && res.statusCode < 400) {
        if (good.size > 20000) good.clear();
        good.set(gk, Date.now());
      }
    });
    next();
  };
};

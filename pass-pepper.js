/**
 * pass-pepper.js — تخزين بصمة كلمة المرور على السيرفر بشكل لا يصلح للدخول وحده (حماية من تسريب قاعدة البيانات)
 *
 * المشكلة: الواجهة ترسل بصمة كلمة المرور (SHA-256) والسيرفر يخزنها كما هي ويقبلها دليل هوية، فتسريب جدول sync_accounts
 * أو نسخة احتياطية = دخول فوري لكل الحسابات (pass-the-hash).
 *
 * الحل: يعمل «فلتر» مبكر على كل /api: أي بصمة واردة (ترويسة x-h أو h/pass_hash في الجسم أو accounts[].h في التقرير)
 * تُستبدل قبل وصولها لأي مسار بـ  p1:HMAC-SHA256(PASS_PEPPER, بصمة).  فتبقى كل استعلامات (pass_hash = $2) الموجودة
 * كما هي، لكن ما في قاعدة البيانات صار HMAC لا يمكن استعماله كبصمة (لأن أي قيمة يرسلها المهاجم تُمرَّر عبر HMAC أيضاً).
 * السر PASS_PEPPER يبقى في متغيرات البيئة فقط (ليس في قاعدة البيانات).
 *
 * الترحيل تدريجي وبلا توقف: عند أول طلب صحيح لكل حساب (البصمة الواردة = المخزَّنة القديمة) يُحوَّل صفه إلى p1:… ويُحفظ القديم
 * في pass_hash_old للتراجع. حسابات لم تُرحَّل بعد تعمل كما هي.
 *
 * التفعيل: PASS_PEPPER=<نص عشوائي طويل ≥ 24 حرفاً>. بدونه لا يتغير أي سلوك.
 * التراجع:  UPDATE sync_accounts SET pass_hash=pass_hash_old WHERE pass_hash_old IS NOT NULL;  ثم احذف PASS_PEPPER.
 * الإنهاء (بعد التأكد أن كل شيء سليم):  UPDATE sync_accounts SET pass_hash_old=NULL;   ← بعدها لا تراجع.
 * تنبيه: ضياع PASS_PEPPER بعد الترحيل = تعذّر دخول الحسابات المرحَّلة؛ احتفظ بنسخة منه.
 */
const crypto = require('crypto');

module.exports = function createPepper(pool) {
  const KEY = String(process.env.PASS_PEPPER || '');
  const enabled = KEY.length >= 24;
  if (process.env.PASS_PEPPER && !enabled) console.error('PASS_PEPPER أقصر من 24 حرفاً: تم تجاهله (الحماية غير مفعّلة)');
  const pp = (h) => 'p1:' + crypto.createHmac('sha256', KEY).update('h1:' + String(h)).digest('hex');

  const api = {
    enabled,
    map: (h) => (enabled ? pp(h) : String(h)),      // قيمة تُقارَن/تُخزَّن
    middleware: (req, res, next) => next(),
  };
  if (!enabled) return api;

  const q = (s, p) => pool.query(s, p);
  q(`ALTER TABLE sync_accounts ADD COLUMN IF NOT EXISTS pass_hash_old TEXT`).catch((e) => console.error('pass_hash_old:', e.message));
  const migrated = new Set();          // بريد → رُحِّل (لا حاجة لاستعلام آخر)
  const dec = (v) => { try { return decodeURIComponent(String(v || '')); } catch (x) { return String(v || ''); } };
  const nrm = (e) => dec(e).trim().toLowerCase().slice(0, 120);
  const SKIP = /^\/api\/ctl\/owner-login/;   // بصمة المالك تُقارَن بمتغير البيئة، لا بقاعدة البيانات

  async function upgrade(email, raw) {
    if (!email || migrated.has(email)) return;
    const mapped = pp(raw);
    const r = (await q(`SELECT pass_hash FROM sync_accounts WHERE LOWER(email)=$1`, [email])).rows[0];
    if (!r || !r.pass_hash) return;
    if (String(r.pass_hash).startsWith('p1:')) { migrated.add(email); if (migrated.size > 100000) migrated.clear(); return; }
    if (String(r.pass_hash).startsWith('$2')) return;       // bcrypt (حسابات users القديمة) لا تُمسّ
    if (r.pass_hash === raw) {                               // دليل صحيح للبصمة القديمة: رحِّل الصف
      await q(`UPDATE sync_accounts SET pass_hash_old=COALESCE(pass_hash_old, pass_hash), pass_hash=$2 WHERE LOWER(email)=$1 AND pass_hash=$3`, [email, mapped, raw]);
      migrated.add(email);
    }
  }

  api.middleware = async function passPepper(req, res, next) {
    try {
      if (SKIP.test(req.path)) return next();
      const b = req.body && typeof req.body === 'object' ? req.body : null;
      const hdr = req.headers['x-h'];
      const hasHdr = typeof hdr === 'string' && hdr;
      const items = [];       // { raw, email, set(v) }
      const bodyEmail = nrm((b && (b.e || b.email)) || req.headers['x-e'] || '');
      if (hasHdr) items.push({ raw: String(hdr).slice(0, 200), email: nrm(req.headers['x-e'] || (b && (b.e || b.email)) || ''), set: (v) => { req.headers['x-h'] = v; } });
      if (b) {
        ['h', 'pass_hash'].forEach((k) => { if (typeof b[k] === 'string' && b[k]) items.push({ raw: b[k].slice(0, 200), email: bodyEmail, set: (v) => { b[k] = v; } }); });
        if (Array.isArray(b.accounts)) b.accounts.slice(0, 20).forEach((a) => { if (a && typeof a.h === 'string' && a.h) items.push({ raw: a.h.slice(0, 200), email: nrm(a.e), set: (v) => { a.h = v; } }); });
      }
      if (!items.length) return next();
      req._h0 = items[0].raw;              // البصمة الأصلية (للمسارات التي ترجعها لصاحبها نفسه، مثل /api/sec/login)
      for (const it of items) { await upgrade(it.email, it.raw).catch(() => {}); it.set(pp(it.raw)); }
      next();
    } catch (e) { next(e); }
  };
  return api;
};

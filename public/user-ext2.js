/* المرحلة 2أ (واجهة) — صورة شخصية دائمة من السيرفر + كليشة الدعوة + زر المشاركة */
(function () {
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (e) { return null; } };
  const AVX = (window.AVX = { map: {}, ok: false });
  const enc = encodeURIComponent;
  AVX.url = (e) => { e = String(e || '').toLowerCase(); return AVX.map[e] ? `/api/avatar?e=${enc(e)}&v=${AVX.map[e]}` : ''; };

  /* ---- الصورة: مصغّرة مربعة 256px وتُرفع للسيرفر ---- */
  const square = (file) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
      ok(c.toDataURL('image/jpeg', 0.8));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  window.addEventListener('change', async (ev) => {
    if (!ev.target || ev.target.id !== 'pf') return;
    ev.stopImmediatePropagation();
    const fl = ev.target.files && ev.target.files[0]; if (!fl) return;
    const id = me(); if (!id) return say('سجّل الدخول أولاً');
    try {
      const img = await square(fl);
      S.av = img; draw(); // معاينة فورية
      const r = await fetch('/api/u/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...id, img }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'تعذر الحفظ');
      AVX.map[id.e.toLowerCase()] = j.v; S.av = AVX.url(id.e); draw();
      say('تم حفظ صورتك وستظهر للجميع');
    } catch (e) { say(e.message || 'تعذر رفع الصورة'); }
  }, true);

  /* ---- مزامنة كل 5 ثوانٍ ---- */
  let lastSig = '';
  async function poll() {
    if (document.hidden) return;
    try {
      const j = await fetch('/api/avatars', { cache: 'no-store' }).then((r) => r.json());
      AVX.map = j.map || {}; AVX.ok = true;
      const sig = JSON.stringify(AVX.map);
      const id = me(); if (id) { const u = AVX.url(id.e); if (u && S.av !== u && !String(S.av).startsWith('data:')) S.av = u; else if (u && !S.av) S.av = u; else if (!u && String(S.av).startsWith('/api/avatar')) S.av = ''; }
      if (sig !== lastSig) { lastSig = sig; if (['profile', 'users'].includes(S.r)) { const d = document.querySelector('#d'); if (!(d && d.open) && !document.activeElement.matches('input,textarea')) draw(); } }
    } catch (e) {}
  }
  setInterval(poll, 5000); setTimeout(poll, 800);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  /* ---- كليشة الدعوة ---- */
  const code = () => { try { return S.acc ? ucode({ e: S.acc.e }) : ''; } catch (e) { return ''; } };
  const link = () => location.origin + '/';
  AVX.text = (c) => `🎁 دعوة للانضمام إلى منصة «الكنز العراقي»

اربح نقاطاً يومياً عبر العدادات، واشترِ من المتجر، وحوّل لأصدقائك بسهولة.

خطوات البدء:
1️⃣ افتح رابط المنصة وأنشئ حساباً جديداً
2️⃣ أدخل رمز الدعوة الخاص بي عند التسجيل: ${c}
3️⃣ فعّل عدادك وابدأ الربح اليومي

🔗 رابط المنصة: ${link()}`;
  const copyText = (t, msg) => {
    const fb = () => { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;opacity:0'; document.body.append(x); x.select(); try { document.execCommand('copy'); say(msg); } catch (e) { say('تعذر النسخ'); } x.remove(); };
    try { navigator.clipboard.writeText(t).then(() => say(msg), fb); } catch (e) { fb(); }
  };
  const shareText = (t) => { if (navigator.share) navigator.share({ title: 'الكنز العراقي', text: t }).catch(() => {}); else copyText(t, 'تم نسخ الدعوة'); };

  AVX.inviteCard = () => { const c = code(); if (!c) return ''; return `<div class="card" id="avx-inv"><b style="font-size:1.1rem">ادعُ أصدقاءك واربح</b><p class="mu" style="margin:6px 0 10px">انسخ الدعوة الجاهزة أو شاركها مباشرة. تحصل على عمولة عندما يشتري صديقك عداداً برمزك <b dir="ltr" class="cy">${esc(c)}</b>.</p><div class="row"><button class="btn" data-avx="icopy">نسخ الدعوة</button><button class="btn o" data-avx="ishare">مشاركة</button></div></div>`; };

  // نسخ الرمز من الإعدادات: ينسخ الرمز ثم تظهر الكليشة
  window.rcCopy = function (t) {
    copyText(t, 'تم نسخ الرمز: ' + t);
    const c = code() || t;
    dlg(`<h2 style="margin-top:0">دعوة جاهزة للمشاركة</h2><p class="mu">هذه رسالة الدعوة مع رمزك ورابط المنصة:</p><pre dir="rtl" style="white-space:pre-wrap;background:#0b141c;border:1.5px solid var(--line);border-radius:16px;padding:12px;font:inherit;font-size:.9rem;line-height:1.7">${esc(AVX.text(c))}</pre><div class="row"><button class="btn" data-avx="icopy">نسخ الدعوة</button><button class="btn o" data-avx="ishare">مشاركة</button></div>`);
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-avx]'); if (!b) return;
    const t = AVX.text(code());
    if (b.dataset.avx === 'icopy') copyText(t, 'تم نسخ الدعوة'); else if (b.dataset.avx === 'ishare') shareText(t);
  });

  /* ---- إدراج بطاقة الدعوة في الملف الشخصي والمستخدمين بعد كل رسم ---- */
  const _draw = window.draw;
  window.draw = function () {
    const r = _draw.apply(this, arguments);
    try {
      const a = document.querySelector('#app');
      if (a && !a.querySelector('#avx-inv')) {
        if (S.r === 'profile') { const n = a.querySelector('nav'); const h = AVX.inviteCard(); if (h && n) n.insertAdjacentHTML('beforebegin', h); }
        else if (S.r === 'users') { const m = a.querySelector('.u2-me'); const h = AVX.inviteCard(); if (h && m) m.insertAdjacentHTML('afterend', h); }
      }
    } catch (e) {}
    return r;
  };
})();

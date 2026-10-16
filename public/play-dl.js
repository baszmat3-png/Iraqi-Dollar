/* زر تحميل تطبيق أندرويد بشعار متجر Google Play — الرابط مخفي تحت الأيقونة */
(function () {
  if (typeof S === 'undefined' || typeof draw !== 'function') return;
  // داخل تطبيق الأندرويد نفسه (WebView) لا حاجة للزر
  const ua = navigator.userAgent || '';
  if (/;\s*wv\)/.test(ua) || window.Android || window.Capacitor || /AppAndroid/i.test(ua)) return;
  const APK = 'https://github.com/baszmat3-png/Iraqi-Dollar-App/releases/download/latest/app-release.apk';
  const ID = 'apkdl';
  const css = document.createElement('style');
  css.textContent = `
  #${ID}{display:flex;justify-content:center;margin:18px 0 4px}
  #${ID} a{display:inline-flex;align-items:center;gap:12px;direction:ltr;text-decoration:none;color:#fff;background:#000;border:1.5px solid #a6a6a6;border-radius:12px;padding:8px 18px 8px 14px;min-width:190px;box-shadow:0 4px 16px #0006;transition:transform .15s}
  #${ID} a:active{transform:scale(.97)}
  #${ID} svg{width:30px;height:32px;flex:none}
  #${ID} .t{display:grid;line-height:1.15;text-align:left}
  #${ID} .t small{font-size:.62rem;letter-spacing:.4px;text-transform:uppercase;opacity:.9}
  #${ID} .t b{font-size:1.15rem;font-weight:600}
  #${ID} .t i{font-style:normal;font-size:.7rem;opacity:.75;direction:rtl}`;
  document.head.appendChild(css);
  const LOGO = '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="#00d7fe" d="M48 59v394c0 12 8 19 18 14L270 256 66 45c-10-5-18 2-18 14z"/><path fill="#00f076" d="M356 170L100 22c-10-6-22-6-30 2l200 200 86-54z" transform="translate(0 0)"/><path fill="#ff3a44" d="M70 488c8 8 20 8 30 2l256-148-86-54L70 488z"/><path fill="#ffd500" d="M356 170l-86 86 86 86 90-52c18-10 18-30 0-40l-90-80z"/></svg>';
  function inject() {
    const app = document.getElementById('app');
    if (!app || document.getElementById(ID)) return;
    const R = S.r; let anchor = null, before = false;
    if (R === 'welcome') anchor = app.querySelector('[data-r="signup"]');
    else if (R === 'login') anchor = app.querySelector('[data-a="dologin"]');
    else if (R === 'signup') anchor = app.querySelector('[data-a="dosign"]');
    else if (R === 'profile') { anchor = app.querySelector('[data-a="logout"]'); before = true; } // فوق تسجيل الخروج
    if (!anchor) return;
    const d = document.createElement('div');
    d.id = ID;
    d.innerHTML = '<a href="' + APK + '" download rel="noopener" aria-label="تحميل التطبيق لأندرويد">' + LOGO +
      '<span class="t"><small>Android App</small><b>Google Play</b><i>اضغط لتحميل التطبيق</i></span></a>';
    if (before) anchor.insertAdjacentElement('beforebegin', d);
    else (R === 'welcome' ? anchor.parentElement : anchor).insertAdjacentElement('afterend', d);
  }
  const _d = window.draw;
  window.draw = function () { const r = _d.apply(this, arguments); try { inject(); } catch (e) {} return r; };
  try { inject(); } catch (e) {}
})();

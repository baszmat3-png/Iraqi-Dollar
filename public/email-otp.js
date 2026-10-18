/* توثيق البريد برمز OTP من السيرفر عند إنشاء الحساب */
(function () {
  if (window.__eotp || typeof S === 'undefined' || typeof sendOtp !== 'function') return;
  window.__eotp = 1;
  var base = window.__SERVER || '';
  var orig = sendOtp;
  function post(path, body) {
    return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__ok = r.ok && j.ok; return j; }); });
  }
  function refresh(o) { var w = document.getElementById('ws'); if (w && S.otp === o && typeof wst === 'function') w.innerHTML = wst(o); }
  window.sendOtp = sendOtp = function (p, ph, pl, back) {
    if (p !== 'signup') return orig.apply(this, arguments);
    var rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), function (x) { return x.toString(16); }).join('');
    var o = S.otp = { p: p, ph: ph, pl: pl, back: back, code: '#' + rnd, srv: 1, exp: Date.now() + 3e5, t: 0, rs: Date.now() + 6e4, st: 0, dsp: pl.e, ch: 'm' };
    go('otp');
    post('/api/otp/email/start', { email: pl.e }).then(function (j) {
      if (S.otp !== o) return;
      if (j.__ok) o.st = 1; else { o.st = 2; o.rs = 0; if (typeof toast === 'function') toast(j.error || 'تعذر إرسال الرمز إلى البريد'); }
      refresh(o);
    }).catch(function () { o.st = 2; o.rs = 0; if (typeof toast === 'function') toast('تعذر الاتصال بالسيرفر'); refresh(o); });
  };
  var pass = false;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-a="vo"]');
    var o = S.otp;
    if (!b || pass || !o || !o.srv) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var inp = document.getElementById('oc'), c = (inp && inp.value || '').trim();
    if (!/^\d{6}$/.test(c)) return toast('اكتب الرمز المكوّن من 6 أرقام');
    if (b.disabled) return; b.disabled = true;
    post('/api/otp/email/check', { email: o.pl.e, code: c }).then(function (j) {
      b.disabled = false;
      if (S.otp !== o) return;
      if (j.__ok) { o.code = c; pass = true; try { b.click(); } finally { pass = false; } }
      else { toast(j.error || 'الرمز غير صحيح'); if (/كثيرة|اطلب رمزاً|انتهت/.test(j.error || '')) o.rs = 0; }
    }).catch(function () { b.disabled = false; toast('تعذر الاتصال بالسيرفر'); });
  }, true);
})();

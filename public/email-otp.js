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
    if (['signup', 'reset', 'ml', 'mv', 'ph'].indexOf(p) < 0) return orig.apply(this, arguments);
    var purpose = p === 'mv' ? 'ml' : p, isWa = p === 'ph';
    var target = isWa ? ph : (p === 'signup' || p === 'reset') ? pl.e : ph;
    var apiPurpose = purpose === 'ml' ? 'verify' : purpose;
    var rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), function (x) { return x.toString(16); }).join('');
    var o = S.otp = { p: p, ph: ph, pl: pl, back: back, code: '#' + rnd, srv: 1, exp: Date.now() + 3e5, t: 0, rs: Date.now() + 6e4, st: 0, dsp: p === 'reset' ? target.replace(/^(.{2}).*(@.*)$/, '$1•••$2') : target, ch: isWa ? 'w' : 'm', purpose: purpose, tgt: target, wa: isWa };
    go('otp');
    (isWa ? post('/api/otp/wa/start', { phone: target }) : post('/api/otp/email/start', { email: target, purpose: apiPurpose })).then(function (j) {
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
    (o.wa ? post('/api/otp/wa/check', { phone: o.tgt, code: c }) : post('/api/otp/email/check', { email: o.tgt, code: c, purpose: o.purpose === 'ml' ? 'verify' : o.purpose, peek: o.purpose === 'reset' })).then(function (j) {
      b.disabled = false;
      if (S.otp !== o) return;
      if (j.__ok) { if (o.purpose === 'reset') window.__rst = { e: o.tgt, c: c }; o.code = c; pass = true; try { b.click(); } finally { pass = false; } }
      else { toast(j.error || 'الرمز غير صحيح'); if (/كثيرة|اطلب رمزاً|انتهت/.test(j.error || '')) o.rs = 0; }
    }).catch(function () { b.disabled = false; toast('تعذر الاتصال بالسيرفر'); });
  }, true);
  // استعادة كلمة المرور: الرمز يُرسل إلى البريد ويُتحقق منه ويُغيَّر الهاش في السيرفر
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-a="fsend"]');
    if (b && !pass) {
      e.stopImmediatePropagation(); e.preventDefault();
      var fe = document.getElementById('fe'), e2 = (fe && fe.value || '').trim().toLowerCase();
      if (!EM.test(e2)) return toast('اكتب بريداً إلكترونياً صحيحاً');
      var ac = AC.get()[e2]; if (!ac) return toast('لا يوجد حساب بهذا البريد');
      var d = document.getElementById('d'); if (d && d.close) d.close();
      return sendOtp('reset', e2, { e: e2 }, 'login');
    }
    var r = e.target.closest && e.target.closest('[data-a="rspw"]');
    if (r && !pass && S.rs && window.__rst && window.__rst.e === S.rs.e) {
      var w = (document.getElementById('rw1') || {}).value || '', w2 = (document.getElementById('rw2') || {}).value || '';
      if (w.length < 6 || w !== w2) return; // دع المعالج الأصلي يعرض رسالة الخطأ
      e.stopImmediatePropagation(); e.preventDefault();
      hp(w).then(function (h) {
        return post('/api/otp/email/reset', { email: S.rs.e, code: window.__rst.c, h: h });
      }).then(function (j) {
        if (!j.__ok) return toast(j.error || 'تعذر تغيير كلمة المرور');
        window.__rst = null; pass = true; try { r.click(); } finally { pass = false; }
      }).catch(function () { toast('تعذر الاتصال بالسيرفر'); });
    }
  }, true);
})();

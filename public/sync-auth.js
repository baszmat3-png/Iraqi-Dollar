/* يضيف هوية الحساب (بريد + بصمة) لطلبات المزامنة حتى لا يستلم المستخدم إلا أوامره الشخصية وبياناته */
(function () {
  if (window.__sauth) return; window.__sauth = 1;
  var cur = function () { try { return (typeof S !== 'undefined' && S.acc && S.acc.e && S.acc.h) ? { e: String(S.acc.e), h: String(S.acc.h) } : null; } catch (x) { return null; } };
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
      if (/^(https?:\/\/[^/]+)?\/api\/sync\/report/.test(u)) {
        // إثبات ملكية البريد (يُصدره السيرفر بعد رمز التحقق) يرافق طلب إنشاء الحساب
        var pr = {}, now = Date.now();
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var k = localStorage.key(i); if (!k || k.indexOf('otpp:') !== 0) continue;
          var tv = localStorage.getItem(k), m = /^v1\.(\d+)\./.exec(tv || '');
          if (!m || +m[1] < now) { localStorage.removeItem(k); continue; }
          pr[k.slice(5)] = tv;
        }
        if (Object.keys(pr).length) {
          init = Object.assign({}, init || {});
          var hh = new Headers(init.headers || (input && input.headers) || {});
          hh.set('x-proof', JSON.stringify(pr)); init.headers = hh;
        }
      }
      if (/^(https?:\/\/[^/]+)?\/api\/sync(\?|\/account-state|\/mine|\/push|\/kycf)/.test(u)) {
        var a = cur();
        if (a) {
          init = Object.assign({}, init || {});
          var h = new Headers(init.headers || (input && input.headers) || {});
          if (!h.has('x-e')) { h.set('x-e', encodeURIComponent(a.e)); h.set('x-h', a.h); }
          init.headers = h;
        }
      }
    } catch (x) { }
    return of.call(this, input, init);
  };
  var OES = window.EventSource;
  if (OES) {
    // بث الأحداث: لا تُوضع البصمة في عنوان الطلب؛ تُطلب تذكرة لمرة واحدة بترويسة ثم يُفتح البث بها
    var TES = function (url, opt, a) {
      var self = this, L = {}, real = null, closed = false;
      self.url = url; self.readyState = 0; self.withCredentials = false;
      self.addEventListener = function (t, f, o) { (L[t] = L[t] || []).push(f); if (real) real.addEventListener(t, f, o); };
      self.removeEventListener = function (t, f, o) { if (L[t]) L[t] = L[t].filter(function (x) { return x !== f; }); if (real) real.removeEventListener(t, f, o); };
      self.close = function () { closed = true; self.readyState = 2; if (real) { try { real.close(); } catch (x) { } } };
      var fail = function () { if (closed) return; self.readyState = 2; (L.error || []).slice().forEach(function (f) { try { f.call(self, new Event('error')); } catch (x) { } }); };
      of.call(window, '/api/sync/stream-ticket', { method: 'POST', headers: { 'x-e': encodeURIComponent(a.e), 'x-h': a.h } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (closed) return;
          if (!j || !j.t) return fail();
          real = new OES(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + encodeURIComponent(j.t), opt);
          Object.keys(L).forEach(function (t) { L[t].forEach(function (f) { real.addEventListener(t, f); }); });
          real.addEventListener('open', function () { self.readyState = 1; });
          real.addEventListener('error', function () { self.readyState = real.readyState; });
        })
        .catch(fail);
    };
    var W = function (url, opt) {
      try {
        if (typeof url === 'string' && /\/api\/sync\/stream/.test(url) && !/[?&]t=/.test(url)) {
          var a = cur();
          if (a) {
            url = url.replace(/([?&])email=[^&]*&?/, '$1').replace(/[?&]$/, '');
            return new TES(url, opt, a);
          }
        }
      } catch (x) { }
      return new OES(url, opt);
    };
    W.prototype = OES.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSED = 2;
    window.EventSource = W;
  }
})();

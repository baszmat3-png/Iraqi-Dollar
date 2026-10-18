/* يضيف هوية الحساب (بريد + بصمة) لطلبات المزامنة حتى لا يستلم المستخدم إلا أوامره الشخصية وبياناته */
(function () {
  if (window.__sauth) return; window.__sauth = 1;
  var cur = function () { try { return (typeof S !== 'undefined' && S.acc && S.acc.e && S.acc.h) ? { e: String(S.acc.e), h: String(S.acc.h) } : null; } catch (x) { return null; } };
  var of = window.fetch;
  window.fetch = function (input, init) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
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
    var W = function (url, opt) {
      try {
        if (typeof url === 'string' && /\/api\/sync\/stream/.test(url)) {
          var a = cur();
          if (a && !/[?&]h=/.test(url)) {
            url = url.replace(/([?&])email=[^&]*&?/, '$1').replace(/[?&]$/, '');
            url += (url.indexOf('?') < 0 ? '?' : '&') + 'email=' + encodeURIComponent(a.e) + '&h=' + encodeURIComponent(a.h);
          }
        }
      } catch (x) { }
      return new OES(url, opt);
    };
    W.prototype = OES.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSED = 2;
    window.EventSource = W;
  }
})();

/* مزامنة العدادات مع السيرفر (السيرفر هو المرجع): تظهر عدادات الحساب في أي جهاز/متصفح/تطبيق،
   والشراء من التطبيق يُرفع للسيرفر. لا تعديل على index.html؛ يُحمَّل بعد user-ext.js */
(function () {
  if (window.__csync || typeof S === 'undefined' || typeof AC === 'undefined') return;
  window.__csync = 1;
  const now = () => Date.now();
  const key = (c) => (c.i | 0) + ':' + Math.round(+c.e);
  const act = (l) => (Array.isArray(l) ? l : []).filter((c) => c && +c.e > now());
  const sig = (l) => act(l).map(key).sort().join(',');
  const hk = (e) => 'clh:' + String(e).toLowerCase();
  const getH = (e) => { try { return localStorage.getItem(hk(e)); } catch (x) { return null; } };
  const setH = (e, v) => { try { localStorage.setItem(hk(e), v); } catch (x) {} };
  const same = (a) => S.acc && a && String(a).toLowerCase() === String(S.acc.e).toLowerCase();
  const cnt = (l) => act(l).length;

  function adopt(next, H) {
    const before = cnt(S.cl);
    S.cl = next.map((c) => ({ i: c.i | 0, e: Math.round(+c.e) }));
    try { S.ctr = CT.map((_, i) => S.cl.filter((c) => c.i == i).length); } catch (x) {}
    setH(S.acc.e, H);
    try { save(); } catch (x) {}
    try {
      const ae = document.activeElement, dd = document.getElementById('d');
      if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) && !(dd && dd.open)) draw();
    } catch (x) {}
    if (S.cl.length > before) { try { toast('تم تحديث عداداتك من السيرفر'); } catch (x) {} }
  }

  function reconcile(email, sv, rejected) {
    try {
      if (!same(email) || !Array.isArray(sv) || S.acc.demo) return;
      const sigS = sig(sv), sigL = sig(S.cl), H = getH(S.acc.e);
      if (sigS === sigL) { setH(S.acc.e, sigS); return; }
      if (rejected) { adopt(act(sv), sigS); return; }          // رفض السيرفر رفعنا لأنه تغيّر: نأخذ نسخته
      if (H == null) {                                           // أول مزامنة على هذا الجهاز: دمج (الأكثر عدداً لكل نوع/تاريخ)
        const o = {};
        act(sv).forEach((c) => { const k = key(c); o[k] = Math.max(o[k] || 0, 0) + 1; });
        const l = {}; act(S.cl).forEach((c) => { const k = key(c); l[k] = (l[k] || 0) + 1; });
        Object.keys(l).forEach((k) => { o[k] = Math.max(o[k] || 0, l[k]); });
        const next = []; Object.keys(o).forEach((k) => { const p = k.split(':'); for (let n = 0; n < o[k]; n++) next.push({ i: +p[0], e: +p[1] }); });
        adopt(next, sigS);                                       // H=نسخة السيرفر، فإن زاد المحلي يُرفع في الدورة القادمة
        return;
      }
      if (sigL !== H) return;                                    // تغيّر محلياً (شراء): سيُرفع مع التقرير القادم
      adopt(act(sv), sigS);                                      // لم يتغير محلياً والسيرفر تغيّر (شحن/تصفير من الإدارة)
    } catch (x) {}
  }

  const of = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    try {
      if (/\/api\/sync\/report(\?|$)/.test(u) && opt && opt.body && typeof opt.body === 'string') {
        const b = JSON.parse(opt.body);
        const a = S.acc && (b.accounts || []).find((x) => same(x.e));
        if (a && !a.demo) {
          const H = getH(S.acc.e);
          if (H != null && sig(S.cl) !== H) { a.cl = act(S.cl).map((c) => ({ i: c.i | 0, e: Math.round(+c.e) })); a.clb = H; }
          opt = Object.assign({}, opt, { body: JSON.stringify(b) });
        }
        return of(url, opt).then((r) => {
          try { r.clone().json().then((j) => { ((j && j.accounts) || []).forEach((x) => { if (x && Array.isArray(x.cl)) reconcile(x.e, x.cl, !!x.clrej); }); }).catch(() => {}); } catch (x) {}
          return r;
        });
      }
      if (/\/api\/sync\/account-state/.test(u)) {
        return of(url, opt).then((r) => {
          try { r.clone().json().then((j) => { const A = j && j.account; if (A && Array.isArray(A.cl)) reconcile(A.email, A.cl, false); }).catch(() => {}); } catch (x) {}
          return r;
        });
      }
    } catch (x) {}
    return of(url, opt);
  };

  // عند تطبيق حالة سحابية: نرفع مؤشر أوامر الإدارة إلى cv (الرصيد المقروء يتضمنها فلا تُطبَّق مرة ثانية)، ونثبّت نسخة العدادات
  const oa = window.cldApply;
  if (typeof oa === 'function') {
    window.cldApply = function (e, st) {
      const r = oa.apply(this, arguments);
      try {
        if (st && +st.cv > 0 && typeof LS === 'function' && typeof LSset === 'function' && typeof SYNK !== 'undefined') { const last = +LS(SYNK, 0) || 0; if (+st.cv > last) LSset(SYNK, +st.cv); }
        if (st && st.core && Array.isArray(st.core.cl)) setH(e, sig(st.core.cl));
      } catch (x) {}
      return r;
    };
  }

  // أوامر «شحن عداد» القديمة لم تعد تُطبَّق محلياً (كانت تضيف مرتين وتضيع إن لم يوجد حساب محلي)؛ السيرفر مرجع العدادات
  const poll = () => { try { if (S.acc && !document.hidden) of('/api/sync/account-state?email=' + encodeURIComponent(S.acc.e), { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => { const A = j && j.account; if (A && Array.isArray(A.cl)) reconcile(A.email, A.cl, false); }).catch(() => {}); } catch (x) {} };
  window.gcOne = function () { setTimeout(poll, 300); return 0; };
  setInterval(poll, 5000);
  setTimeout(poll, 1200);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();

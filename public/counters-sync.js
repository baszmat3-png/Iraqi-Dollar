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

  let balBusy = 0;
  function adoptBal(email, T, sent) {
    try {
      if (!same(email) || S.acc.demo) return;
      const d = [+S.pts - sent[0], +S.gems - sent[1], +S.usd - sent[2]];   // ما تغيّر محلياً أثناء الإرسال
      const np = T[0] + d[0], ng = T[1] + d[1], nu = T[2] + d[2];
      const ext = Math.abs(T[0] - sent[0]) + Math.abs(T[1] - sent[1]) + Math.abs(T[2] - sent[2]) > 0.004;
      S.pts = Math.max(0, np); S.gems = Math.max(0, ng); S.usd = Math.max(0, Math.round(nu * 100) / 100);
      try { localStorage.setItem('bk:' + String(S.acc.e).toLowerCase(), JSON.stringify(T)); } catch (x) {}
      if (ext) {
        try { save(); } catch (x) {}
        try { const ae = document.activeElement, dd = document.getElementById('d'); if (!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) && !(dd && dd.open)) draw(); } catch (x) {}
      }
    } catch (x) {}
  }

  window.__csyncReconcile = function (e, l, r) { reconcile(e, l, r); };
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
        // الأرصدة: الحساب الحالي يرسل رصيده المحلي l وآخر رصيد استلمه k (يدمجها السيرفر بالفروقات)؛ بقية الحسابات المخزّنة على الجهاز لا تكتب رصيداً
        (b.accounts || []).forEach((x) => { if (x !== a) x.ro = 1; });
        // الرصيد لم يعد يُرسل ضمن التقرير إطلاقاً (لا مطلقاً ولا l/k): السيرفر هو المرجع، ومزامنته اللحظية في bal-live.js (فروقات + بثّ فوري)
        let sentBal = null;
        if (a && !a.demo) { delete a.l; delete a.k; }
        if (a && !a.demo) {
          const H = getH(S.acc.e);
          if (H != null && sig(S.cl) !== H) { a.cl = act(S.cl).map((c) => ({ i: c.i | 0, e: Math.round(+c.e) })); a.clb = H; a.cv = 2; }
          opt = Object.assign({}, opt, { body: JSON.stringify(b) });
        }
        return of(url, opt).then((r) => {
          try { r.clone().json().then((j) => { ((j && j.accounts) || []).forEach((x) => { if (x && Array.isArray(x.cl)) reconcile(x.e, x.cl, !!x.clrej); if (x && Array.isArray(x.bp) && sentBal) adoptBal(x.e, x.bp, sentBal); }); balBusy = 0; }).catch(() => { balBusy = 0; }); } catch (x) { balBusy = 0; }
          return r;
        }, (err) => { balBusy = 0; throw err; });
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
      try { if (S.acc && !S.acc.demo && String(e).toLowerCase() === String(S.acc.e).toLowerCase() && st && st.core) { st.core.pts = S.pts; st.core.gems = S.gems; st.core.usd = S.usd; } } catch (x) {}   // الأرصدة تُدمج بالفروقات فقط
      const r = oa.apply(this, arguments);
      try {
        if (st && +st.cv > 0 && typeof LS === 'function' && typeof LSset === 'function' && typeof SYNK !== 'undefined') { const last = +LS(SYNK, 0) || 0; if (+st.cv > last) LSset(SYNK, +st.cv); }
        if (st && st.core && Array.isArray(st.core.cl)) setH(e, sig(st.core.cl));
      } catch (x) {}
      return r;
    };
  }


  /* ===== الصورة الشخصية: من السيرفر فقط (لا صورة محلية/مخزّنة على الجهاز) ===== */
  const srvAv = () => {
    try {
      const e = String(S.acc.e).toLowerCase(), v = window.MX && MX.av && MX.av[e];
      return v ? '/api/m/avatar?e=' + encodeURIComponent(e) + '&v=' + v : '';
    } catch (x) { return ''; }
  };
  const od = window.draw;
  if (typeof od === 'function') {
    window.draw = function () {
      try { if (S.acc && !S.acc.demo) { const u = srvAv(); if (S.av !== u) S.av = u; } } catch (x) {}
      return od.apply(this, arguments);
    };
  }

  /* ===== المضاعفة = عدد العدادات الفعّالة (بدل ناتج قسمة العائد على الأساس) ===== */
  const fixMul = () => {
    try {
      document.querySelectorAll('small.mu').forEach((sm) => {
        if (sm.textContent.trim() !== 'المضاعفة') return;
        const b = sm.parentElement && sm.parentElement.querySelector('b');
        if (!b) return;
        const n = Math.max(1, act(S.cl).length), t = n + '×';
        if (b.textContent !== t) b.textContent = t;
      });
    } catch (x) {}
  };
  try { new MutationObserver(fixMul).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (x) {}
  setTimeout(fixMul, 500);

  // أوامر «شحن عداد» القديمة لم تعد تُطبَّق محلياً (كانت تضيف مرتين وتضيع إن لم يوجد حساب محلي)؛ السيرفر مرجع العدادات
  const poll = () => { try { if (S.acc && !document.hidden) of('/api/sync/account-state?email=' + encodeURIComponent(S.acc.e), { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => { const A = j && j.account; if (A && Array.isArray(A.cl)) reconcile(A.email, A.cl, false); }).catch(() => {}); } catch (x) {} };
  const oc = window.cmdRun;
  if (typeof oc === 'function') {
    window.cmdRun = function (b) {
      try {
        if (b && S.acc && !S.acc.demo) {
          if (b.t === 'adj' || b.t === 'set') { setTimeout(() => { try { syncReport(); } catch (x) {} }, 150); return 0; }   // السيرفر هو المرجع؛ يصل الرصيد مع التقرير التالي
          if (b.t === 'rz' && b.o) {
            const o = Object.assign({}, b.o); delete o.p; delete o.g; delete o.d;
            if (!Object.keys(o).length) { setTimeout(() => { try { syncReport(); } catch (x) {} }, 150); return 1; }
            b = Object.assign({}, b, { o });
          }
        }
      } catch (x) {}
      return oc.call(this, b);
    };
  }

  window.gcOne = function () { setTimeout(poll, 300); return 0; };
  setInterval(poll, 5000);
  setTimeout(poll, 1200);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();

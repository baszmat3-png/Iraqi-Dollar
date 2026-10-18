/* live-admin.js — مزامنة فورية لأرصدة كل المستخدمين (نقاط · جواهر · دولار) في لوحة التحكم:
   أقسام: شحن النقاط · المستخدمون · الحسابات والتحكم. الأرقام تتغير في مكانها بحركة عدّ بدون إعادة رسم أو وميض. */
(function () {
  'use strict';
  if (window.__liveAdmin) return;
  window.__liveAdmin = 1;
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (k, n, nfm) => nfm ? (+n || 0).toLocaleString('en-US', { maximumFractionDigits: k === 2 ? 2 : 0 }) : k === 2 ? (+n || 0).toFixed(2) : (typeof f === 'function' ? f(n) : Math.floor(+n || 0).toLocaleString('en'));

  const css = document.createElement('style');
  css.textContent = '@keyframes lbup{0%{background:#3ad98f55;color:#3ad98f}100%{background:transparent}}@keyframes lbdn{0%{background:#ff7a7755;color:#ff7a77}100%{background:transparent}}[data-lb].lb-up{animation:lbup 1.2s ease-out;border-radius:6px}[data-lb].lb-dn{animation:lbdn 1.2s ease-out;border-radius:6px}';
  document.head.appendChild(css);

  function animate(el, k, to) {
    const nfm = !!el.dataset.nf;
    const from = el._lv != null ? el._lv : (parseFloat(String(el.textContent).replace(/[^\d.\-]/g, '')) || 0);
    el._lv = to;
    if (from === to) { el.textContent = fmt(k, to, nfm); return; }
    el.classList.remove('lb-up', 'lb-dn'); void el.offsetWidth; el.classList.add(to > from ? 'lb-up' : 'lb-dn');
    cancelAnimationFrame(el._lr);
    const t0 = performance.now(), D = 450;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(k, p >= 1 ? to : from + (to - from) * e, nfm);
      if (p < 1) el._lr = requestAnimationFrame(step);
    };
    el._lr = requestAnimationFrame(step);
  }

  let redrawT = 0, lastDraw = 0;
  function idleRedraw() {
    try {
      if (S.r !== 'panel' || !['stats', 'demo', 'mon'].includes(S.pt)) return;
      clearTimeout(redrawT);
      redrawT = setTimeout(() => {
        const ae = document.activeElement, dd = document.getElementById('d');
        if ((ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) || (dd && dd.open) || Date.now() - lastDraw < 3000) return;
        lastDraw = Date.now(); draw();
      }, 1200);
    } catch (e) {}
  }

  function apply(evs) {
    let unknown = false, prevT = 0;
    const U = window._srvU || (window._srvU = {});
    evs.forEach((x) => {
      const u = U[x.e];
      if (!u) { unknown = true; return; }
      u.pts = x.pts; u.gems = x.gems; u.usd = x.usd;
      const vals = [x.pts, x.gems, x.usd];
      document.querySelectorAll('[data-lb="' + (window.CSS && CSS.escape ? CSS.escape(x.e) : x.e) + '"]').forEach((el) => animate(el, +el.dataset.k, vals[+el.dataset.k]));
      prevT = 1;
    });
    // أبقِ توقيع srvLoad مطابقاً حتى لا يعيد الرسم بلا داعٍ
    try { window._srvSig = (window._srvErr || '') + JSON.stringify(Object.values(U).map((u) => [u.email, u.name, u.phone, u.pts, u.gems, u.usd, u.ncl, u.nrun, u.blk, u.kyc, u.av])); } catch (e) {}
    if (unknown && typeof srvLoad === 'function') srvLoad(1);
    if (prevT) { try { if (typeof chgPrev === 'function') chgPrev(); } catch (e) {} idleRedraw(); }
  }

  let seq = -1;
  async function loop() {
    for (;;) {
      const k = key();
      let ok = false; try { ok = typeof S !== 'undefined' && S.staff; } catch (e) {}
      if (!k || !ok || document.hidden) { await sleep(1500); continue; }
      try {
        const r = await fetch('/api/ctl/live-bal?since=' + seq, { headers: { 'X-Admin-Key': k }, cache: 'no-store' });
        if (!r.ok) { await sleep(r.status === 401 || r.status === 503 ? 6000 : 2500); continue; }
        const j = await r.json();
        if (seq < 0) { seq = j.seq; continue; }
        if (j.reset) { seq = -1; if (typeof srvLoad === 'function') srvLoad(1); continue; }
        if (j.ev && j.ev.length) apply(j.ev);
        seq = Math.max(seq, j.seq || 0);
      } catch (e) { await sleep(2000); }
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { try { srvLoad(1); } catch (e) {} } });
  setTimeout(loop, 1200);
})();

/* notes-client.js — استلام إشعارات السيرفر لحظياً (P2P وغيرها) وإضافتها لإشعارات التطبيق */
(function () {
  'use strict';
  if (window.__notesC) return; window.__notesC = 1;
  if (typeof S === 'undefined') return;
  const me = () => { try { return S.acc && S.acc.e && S.acc.h && !S.acc.demo ? { e: String(S.acc.e).toLowerCase(), h: S.acc.h } : null; } catch (x) { return null; } };
  const K = (e) => 'nlast:' + e;
  const getLast = (e) => { try { const v = localStorage.getItem(K(e)); return v == null ? null : +v || 0; } catch (x) { return null; } };
  const setLast = (e, n) => { try { if (n > (getLast(e) || 0)) localStorage.setItem(K(e), String(n)); } catch (x) { /* ممتلئ */ } };
  function show(m, n) {
    if (!n || !n.id) return;
    const last = getLast(m.e); if (last != null && n.id <= last) return;
    setLast(m.e, n.id);
    try { if (typeof unAddE === 'function') unAddE(m.e, n.title, n.body || ''); } catch (x) { /* اختياري */ }
    try { if (!document.hidden && typeof toast === 'function') toast('🔔 ' + n.title); } catch (x) { /* اختياري */ }
    try { window.dispatchEvent(new CustomEvent('unote-evt', { detail: n })); } catch (x) { /* اختياري */ }
  }
  let busy = false;
  async function pull() {
    const m = me(); if (!m || busy) return; busy = true;
    try {
      const last = getLast(m.e);
      const r = await fetch('/api/u/notes/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ e: m.e, h: m.h, after: last }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return;
      if (last == null) { setLast(m.e, j.max || 0); try { localStorage.setItem(K(m.e), String(j.max || 0)); } catch (x) { /* */ } return; }
      (j.notes || []).forEach((n) => show(m, n));
    } catch (x) { /* صامت */ } finally { busy = false; }
  }
  window.addEventListener('store-evt', (e) => {
    const d = e.detail || {}, m = me(); if (!m) return;
    if (d.k === 'unote') show(m, d); else if (d.k === 'hello') pull();
  });
  setInterval(() => { if (!document.hidden) pull(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  setTimeout(pull, 2500);
})();

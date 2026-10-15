/* instant-client.js — استلام أوامر الإدارة لحظياً عبر SSE (مع بقاء الفحص كل 5 ثوانٍ كاحتياط) */
(function () {
  'use strict';
  if (window.__instantClient) return;
  window.__instantClient = 1;
  if (!('EventSource' in window)) return; // يبقى الفحص الدوري الموجود أصلاً

  let es = null, delay = 1000, curEmail = null, timer = 0;
  const myEmail = () => { try { return (S.acc && S.acc.e ? String(S.acc.e) : '').toLowerCase(); } catch (e) { return ''; } };

  async function poll(force) { // سحب الأوامر الأحدث من آخر رقم مطبَّق (بالترتيب وبدون فجوات)
    try {
      if (document.hidden && !force) return;
      const r = await fetch('/api/sync?since=' + (+LS(SYNK, 0) || 0) + '&nocfg=1', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.cmds) && j.cmds.length) applyCmds(j.cmds);
    } catch (e) {}
  }

  function onCmd(c) {
    try {
      const last = +LS(SYNK, 0) || 0;
      if (!c || !c.id || c.id <= last) return;
      if (c.id === last + 1 && c.skip) { LSset(SYNK, c.id); return; } // أمر لحساب آخر: تقدّم الترقيم فقط
      if (c.id === last + 1 && c.body) applyCmds([c]); // التالي مباشرة: طبّقه فوراً
      else poll(true);                                   // فجوة: اسحب المفقود بالترتيب
    } catch (e) { console.warn('instant cmd:', e); }
  }

  function connect() {
    clearTimeout(timer);
    if (es) { try { es.close(); } catch (e) {} es = null; }
    curEmail = myEmail();
    try { es = new EventSource('/api/sync/stream' + (curEmail ? '?email=' + encodeURIComponent(curEmail) : '')); }
    catch (e) { return retry(); }
    es.addEventListener('hello', () => { delay = 1000; poll(); }); // تعويض ما فات أثناء الانقطاع
    es.addEventListener('cmd', (e) => { try { onCmd(JSON.parse(e.data)); } catch (x) {} });
    es.addEventListener('error', () => { try { es.close(); } catch (e) {} es = null; retry(); });
  }
  function retry() { clearTimeout(timer); timer = setTimeout(connect, delay); delay = Math.min(delay * 1.7, 15000); }

  // أعد الاتصال عند تغيّر الحساب (لتصفية الأوامر الموجهة) أو عند العودة للتطبيق
  setInterval(() => { if (myEmail() !== curEmail) connect(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (!es) connect(); poll(); }); // عند العودة للتطبيق: اسحب فوراً ما فاته
  window.addEventListener('online', () => { if (!es) connect(); poll(); });
  setTimeout(connect, 800);
})();

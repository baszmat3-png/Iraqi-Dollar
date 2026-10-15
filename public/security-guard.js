/* security-guard.js — بصمة الجهاز + كشف تلاعب الوقت + إرسال beacon للخادم */
(function () {
  'use strict';
  if (window.__secGuard) return;
  const _now = Date.now.bind(Date);

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }
  function canvasHash() {
    try {
      const c = document.createElement('canvas'); c.width = 220; c.height = 40;
      const x = c.getContext('2d');
      x.textBaseline = 'top'; x.font = '14px Arial'; x.fillStyle = '#f60'; x.fillRect(125, 1, 62, 20);
      x.fillStyle = '#069'; x.fillText('fp,سلام123', 2, 15); x.fillStyle = 'rgba(102,204,0,.7)'; x.fillText('fp,سلام123', 4, 17);
      return hash(c.toDataURL());
    } catch (e) { return 'x'; }
  }
  const FP = 'F' + hash([navigator.userAgent, navigator.platform, navigator.language,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth, new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0, navigator.maxTouchPoints || 0, canvasHash()].join('|'));

  /* فرق ساعة الجهاز عن الخادم + كشف القفزات أثناء الجلسة */
  const TS = { off: 0, jumps: [] };
  let lastWall = _now(), lastPerf = performance.now();
  setInterval(() => {
    const w = _now(), p = performance.now();
    const skew = (w - lastWall) - (p - lastPerf); // الساعة تحركت أكثر/أقل من الزمن الحقيقي
    if (Math.abs(skew) > 30000) TS.jumps.push({ type: 'time_jump', t: w, skew: Math.round(skew) });
    lastWall = w; lastPerf = p;
  }, 5000);

  // عند وجود فرق كبير (>دقيقة) تعتمد ساعة التطبيق على ساعة الخادم
  Date.now = function () { return Math.abs(TS.off) > 60000 ? _now() + TS.off : _now(); };

  let busy = false, last = 0, blocked = false;
  async function beacon(force) {
    if (blocked || busy) return;
    const n = _now();
    if (!force && n - last < 45000) return;
    busy = true; last = n;
    try {
      let email = '';
      try { email = (S.acc && S.acc.e) || ''; } catch (e) {}
      const t0 = _now();
      const r = await fetch('/api/security/beacon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ fp: FP, email, clientTime: t0, flags: TS.jumps.slice(-5), ua: navigator.userAgent,
          tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '') }),
      });
      const j = await r.json().catch(() => ({}));
      if (j && j.serverTime) TS.off = j.serverTime - Math.round((t0 + _now()) / 2); // يعوّض زمن الشبكة
      if (j && j.block) blockUI(j.reason || 'هذا الجهاز غير مسموح');
    } catch (e) { /* بدون إنترنت: لا شيء */ }
    busy = false;
  }

  function blockUI(msg) {
    blocked = true;
    if (document.getElementById('sec-block')) return;
    const ov = document.createElement('div');
    ov.id = 'sec-block';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b141c;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;flex-direction:column;font-family:inherit';
    const h = document.createElement('div'); h.style.fontSize = '3rem'; h.textContent = '🔒';
    const t = document.createElement('h2'); t.style.cssText = 'margin:10px 0 8px;color:#ef5350'; t.textContent = 'تم إيقاف الدخول مؤقتاً';
    const p = document.createElement('p'); p.style.cssText = 'color:#9aa9b5;line-height:1.7;max-width:360px'; p.textContent = msg;
    const b = document.createElement('button'); b.textContent = 'إعادة المحاولة';
    b.style.cssText = 'margin-top:18px;padding:12px 24px;border-radius:12px;border:0;background:#2bcfe2;color:#06222a;font-weight:700';
    b.onclick = () => location.reload();
    ov.append(h, t, p, b); document.body.appendChild(ov);
  }

  setTimeout(() => beacon(true), 1500);
  setInterval(() => beacon(false), 50000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) beacon(true); });
  window.__secGuard = { FP, TS, beacon };
})();

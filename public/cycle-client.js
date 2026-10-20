/* دورة عائد العداد من السيرفر: الجهاز يعرض ويستقرئ فقط؛ الاستحقاق والاستلام وإضافة النقاط على السيرفر */
(function () {
  if (window.CY) return;
  const CY = window.CY = { busy: 0, key: '', t: 0 };
  CY.real = () => { try { return !!(S.acc && S.acc.e && S.acc.h && !isDemo()); } catch (x) { return false; } };
  const idle = () => { const dd = document.getElementById('d'); return !(dd && dd.open); };
  async function call(path, extra) {
    const a = S.acc;
    try {
      const r = await fetch('/api/cycle/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ e: a.e, h: a.h }, extra || {})) });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.ok ? j : null;
    } catch (x) { return null; }
  }
  CY.apply = function (j) {
    if (!j) return;
    S.run = j.run ? 1 : 0; S.left = j.left; S.accr = j.accr; S.accg = 0; S.done = 0; S.ended = j.ended ? 1 : 0;
    if (j.credited > 0) {
      try { txlog('استلام عائد العداد', j.credited, 'in'); unAdd('تم استلام عائد العداد ✅', 'أُضيفت ' + f(j.credited) + ' نقطة إلى رصيدك وتوقف العداد. اضغط «تشغيل» لبدء دورة جديدة'); } catch (x) {}
      try { if (window.__balPull) window.__balPull(); } catch (x) {}
    }
    try { save(); } catch (x) {}
    try { if (S.r === 'counter' && idle()) draw(); } catch (x) {}
  };
  CY.sync = async function () {
    if (!CY.real() || CY.busy) return; CY.busy = 1;
    try { const seed = CY.key !== S.acc.e ? { run: S.run, left: S.left, accr: S.accr, ended: S.ended } : undefined; const j = await call('state', seed ? { seed } : {}); if (j) { CY.key = S.acc.e; CY.apply(j); } } catch (x) {}
    CY.busy = 0;
  };
  CY.toggle = async function (on) {
    S.run = on ? 1 : 0; if (on) S.ended = 0;
    try { toast(on ? 'بدأ العداد — 24 ساعة' : 'تم إيقاف العداد مؤقتاً'); draw(); } catch (x) {}
    CY.busy = 1; const j = await call('toggle', { run: !!on }); CY.busy = 0;
    if (j) CY.apply(j); else CY.sync();
  };
  // انتهاء الدورة محلياً: لا نضيف نقاطاً هنا، نطلب من السيرفر الاستلام
  const ac0 = window.autoClaim, cc0 = window.claimCycle;
  window.autoClaim = function () {
    if (!CY.real()) return ac0 && ac0();
    S.left = 86400; S.run = 0; S.ended = 1; S.accr = 0; S.accg = 0; S.done = 0;
    setTimeout(CY.sync, 300);
  };
  window.claimCycle = function () { if (!CY.real()) return cc0 && cc0(); CY.toggle(1); };
  setInterval(() => { try { if (document.visibilityState !== 'hidden') CY.sync(); } catch (x) {} }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') CY.sync(); });
  let lastE = '';
  setInterval(() => { try { const e = CY.real() ? S.acc.e : ''; if (e && e !== lastE) { lastE = e; setTimeout(CY.sync, 1500); setTimeout(CY.sync, 6000); } if (!e) lastE = ''; } catch (x) {} }, 2000);
})();

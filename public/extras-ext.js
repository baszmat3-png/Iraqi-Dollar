/* المرحلة 5 (واجهة المستخدم): مزامنة الرمز المشتَرى والرموز المباعة + حملات التبرع */
(() => {
  const j = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const sig = (o) => { try { return JSON.stringify(o); } catch (e) { return ''; } };
  let busy = false;

  async function campLoad() {
    const r = await j('/api/campaigns');
    if (!r || !Array.isArray(r.items)) return;
    if (sig(r.items) !== sig(window._camps)) { window._camps = r.items; }
  }
  async function refState() {
    if (busy) return; busy = true;
    try {
      const e = S && S.acc ? S.acc.e : '';
      const r = await j('/api/refcode/state' + (e ? '?e=' + encodeURIComponent(e) : ''));
      if (!r) return;
      const old = sig(window._rfSold);
      window._rfSold = r.sold || [];
      let ch = old !== sig(window._rfSold);
      if (e && r.mine) {
        const A = AC.get(), k = Object.keys(A).find((x) => x.toLowerCase() === String(e).toLowerCase());
        if (k && A[k].rcb !== r.mine) { A[k].rcb = r.mine; AC.set(A); ch = true; try { syncReport(); } catch (x) {} }
      }
      const dd = document.getElementById('d');
      if (ch && S.r === 'refer' && !(dd && dd.open) && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) { try { draw(); } catch (x) {} }
    } finally { busy = false; }
  }
  window.campLoad = campLoad;
  // تحديث قائمة الحملات عند فتح نافذة التبرع
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-a="don"]'); if (b) campLoad(); }, true);
  campLoad(); setTimeout(refState, 1200);
  setInterval(campLoad, 20000);
  setInterval(refState, 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { campLoad(); refState(); } });
})();

/* ===== تسجيل حركات الوكيل والتحويلات في السيرفر (لمراقبة الوكلاء من لوحة الإدارة) ===== */
(() => {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const send = (path, body) => {
    try {
      if (!S.acc || !S.acc.h) return;
      fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(Object.assign({ e: S.acc.e, h: S.acc.h, uid: uid() }, body)) }).catch(() => {});
    } catch (e) {}
  };
  const tot = () => { const a = myAg(); return a ? (+a.o[4] || 0) + (+a.o[9] || 0) : 0; };

  // شحن عضو من لوحة الوكيل
  if (typeof agChg === 'function') {
    const o = agChg;
    window.agChg = function () {
      const q = ((document.getElementById('agm') || {}).value || '').trim().toLowerCase();
      const before = tot(), r = o.apply(this, arguments), sold = before - tot();
      if (sold > 0) {
        let t = null;
        try { t = acs().find((x) => String(x.e).toLowerCase() === q || String(ucode(x)).toLowerCase() === q); } catch (e) {}
        send('/api/u/agent/log', { kind: 'charge', pts: sold, to: t ? t.e : q, toName: t ? t.n : '', note: 'شحن رصيد عضو' });
      }
      return r;
    };
  }
  // إضافة نقاط من حساب الوكيل إلى رصيده الرسمي
  if (typeof agAddOff === 'function') {
    const o = agAddOff;
    window.agAddOff = function () {
      const a = myAg(), before = a ? (+a.o[9] || 0) : 0, r = o.apply(this, arguments), a2 = myAg(), d = (a2 ? (+a2.o[9] || 0) : 0) - before;
      if (d > 0) send('/api/u/agent/log', { kind: 'addoff', pts: d, note: 'من رصيد حسابه' });
      return r;
    };
  }
  // طلب شراء نقاط بالسعر الرسمي
  if (typeof agBuy === 'function') {
    const o = agBuy;
    window.agBuy = function () {
      const n = Math.floor(+((document.getElementById('agb') || {}).value || 0));
      const r = o.apply(this, arguments);
      if (n > 0 && myAg()) send('/api/u/agent/log', { kind: 'buy', pts: n, note: 'طلب عبر الدعم المباشر' });
      return r;
    };
  }
  // تحويل نقاط إلى صديق: إن كان المستلم وكيلاً يسجله السيرفر
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-a="tr"]');
    if (!b || S.ft !== 'friend') return;
    const to = ((document.getElementById('fn') || {}).value || '').trim(), n = Math.floor(+((document.getElementById('fa') || {}).value || 0)), before = S.pts;
    if (!to || !(n > 0)) return;
    setTimeout(() => { if (S.pts < before) send('/api/u/agent/xfer', { to, pts: n }); }, 400);
  }, true);
})();

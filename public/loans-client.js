/* الاستدانة (الأقساط) من السيرفر: الجهاز يعرض فقط، والطلب والصرف والسداد والحظر كلها على السيرفر */
(function () {
  if (window.LN) return;
  const LN = window.LN = { ok: 0, busy: 0, db: [], reqs: [], lim: 0, owed: 0, pend: 0, av: 0, blocked: false, key: '' };
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (x) { return null; } };
  async function api(path, body) {
    const m = me(); if (!m) { toast('سجّل الدخول أولاً'); return null; }
    try {
      const r = await fetch('/api/loans/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, m, body || {})) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { toast(j.error || 'تعذّر تنفيذ العملية'); return null; }
      return j;
    } catch (x) { toast('تحقق من الاتصال بالإنترنت'); return null; }
  }
  const redraw = () => { try { if (S.r === 'store' || S.r === 'debt') { const dd = document.getElementById('d'); if (!(dd && dd.open)) draw(); } } catch (x) {} };
  LN.load = async function () {
    if (LN.busy || !me()) return; LN.busy = 1;
    const m = me(); if (LN.key !== m.e) { LN.db = []; LN.reqs = []; LN.ok = 0; LN.key = m.e; }
    try {
      const r = await fetch('/api/loans/state', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        // شكل متوافق مع واجهة الأقساط الحالية: x = موعد القسط القادم
        LN.db = j.db.map((d) => ({ id: d.id, amt: d.amt, months: d.months, inst: d.inst, total: d.total, t0: d.t0, paid: d.paid, x: d.due }));
        LN.reqs = j.reqs.map((x) => ({ id: x.id, amt: x.amt, months: x.months, inst: x.inst, total: x.total, rec: x.net, st: x.st === 'pending' ? 'p' : x.st === 'rejected' ? 'r' : 'a', t: x.t }));
        LN.lim = j.lim; LN.owed = j.owed; LN.pend = j.pend; LN.av = j.av; LN.blocked = j.blocked; LN.ok = 1;
      }
    } catch (x) {}
    LN.busy = 0; redraw();
  };
  LN.request = async function (amt, months) {
    const j = await api('request', { amt, months });
    if (j) { toast('تم إرسال طلب الاستدانة للدعم بانتظار الموافقة'); S.dq = ''; }
    LN.load(); return j;
  };
  LN.pay = async function (idx, n) {
    const d = LN.db[+idx]; if (!d) return;
    const j = await api('pay', { id: d.id, n });
    if (j) { try { if (window.__balPull) window.__balPull(); } catch (x) {} toast(j.closed ? 'تم سداد الاستدانة بالكامل' : 'تم تسديد القسط'); }
    LN.load();
  };
  setInterval(() => { try { if (me() && (S.r === 'store' || S.r === 'debt') && document.visibilityState !== 'hidden') LN.load(); } catch (x) {} }, 15000);
})();

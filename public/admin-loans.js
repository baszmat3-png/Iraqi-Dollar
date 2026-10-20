/* لوحة الإدارة — الاستدانة من السيرفر (طلبات/نشطة/مسددة، موافقة/رفض، تنبيه) */
(function () {
  if (window.LNA) return;
  const LNA = window.LNA = { ok: 0, busy: 0, req: [], act: [], hist: [] };
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey') || '""'); } catch (x) { return ''; } };
  LNA.load = async function () {
    if (LNA.busy) return; LNA.busy = 1;
    const j = await ctlApi('/loans', 'GET');
    if (j) {
      LNA.req = j.req || []; LNA.hist = j.hist || [];
      LNA.act = (j.act || []).map((d, i) => ({ e: d.u, i, d: { id: d.id, amt: d.amt, months: d.months, inst: d.inst, total: d.total, t0: d.t0, paid: d.paid, x: d.due, cn: d.cn }, id: d.id }));
      LNA.ok = 1;
    }
    LNA.busy = 0; try { const dd = document.getElementById('d'); if (!(dd && dd.open)) draw(); } catch (x) {}
  };
  LNA.decide = async function (i, ok) {
    const w = LNA.req[+i]; if (!w || w.st !== 'pending') return;
    if (!confirm((ok ? 'الموافقة على استدانة ' : 'رفض استدانة ') + w.amt.toLocaleString('en') + ' نقطة لـ ' + w.n + '؟')) return;
    const j = await ctlApi('/loans/decide', 'POST', { id: w.id, ok });
    if (j) toast(ok ? 'تمت الموافقة وإضافة الرصيد من السيرفر' : 'تم رفض الطلب');
    LNA.load();
  };
  LNA.notify = async function (id, late) { const j = await ctlApi('/loans/notify', 'POST', late ? { late: 1 } : { id }); if (j) toast('تم تنبيه ' + j.n + ' مستخدم'); };
})();

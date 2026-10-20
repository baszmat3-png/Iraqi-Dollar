/* مزامنة قائمة الموظفين (يُدخلها المالك) مع السيرفر: الدخول والصلاحيات يُتحقق منها هناك لا في المتصفح */
(function () {
  // كل طلب إلى /api/ctl: إن لم يكن فيه مفتاح إدارة حقيقي نرفق توكن المالك أو الموظف
  const of = window.fetch.bind(window), lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : ''; } catch (x) { return ''; } };
  window.fetch = function (url, opt) {
    try {
      const u = typeof url === 'string' ? url : (url && url.url) || '';
      if (/\/api\/ctl\//.test(u) && !/staff-login|owner-login/.test(u)) {
        const h = new Headers((opt && opt.headers) || {}), k = h.get('X-Admin-Key');
        if (!k || k === 'staff-session') {
          h.delete('X-Admin-Key');
          const ot = lsGet('ownt'), st = lsGet('stt');
          if (ot) h.set('X-Owner-Token', ot); else if (st) h.set('X-Staff-Token', st);
          opt = Object.assign({}, opt, { headers: h });
        }
      }
    } catch (x) {}
    return of(url, opt);
  };
  let last = '', busy = 0;
  const lsj = (k) => { try { return localStorage.getItem(k) || ''; } catch (x) { return ''; } };
  setInterval(async () => {
    try {
      if (busy || typeof S === 'undefined' || !S.staff || S.staff.role !== 'owner') return;
      const raw = lsj('staff'); if (raw === last) return;
      let list = []; try { list = JSON.parse(raw || '[]'); } catch (x) {}
      busy = 1;
      const j = await ctlApi('/staff/sync', 'POST', { list: (Array.isArray(list) ? list : []).map((s) => ({ u: s.u, h: s.h, role: s.role, p: s.p, off: s.off })) });
      if (j) last = raw;
      busy = 0;
    } catch (x) { busy = 0; }
  }, 3000);
})();

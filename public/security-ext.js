/* المرحلة 3 — الأمان (جهة المستخدم): رمز واتساب للجهاز الجديد · المصادقة الثنائية · جلسات الدخول · حساب جديد يبدأ من الصفر */
(function () {
  if (typeof S === 'undefined' || typeof doLogin === 'undefined') return;
  const SEC = (window.SEC = { tfa: false });
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const did = () => { let d = lsGet('did'); if (!d || d.length < 16) { d = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join(''); lsSet('did', d); } return d; };
  const sidKey = (e) => 'sid:' + String(e).toLowerCase();
  async function api(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { s: r.status, j: await r.json().catch(() => ({})) };
    } catch (e) { return { s: 0, j: {} }; }
  }
  const cred = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h, device_id: did(), sid: lsGet(sidKey(S.acc.e)) || '' } : null);

  /* ---------- نافذة إدخال رمز واتساب ---------- */
  function askOtp(title, to, resend) {
    return new Promise((done) => {
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl';
      o.innerHTML = `<div class="card" style="width:100%;max-width:380px"><h3 style="margin:0 0 6px">${title}</h3>
<p class="mu" style="margin:0 0 10px">أرسلنا رمزاً من 6 أرقام إلى واتساب <b dir="ltr">${to || ''}</b></p>
<input id="sxo" inputmode="numeric" maxlength="6" dir="ltr" autocomplete="one-time-code" placeholder="••••••" style="text-align:center;font-size:1.4rem;letter-spacing:6px">
<p id="sxe" style="color:#ef5350;min-height:1.4em;margin:6px 0"></p>
<div class="g2"><button class="btn" id="sxok">تأكيد</button><button class="btn o" id="sxno">إلغاء</button></div>
<button class="btn o sm" id="sxrs" style="width:100%;margin-top:8px">إعادة إرسال الرمز</button></div>`;
      document.body.appendChild(o);
      const g = (s) => o.querySelector(s);
      g('#sxo').focus();
      g('#sxno').onclick = () => { o.remove(); done(null); };
      g('#sxok').onclick = () => { const c = g('#sxo').value.trim(); if (!/^\d{6}$/.test(c)) { g('#sxe').textContent = 'اكتب الرمز المكوّن من 6 أرقام'; return; } o.remove(); done(c); };
      g('#sxrs').onclick = async () => { g('#sxrs').disabled = true; const m = await resend(); g('#sxe').textContent = m || 'تم إرسال رمز جديد'; setTimeout(() => { g('#sxrs').disabled = false; }, 45000); };
    });
  }

  /* ---------- إعادة تعيين حالة الذاكرة عند تبديل الحساب (حساب جديد = صفر) ---------- */
  let lastAcc = S.acc ? String(S.acc.e).toLowerCase() : '';
  const resetMem = () => Object.assign(S, { pts: CFG.start, gems: CFG.startG, usd: 0, cl: [], run: 0, left: 86400, accr: 0, accg: 0, done: 0, wg: 0, ml: [], mk: [], wd: [], cart: [], mq: [] });
  const _load = window.load;
  window.load = function (a) {
    const e = String(a && a.e || '').toLowerCase();
    if (e && e !== lastAcc) resetMem();
    lastAcc = e;
    return _load.apply(this, arguments);
  };
  const _fin = window.finishOtp;
  if (typeof _fin === 'function') {
    window.finishOtp = function (o) {
      try {
        if (o && o.p === 'signup' && o.pl && o.pl.e) { // أي بقايا قديمة لنفس البريد على هذا الجهاز تُمسح
          const e = o.pl.e;
          ['ctr_state:' + e, 'led:' + e, 'rfl:' + e, 'adjx:' + e, 'cldt:' + e.toLowerCase(), 'cldv:' + e.toLowerCase(), sidKey(e)].forEach(lsDel);
          lastAcc = '';
          resetMem();
        }
      } catch (x) {}
      return _fin.apply(this, arguments);
    };
  }

  /* ---------- الدخول: يعمل من أي جهاز، ورمز واتساب للجهاز الجديد أو عند تفعيل المصادقة الثنائية ---------- */
  const _dl = window.doLogin;
  window.doLogin = async function () {
    const e = ($('#le') || {}).value ? $('#le').value.trim().toLowerCase() : '', w = ($('#lp') || {}).value || '';
    if (!EM.test(e) || !w) return _dl();
    let h; try { h = await hp(w); } catch (x) { return _dl(); }
    const body = { e, h, device_id: did() };
    let r = await api('/api/sec/login', body);
    if (r.s === 429) return er(r.j.error || 'حاول لاحقاً');
    if (r.s === 403) return er(r.j.error || 'هذا الحساب محظور');
    if (r.s === 200 && r.j.need_otp) {
      const resend = async () => { const x = await api('/api/sec/login', body); return x.s === 200 ? '' : (x.j.error || 'تعذر إرسال الرمز'); };
      for (;;) {
        const code = await askOtp(r.j.reason === 'tfa' ? 'المصادقة الثنائية' : 'تأكيد تسجيل الدخول من جهاز جديد', r.j.to, resend);
        if (!code) return er('تم إلغاء تسجيل الدخول');
        r = await api('/api/sec/login', { ...body, otp: code });
        if (r.s === 200 && r.j.ok) break;
        say(r.j.error || 'الرمز غير صحيح');
        if (r.s === 429 || (r.j.error || '').includes('انتهت')) return er(r.j.error);
      }
    }
    if (r.s === 200 && r.j.ok) {
      const A = r.j.account, m = AC.get();
      if (!m[A.e]) { m[A.e] = { e: A.e, p: A.p, n: A.n, h: A.h, cr: A.cr || Date.now(), b: A.b, kyc: A.kyc ? 1 : 0, mv: A.vml ? 1 : 0 }; AC.set(m); }
      lsSet(sidKey(A.e), r.j.sid); SEC.tfa = !!r.j.tfa;
    }
    return _dl(); // يكمل الدخول المحلي المعتاد بعد نجاح التحقق من السيرفر
  };

  /* ---------- الخروج وإلغاء الجلسة ---------- */
  const _cs = window.clearSes;
  window.clearSes = function () {
    try { const c = cred(); if (c && c.sid) { fetch('/api/sec/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c), keepalive: true }).catch(() => {}); lsDel(sidKey(S.acc.e)); } } catch (e) {}
    return _cs.apply(this, arguments);
  };

  /* ---------- نبض كل 5 ثوانٍ ---------- */
  let busy = false;
  async function ping() {
    const c = cred(); if (!c || busy || document.hidden) return; busy = true;
    try {
      const r = await api('/api/sec/ping', c);
      if (r.s === 200 && r.j.revoked) {
        lsDel(sidKey(S.acc.e)); _cs.call(window); S.acc = null; go('welcome'); say('تم تسجيل خروجك من هذا الجهاز');
      } else if (r.s === 200) { if (r.j.sid) lsSet(sidKey(S.acc.e), r.j.sid); SEC.tfa = !!r.j.tfa; }
    } catch (e) {} finally { busy = false; }
  }
  setInterval(ping, 5000); setTimeout(ping, 2500);

  /* ---------- جلسات الدخول ---------- */
  const esc2 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = { mobile: '📱', tablet: '📱', desktop: '💻' };
  async function showSessions() {
    const c = cred(); if (!c) return say('سجّل الدخول أولاً');
    const r = await api('/api/sec/sessions', c);
    if (r.s !== 200) return say(r.j.error || 'تعذر تحميل الجلسات');
    const L = r.j.sessions;
    dlg(`<h2 style="margin-top:0">جلسات تسجيل الدخول</h2>
${L.map((s) => `<div class="card" style="padding:12px;margin-bottom:8px"><div class="row2"><b>${ico[s.kind] || '💻'} ${esc2(s.device)}</b>${s.cur ? '<span class="bdg ok">هذا الجهاز</span>' : ''}</div>
<div class="mu" style="font-size:.85rem;margin-top:4px">${s.loc ? '📍 ' + esc2(s.loc) + '<br>' : ''}IP: <span dir="ltr">${esc2(s.ip)}</span><br>آخر نشاط: ${dt(s.seen)}</div>
${s.cur ? '' : `<button class="btn o sm" style="margin-top:8px;width:100%" data-a="secrev" data-v="${s.id}">تسجيل الخروج من هذه الجلسة</button>`}</div>`).join('') || '<div class="card mu">لا توجد جلسات</div>'}
${L.length > 1 ? '<button class="btn r" style="width:100%" data-a="secrevall">تسجيل الخروج من كل الجلسات الأخرى</button>' : ''}`);
  }
  async function revoke(target) {
    const c = cred(); if (!c) return;
    const r = await api('/api/sec/revoke', { ...c, target });
    if (r.s !== 200) return say(r.j.error || 'تعذر التنفيذ');
    say(target === 'others' ? 'تم الخروج من كل الجلسات الأخرى' : 'تم تسجيل الخروج من الجلسة'); showSessions();
  }

  /* ---------- المصادقة الثنائية ---------- */
  async function toggleTfa() {
    const c = cred(); if (!c) return say('سجّل الدخول أولاً');
    const on = !SEC.tfa;
    if (!confirm(on ? 'تفعيل المصادقة الثنائية؟ سيُطلب رمز واتساب عند كل تسجيل دخول.' : 'إيقاف المصادقة الثنائية؟')) return;
    const body = { ...c, on };
    let r = await api('/api/sec/tfa', body);
    if (r.s !== 200) return say(r.j.error || 'تعذر إرسال الرمز');
    for (;;) {
      const code = await askOtp(on ? 'تفعيل المصادقة الثنائية' : 'إيقاف المصادقة الثنائية', r.j.to, async () => { const x = await api('/api/sec/tfa', body); return x.s === 200 ? '' : (x.j.error || 'تعذر الإرسال'); });
      if (!code) return;
      r = await api('/api/sec/tfa', { ...body, otp: code });
      if (r.s === 200 && r.j.ok) { SEC.tfa = !!r.j.tfa; say(SEC.tfa ? 'تم تفعيل المصادقة الثنائية' : 'تم إيقاف المصادقة الثنائية'); try { draw(); } catch (e) {} return; }
      say(r.j.error || 'الرمز غير صحيح');
      if (r.s === 429 || (r.j.error || '').includes('انتهت')) return;
    }
  }

  window.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-a]'); if (!t || !/^sec/.test(t.dataset.a)) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    const a = t.dataset.a;
    if (a === 'secsess') showSessions(); else if (a === 'sectfa') toggleTfa();
    else if (a === 'secrev') revoke(t.dataset.v); else if (a === 'secrevall') revoke('others');
  }, true);

  /* صفوف الإعدادات في الملف الشخصي */
  const row = (a, title, sub) => `<button class="li" data-a="${a}">${ic('chev')}<div class="sp"><b>${title}</b><div class="mu">${sub}</div></div></button>`;
  const _draw = window.draw;
  window.draw = function () {
    _draw.apply(this, arguments);
    try {
      if (S.r === 'profile' && S.acc) {
        const app = document.querySelector('#app'), anchor = app.querySelector('button[data-a="rcopy"]');
        if (anchor && !app.querySelector('[data-a="secsess"]')) anchor.insertAdjacentHTML('afterend',
          row('secsess', 'جلسات تسجيل الدخول', 'الأجهزة المسجّل دخولها ونوعها وموقعها وعنوان IP') + row('sectfa', 'المصادقة الثنائية (واتساب)', SEC.tfa ? '✅ مفعّلة · اضغط للإيقاف' : 'غير مفعّلة · اضغط للتفعيل'));
      }
    } catch (e) {}
  };
})();

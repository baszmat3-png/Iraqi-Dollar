/* المتابعة عبر Google: نافذة Google تعرض حسابات الجهاز للاختيار، ثم يُسجَّل الدخول أو يُنشأ الحساب تلقائياً.
 * يعتمد على: GOOGLE_CLIENT_ID في السيرفر + security-ext.js (window.SECX) */
(function () {
  if (typeof S === 'undefined' || typeof AC === 'undefined' || typeof load !== 'function') return;
  let cfg = null, gsiP = null, busy = 0;
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const fail = (m) => { try { er(m); } catch (e) { say(m); } };

  async function getCfg() {
    if (cfg) return cfg;
    try {
      const r = await fetch('/api/auth/google/config', { cache: 'no-store' });
      cfg = await r.json();
    } catch (e) { cfg = null; }
    return cfg;
  }
  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gsiP) return gsiP;
    gsiP = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => { gsiP = null; no(new Error('gsi')); };
      document.head.appendChild(s);
    });
    return gsiP;
  }
  // نجهّز كل شيء مسبقاً حتى يُفتح الـ popup فوراً عند الضغط (المتصفحات تحجب النوافذ التي تتأخر عن الضغطة)
  function prep() { getCfg().then((c) => { if (c && c.enabled) return loadGsi(); }).catch(() => {}); }
  prep();

  function setBusy(on) {
    busy = on ? 1 : 0;
    document.querySelectorAll('[data-a="gsign"]').forEach((b) => { b.disabled = !!on; b.style.opacity = on ? '.6' : ''; });
  }

  window.googleSignIn = function () {
    if (busy) return;
    if (typeof CFG !== 'undefined' && CFG.maint) return fail('التطبيق قيد الصيانة حالياً، حاول لاحقاً');
    if (!cfg) { say('جارٍ التجهيز… اضغط مرة أخرى بعد لحظة'); prep(); return; }
    if (!cfg.enabled || !cfg.clientId) return fail('الدخول عبر Google غير مفعّل بعد، تواصل مع الإدارة');
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      say('جارٍ الاتصال بـ Google… اضغط مرة أخرى بعد لحظة');
      loadGsi().catch(() => fail('تعذر الاتصال بخدمة Google، تحقق من الإنترنت'));
      return;
    }
    setBusy(true);
    try {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: 'openid email profile',
        callback: (r) => {
          if (r && r.access_token) return finish(r.access_token);
          setBusy(false);
          if (r && r.error && !/access_denied|popup_closed/.test(r.error)) fail('تعذر الدخول عبر Google');
        },
        error_callback: (e) => {
          setBusy(false);
          if (!e || e.type !== 'popup_closed') fail('تعذر فتح نافذة Google، اسمح بالنوافذ المنبثقة ثم أعد المحاولة');
        },
      });
      tc.requestAccessToken({ prompt: 'select_account' }); // يعرض قائمة حسابات Google للاختيار
    } catch (e) { setBusy(false); fail('تعذر الدخول عبر Google'); }
  };

  async function finish(at) {
    try {
      let r, j;
      try {
        r = await fetch('/api/auth/google', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: at, create: !(typeof CFG !== 'undefined' && CFG.reg === 0) }),
        });
        j = await r.json().catch(() => ({}));
      } catch (e) { return fail('تعذر الاتصال بالسيرفر، حاول مجدداً'); }
      if (!r.ok || !j.ok) return fail(j.error || 'تعذر الدخول عبر Google');

      const A = j.account, e = String(A.e).toLowerCase();
      try { debtGuard(e); ctrPurge(); } catch (x) {}

      if (j.isNew && window.SECX) SECX.wipeLocal(A.e);
      if (window.SECX) {
        const ok = await SECX.openSession(A.e, A.h);
        if (ok !== true) return fail(ok);
      }

      // حفظ الحساب محلياً (السيرفر هو المرجع)
      const m = AC.get(), k = Object.keys(m).find((x) => x.toLowerCase() === e);
      if (!k || j.isNew) {
        if (k) delete m[k];
        m[A.e] = { e: A.e, p: A.p || '', n: A.n, h: A.h, cr: A.cr || Date.now(), b: j.isNew ? [CFG.start, CFG.startG, 0] : A.b, kyc: A.kyc ? 1 : 0, mv: 1 };
      } else {
        const x = m[k]; x.h = A.h; if (A.n && !x.n) x.n = A.n; if (A.p && !x.p) x.p = A.p; if (A.kyc) x.kyc = 1; x.mv = 1; delete x.blk;
      }
      const saved = AC.set(m);
      const a = AC.get()[k && !j.isNew ? k : A.e];
      if (a.blk) return fail(a.why == 'debt' ? 'تم حظر حسابك لعدم تسديد قسط الاستدانة، تواصل مع الدعم' : 'هذا الحساب محظور، تواصل مع الدعم');

      load(a);
      if (j.isNew) {
        saveSes();
        go('ref');
        if (window.SECX) setTimeout(() => { try { SECX.pushNow(); } catch (x) {} }, 300);
        return dlg(`<h2 style="text-align:center;margin-top:0;color:#3ddc68">تم إنشاء حسابك بنجاح ✓</h2><p class="mu" style="text-align:center">مرحباً ${esc(a.n)}، تم إنشاء حسابك عبر Google ويمكنك الدخول لاحقاً بنفس الطريقة.${saved ? '' : '<br><span style="color:#f4c20d">تنبيه: المتصفح الحالي يمنع الحفظ الدائم، فالحساب يعمل حتى إغلاق الصفحة فقط.</span>'}</p><button class="btn" onclick="d.close()">متابعة</button>`);
      }
      enter();
    } catch (e) { console.error('google login', e); fail('حدث خطأ أثناء الدخول: ' + (e && e.message ? e.message : e)); }
    finally { setBusy(false); }
  }
})();

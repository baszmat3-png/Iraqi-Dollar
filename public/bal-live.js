/* bal-live.js — مزامنة لحظية لرصيد المستخدم (نقاط · جواهر · دولار) مع السيرفر على كل الأجهزة (تطبيق + متصفح + أكثر من جهاز)
 *
 *  المبدأ: السيرفر هو المرجع الوحيد للرصيد، ورقم لوحة التحكم هو نفسه رقم المستخدم تماماً (بدون زيادة ولا نقصان).
 *   • أي تغيير على السيرفر (شحن/خصم/تصفير من الإدارة، هدية، تاجر، وكيل، P2P...) يصل كل أجهزة الحساب بحدث «bal» (SSE)،
 *     فيسحب الجهاز الرصيد الحقيقي ويعرضه خلال أجزاء من الثانية.
 *   • أي تغيير محلي (استلام عائد، شراء، تحويل...) يُرسَل كـ«فرق» فقط إلى /api/bal/push، بمعرّف عملية فريد
 *     (إعادة الإرسال بعد انقطاع الشبكة لا تُحسب مرتين) — لا يُرسَل رصيد مطلق أبداً، فلا يستطيع جهاز متأخر أن يمسح شحن الإدارة أو يضاعفه.
 *   • الرصيد الجديد = رصيد السيرفر + أي تغيير محلي لم يُرسَل بعد (فلا يضيع شيء أثناء الإرسال).
 *   • احتياط: سحب دوري كل 8 ثوانٍ إن لم يصل أي بثّ، ويُكمل بعد عودة الشبكة.
 */
(function () {
  'use strict';
  if (window.__balLive) return;
  window.__balLive = 1;
  if (typeof S === 'undefined') return;

  const POLL_MS = 400, SAFETY_MS = 8000;
  let base = null;                 // {e,p,g,u}: آخر رصيد معروف من السيرفر لهذا الحساب
  let busy = false, wantPull = false, pend = null, failN = 0, nextOk = 0, lastPull = 0, drawT = 0, tmr = 0;
  const round2 = (v) => Math.round(v * 100) / 100;
  const nf = (n) => { try { return typeof f === 'function' ? f(n) : Math.floor(n).toLocaleString('en'); } catch (x) { return String(Math.floor(n)); } };

  const acct = () => {
    try { const a = S.acc; if (a && a.e && a.h && !a.demo) return { e: String(a.e).toLowerCase(), h: String(a.h) }; } catch (x) { /* لا حساب */ }
    return null;
  };

  /* ---------- حفظ آخر نقطة مزامنة (لإكمال ما لم يُرسَل بعد إعادة فتح التطبيق) ---------- */
  const bkey = (e) => 'bl2:' + e;
  const readBase = (e) => {
    try { const j = JSON.parse(localStorage.getItem(bkey(e)) || 'null'); return j && Array.isArray(j.v) && j.v.length === 3 && j.v.every(Number.isFinite) ? j : null; } catch (x) { return null; }
  };
  const writeBase = () => { try { if (base) localStorage.setItem(bkey(base.e), JSON.stringify({ v: [base.p, base.g, base.u], t: Date.now() })); } catch (x) { /* ممتلئ */ } };
  // الحالة المحلية المحفوظة تتوافق مع نقطة المزامنة المحفوظة؟ (وإلا لا نحسب فرقاً منها حتى لا نُرسل رقماً قديماً)
  const stateMatches = (e, st) => {
    try {
      const k = typeof sk === 'function' ? sk() : 'ctr_state:' + e;
      const cs = JSON.parse(localStorage.getItem(k) || 'null');
      return !!cs && (+cs.at || 0) >= st.t - 2000;
    } catch (x) { return false; }
  };

  /* ---------- الشبكة ---------- */
  const hdr = (a) => ({ 'x-e': encodeURIComponent(a.e), 'x-h': a.h, 'Content-Type': 'application/json' });
  async function call(a, path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: hdr(a), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    if (!r.ok) { const er = new Error('http ' + r.status); er.code = r.status; throw er; }
    const j = await r.json();
    if (!j || j.ok !== true) throw new Error('bad');
    return j;
  }
  const newOp = () => {
    let c = 'x'; try { c = String(typeof CID !== 'undefined' ? CID : 'x'); } catch (x) { /* ثابت */ }
    return c + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  };

  /* ---------- عرض الرصيد الجديد ---------- */
  const uiBusy = () => {
    const ae = document.activeElement, dd = document.getElementById('d');
    return !!((ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) || (dd && dd.open));
  };
  function redraw() {
    clearTimeout(drawT);
    const go = () => { if (uiBusy()) { drawT = setTimeout(go, 700); return; } try { draw(); } catch (x) { /* تُرسم لاحقاً */ } };
    go();
  }

  // T: الرصيد الحقيقي الآن على السيرفر · sent: الفرق الذي أرسلناه وصار داخل T (أو صفر)
  function adopt(T, sent) {
    const a = acct();
    if (!a || !base || base.e !== a.e) return;
    const ex = [S.pts - base.p - sent[0], S.gems - base.g - sent[1], S.usd - base.u - sent[2]];   // تغييرات محلية لم تصل السيرفر بعد
    const ext = [T.pts - base.p - sent[0], T.gems - base.g - sent[1], T.usd - base.u - sent[2]];  // تغييرات جاءت من السيرفر (إدارة/تحويل/هدية...)
    const np = Math.max(0, T.pts + ex[0]), ng = Math.max(0, T.gems + ex[1]), nu = Math.max(0, round2(T.usd + ex[2]));
    const changed = np !== S.pts || ng !== S.gems || nu !== S.usd;
    S.pts = np; S.gems = ng; S.usd = nu;
    base = { e: base.e, p: T.pts, g: T.gems, u: T.usd };
    try { save(); } catch (x) { /* اختياري */ }
    writeBase();
    if (changed) {
      redraw();
      try {
        if (!document.hidden && (Math.abs(ext[0]) >= 1 || Math.abs(ext[1]) >= 1 || Math.abs(ext[2]) >= 0.01)) toast('تم تحديث رصيدك');
      } catch (x) { /* اختياري */ }
    }
  }

  /* ---------- الدورة: إرسال الفروقات المحلية ثم سحب الرصيد عند الحاجة ---------- */
  function onErr(e) {
    const c = e && e.code;
    if (c === 401 || c === 404) { nextOk = Date.now() + 15000; return; }   // الحساب غير مصدَّق/غير موجود: لا نُلحّ
    failN++; nextOk = Date.now() + Math.min(500 * Math.pow(2, failN), 10000);
  }

  async function firstSync(a) {
    busy = true;
    try {
      const st = readBase(a.e);
      if (st && stateMatches(a.e, st)) { base = { e: a.e, p: st.v[0], g: st.v[1], u: st.v[2] }; wantPull = true; return; }
      // أول مزامنة لهذا الحساب على هذا الجهاز: السيرفر هو المرجع، فيُعتمد رصيده كما في لوحة التحكم تماماً
      const T = await call(a, '/api/bal/get');
      const cur = acct();
      if (!cur || cur.e !== a.e) return;
      const same = S.pts === T.pts && S.gems === T.gems && S.usd === T.usd;
      base = { e: a.e, p: T.pts, g: T.gems, u: T.usd };
      S.pts = T.pts; S.gems = T.gems; S.usd = T.usd;
      try { save(); } catch (x) { /* اختياري */ }
      writeBase();
      lastPull = Date.now(); failN = 0;
      if (!same) redraw();
    } catch (e) { onErr(e); } finally { busy = false; }
  }

  async function cycle() {
    if (busy || Date.now() < nextOk) return;
    const a = acct();
    if (!a) { base = null; pend = null; return; }
    if (!base || base.e !== a.e) { base = null; pend = null; wantPull = false; return firstSync(a); }
    busy = true;
    try {
      if (!pend) {
        const dp = Math.round(S.pts - base.p), dg = Math.round(S.gems - base.g), du = round2(S.usd - base.u);
        if (dp || dg || Math.abs(du) >= 0.005) pend = { op: newOp(), d: [dp, dg, Math.abs(du) >= 0.005 ? du : 0] };
      }
      if (pend) {
        const j = await call(a, '/api/bal/push', { op: pend.op, dp: pend.d[0], dg: pend.d[1], du: pend.d[2] });
        const sent = pend.d; pend = null;
        adopt(j, sent);
        lastPull = Date.now();
      }
      if (wantPull || Date.now() - lastPull > SAFETY_MS) {
        wantPull = false; lastPull = Date.now();
        adopt(await call(a, '/api/bal/get'), [0, 0, 0]);
      }
      failN = 0;
    } catch (e) { onErr(e); } finally { busy = false; }
  }

  const kick = () => { clearTimeout(tmr); tmr = setTimeout(cycle, 0); };
  const pull = () => { wantPull = true; nextOk = 0; kick(); };

  window.__balPull = pull;
  window.addEventListener('bal-evt', pull);                                        // بثّ فوري من السيرفر: رصيد حسابي تغيّر
  window.addEventListener('store-evt', (e) => { if (e && e.detail && e.detail.k === 'hello') pull(); }); // (إعادة) اتصال البثّ: عوّض ما فات
  window.addEventListener('online', pull);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  setInterval(cycle, POLL_MS);
  setTimeout(cycle, 600);

  // استعادة الحالة المحلية (دخول/تحديث سحابي/تصفير عدادات) قد تُرجع رقماً قديماً: لا نحسب منه فرقاً، نعتمد رصيد السيرفر من جديد
  const ors = window.restoreState;
  if (typeof ors === 'function') {
    window.restoreState = function () {
      const r = ors.apply(this, arguments);
      try { const a = acct(); if (a) localStorage.removeItem(bkey(a.e)); base = null; pend = null; wantPull = false; kick(); } catch (x) { /* اختياري */ }
      return r;
    };
  }

  window.__balLiveDbg = () => ({ base, pend, busy, wantPull, nextOk });
})();

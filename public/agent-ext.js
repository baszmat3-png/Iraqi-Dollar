/* لوحة الوكيل — مرحلة 11
   1) شحن عضو: البحث على السيرفر برمز الإحالة/البريد/الاسم مع عرض الصورة والاسم والبريد، ثم الشحن عبر السيرفر
   2) شراء النقاط بالسعر الرسمي: معاينة المبلغ بالدينار أثناء الكتابة (والإرسال للإدارة في merchant-ext.js) */
(function () {
  if (typeof S === 'undefined' || typeof AG === 'undefined') return;
  // تصميم لوحة الوكيل الجديد (معلومات الوكالة + تحويل من الحساب + سجل العمليات اللحظي)
  try { if (!window.__agpLoad) { window.__agpLoad = 1; const sc = document.createElement('script'); sc.src = '/agent-panel.js?v=1'; document.head.appendChild(sc); } } catch (e) {}
  const css = document.createElement('style');
  css.textContent = `
  #agres{display:grid;gap:8px;margin:2px 0 10px}
  .ag-it{display:flex;align-items:center;gap:12px;width:100%;text-align:start;font:inherit;color:inherit;padding:10px 12px;border-radius:16px;border:1.5px solid var(--line);background:#ffffff0a;cursor:pointer}
  .ag-it.on{border-color:#3ddc68;background:#3ddc6818;cursor:default}
  .ag-it .sp{flex:1;min-width:0;display:grid;line-height:1.45}
  .ag-it b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ag-it small{color:var(--mu,#9fb0c0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem}
  .ag-av{width:48px;height:48px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:700;font-size:1.2rem;background:linear-gradient(135deg,#2bcfe2,#1a8fa3);color:#06232a;background-size:cover!important}
  .ag-ok{color:#3ddc68;font-weight:700;font-size:.85rem;flex:none}
  .ag-no{text-align:center;color:var(--mu,#9fb0c0);font-size:.9rem;padding:6px}`;
  document.head.appendChild(css);

  const st = (window.AGX = { q: '', items: [], sel: null, busy: false, seq: 0, tm: 0, empty: false });
  const me = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const J = async (p, b) => {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.message || 'تعذر الاتصال بالخادم');
    return j;
  };
  const E = (v) => { try { return esc(v); } catch (e) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'); } };
  const face = (it) => it.av && it.uid
    ? `<span class="ag-av" style="background:url('/api/soc/avatar/${E(it.uid)}?v=${it.av}') center/cover;color:transparent">${E((it.name || '?').charAt(0))}</span>`
    : `<span class="ag-av">${E((it.name || it.email || '?').trim().charAt(0).toUpperCase())}</span>`;
  const row = (it, i, picked) => `<button type="button" class="ag-it ${picked ? 'on' : ''}" ${picked ? '' : `data-agpick="${i}"`}>${face(it)}<span class="sp"><b>${E(it.name || 'بدون اسم')}</b><small dir="ltr">${E(it.email)}</small><small>رمز الإحالة: <span dir="ltr">${E(it.code || '—')}</span></small></span>${picked ? '<span class="ag-ok">✓ تم الاختيار</span>' : ''}</button>`;

  function paint() {
    const box = document.querySelector('#agres'); if (!box) return;
    if (st.sel) box.innerHTML = row(st.sel, 0, true);
    else if (st.items.length) box.innerHTML = st.items.map((it, i) => row(it, i, false)).join('');
    else if (st.busy) box.innerHTML = '<div class="ag-no">جارٍ البحث…</div>';
    else if (st.empty) box.innerHTML = '<div class="ag-no">لا يوجد عضو مطابق</div>';
    else box.innerHTML = '';
  }
  async function search() {
    const q = st.q.trim(), my = ++st.seq;
    if (q.length < 2 || !me()) { st.items = []; st.empty = false; st.busy = false; return paint(); }
    st.busy = true; st.empty = false; paint();
    try {
      const j = await J('/api/m/agent/lookup', { ...me(), q });
      if (my !== st.seq) return;
      st.items = j.items || []; st.empty = !st.items.length;
      if (st.items.length === 1 && /^[A-Za-z0-9]{3,16}$/.test(q) && String(st.items[0].code || '').toLowerCase() === q.toLowerCase()) st.sel = st.items[0]; // رمز إحالة مطابق تماماً
    } catch (e) { if (my !== st.seq) return; st.items = []; st.empty = false; say(e.message); }
    st.busy = false; paint();
  }

  document.addEventListener('input', (ev) => {
    const t = ev.target; if (!t) return;
    if (t.id === 'agm') { st.q = t.value; st.sel = null; clearTimeout(st.tm); st.tm = setTimeout(search, 350); if (!t.value.trim()) { st.items = []; st.empty = false; paint(); } }
    else if (t.id === 'agb') {
      const n = Math.floor(+t.value || 0), m = document.querySelector('#agbm'); if (!m) return;
      try { m.textContent = n > 0 ? '= ' + f(Math.round(n * agOff() / 1000)) + ' دينار (≈ ' + iq2usd(Math.round(n * agOff() / 1000)) + ')' : ''; } catch (e) {}
    }
  }, true);
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-agpick]'); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    st.sel = st.items[+b.dataset.agpick] || null;
    const x = document.querySelector('#agm'); if (x && st.sel) x.value = st.sel.email;
    paint(); const n = document.querySelector('#agn'); if (n) n.focus();
  }, true);

  // الشحن عبر السيرفر (يتحقق من الرصيد ويخصم من الرسمي ثم السيولة ويُضاف لرصيد العضو لحظياً)
  let charging = false;
  window.agChg = async function () {
    if (charging) return; const a = myAg(), id = me(); if (!a || !id) return;
    const n = Math.floor(+((document.querySelector('#agn') || {}).value || 0));
    if (!st.sel) return say(st.q.trim().length >= 2 ? 'اختر العضو من نتائج البحث أولاً' : 'اكتب رمز إحالة العضو ثم اختره من النتائج');
    if (!(n > 0)) return say('أدخل عدد النقاط');
    const liq = +a.o[4] || 0, of = +a.o[9] || 0; if (n > liq + of) return say('رصيدك لا يكفي، المتاح ' + f(liq + of));
    if (!confirm('شحن ' + f(n) + ' نقطة إلى ' + (st.sel.name || st.sel.email) + '؟')) return;
    charging = true;
    try {
      const j = await J('/api/m/agent/charge', { ...id, target: st.sel.email, pts: n });
      const k = AG.findIndex((o) => o && !o[6] && String(o[8] || '').toLowerCase() === String(S.acc.e).toLowerCase());
      if (k >= 0) { AG[k][4] = j.liq; AG[k][9] = j.off; LSset('agents', AG); }
      try { const l = LS('chlog', []); l.unshift({ id: 'C' + (Date.now() % 1e6), to: j.name || j.email, ty: 'عضو (وكيل ' + j.agent + ')', a: n, b: 0, af: n, n: 'شحن من الوكيل', at: Date.now() }); LSset('chlog', l.slice(0, 100)); } catch (e) {}
      say('تم شحن ' + f(n) + ' نقطة إلى ' + (j.name || j.email));
      st.q = ''; st.items = []; st.sel = null; st.empty = false;
      draw();
    } catch (e) { say(e.message); } finally { charging = false; }
  };

  /* ---------- صور الوكلاء في قائمة الوكلاء: نفس صورة حساب الوكيل، وتظهر للمستخدمين بعد اعتماده ---------- */
  const AV = { map: null, at: 0, busy: false, k: '' };
  async function loadAv() {
    if (AV.busy) return; AV.busy = true;
    try {
      const r = await fetch('/api/soc/agent-avatars', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json(), k = JSON.stringify(j.map || {}), ch = k !== AV.k;
        AV.k = k; AV.map = j.map || {}; AV.at = Date.now();
        if (ch && S.r === 'agents') draw();
      }
    } catch (e) {}
    AV.busy = false;
  }
  function paintAv() {
    if (!AV.map || Date.now() - AV.at > 20000) loadAv();
    if (!AV.map) return;
    document.querySelectorAll('#app [data-a="ag"][data-i]').forEach((b) => {
      const o = AG[+b.dataset.i], em = String((o && o[8]) || '').trim().toLowerCase(), x = AV.map[em];
      const card = b.closest('.card'), ci = card && card.querySelector('.ci');
      if (!em || !ci) return;
      // المصدر الأول: نقطة صور الوكلاء، والاحتياطي: خريطة الصور العامة (merchant-ext) بحسب البريد
      const mv = window.MX && MX.av && MX.av[em];
      const url = x ? '/api/soc/avatar/' + encodeURIComponent(x.uid) + '?v=' + x.av : (mv ? '/api/m/avatar?e=' + encodeURIComponent(em) + '&v=' + mv : '');
      if (!url) return;
      ci.innerHTML = '';
      ci.style.cssText += ';width:52px;height:52px;min-width:52px;border-radius:50%;flex:none;background:url(' + url + ') center/cover no-repeat;border:2px solid #3ddc68';
    });
  }

  /* رفع صورة الحساب المحفوظة محلياً على الجهاز للسيرفر مرة واحدة (حتى تظهر للمستخدمين، ومنها صورة الوكيل) */
  async function upLocalAvatar() {
    try {
      const id = me(); if (!id || !S.av || !/^data:image\/(png|jpe?g|webp);base64,/.test(S.av)) return;
      const k = 'avup:' + id.e.toLowerCase() + ':' + S.av.length; if (localStorage.getItem(k)) return;
      const r = await fetch('/api/m/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...id, image: S.av }) });
      if (r.ok) { localStorage.setItem(k, '1'); loadAv(); }
    } catch (e) {}
  }
  setInterval(upLocalAvatar, 15000); setTimeout(upLocalAvatar, 4000);

  const _draw = window.draw;
  window.draw = function () {
    const r = _draw.apply(this, arguments);
    try {
      if (S.r === 'agents') paintAv();
      if (S.r === 'agdash') {
        const x = document.querySelector('#agm'); if (x && !x.value) x.value = st.sel ? st.sel.email : st.q;
        paint();
      }
    } catch (e) {}
    return r;
  };
})();

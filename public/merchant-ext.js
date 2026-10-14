/* المرحلة 2 — التجار + الصورة الشخصية الدائمة + دعوة الإحالة والمشاركة (تحديث كل 5 ثوانٍ من السيرفر) */
(function () {
  if (typeof S === 'undefined' || typeof V === 'undefined') return;
  const MX = (window.MX = { merchants: [], me: null, av: {}, agents: {}, sig: '' });
  const id = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const post = async (p, b) => {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال بالخادم');
    return j;
  };
  const shrink = (file, max, q) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
  const typing = () => /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  const nf = (n) => Number(n || 0).toLocaleString('en-US');

  /* ---------- الصور الشخصية ---------- */
  window.mxAv = (e) => {
    const v = MX.av[String(e || '').toLowerCase()];
    return v ? `background:url('/api/m/avatar?e=${encodeURIComponent(String(e).toLowerCase())}&v=${v}') center/cover;color:transparent;` : '';
  };
  const myAv = () => { const v = S.acc && MX.av[S.acc.e.toLowerCase()]; return v ? `/api/m/avatar?e=${encodeURIComponent(S.acc.e.toLowerCase())}&v=${v}` : ''; };
  window.addEventListener('change', async (ev) => {
    const t = ev.target; if (!t || t.id !== 'pf') return;
    ev.stopImmediatePropagation();
    const f = t.files[0]; if (!f) return;
    const me = id(); if (!me) return say('سجّل الدخول أولاً');
    try {
      const image = await shrink(f, 320, 0.82);
      const j = await post('/api/m/avatar', { ...me, image });
      MX.av[S.acc.e.toLowerCase()] = j.v; S.av = myAv(); say('تم حفظ الصورة الشخصية'); draw();
    } catch (e) { say(e.message); }
  }, true);

  /* ---------- التجار ---------- */
  const mCard = (m) => `<button class="ic" style="background:hsl(calc(var(--h) + 8) 58% 26%);padding:18px" data-a="mxo" data-v="${m.id}"><div class="sp"><span class="mu">اسم المتجر:</span> <b style="font-size:1.3rem">${esc(m.name)}</b><div><span class="mu">نسبة الخصم:</span> <span class="bdg ok" style="border-radius:8px;border:1.5px solid var(--cy)">${m.discount}%</span></div>${m.province ? `<div class="mu" style="font-size:.85rem">${esc(m.province)}</div>` : ''}</div><div class="ci" style="width:72px;height:72px;${m.img ? `background:url('${m.img}') center/cover` : ''}">${m.img ? '' : ic('store', 30)}</div></button>`;

  V.merchants = () => {
    const me = MX.me, list = MX.merchants.filter((m) => !S.mprov || String(m.province || '').includes(S.mprov));
    return hd('قائمة التجار', '', { back: 'store' }) +
      `<div class="g2"><div class="card row" style="padding:10px 14px"><div class="ci" style="width:40px;height:40px">${ic('globe')}</div><div class="sp"><small class="mu">البلد</small><br><b>العراق</b></div></div><div class="card row" style="padding:10px 14px"><div class="ci" style="width:40px;height:40px">${ic('bld')}</div><div class="sp"><small class="mu">المحافظة</small><select id="mprov" aria-label="المحافظة" style="margin:2px 0 0;padding:6px 8px;border-radius:10px;font-size:.9rem">${provOpts(S.mprov || '', 'كل المحافظات')}</select></div></div></div>` +
      (me && me.status === 'active'
        ? `<button class="ic" style="background:hsl(calc(var(--h) + 7) 64% 25%);padding:18px" data-a="go" data-v="mxdash"><div class="ci">${ic('store')}</div><b class="sp" style="font-size:1.2rem">لوحة متجري: ${esc(me.name)}</b>${ic('chev')}</button>`
        : me && me.status === 'pending'
          ? `<div class="card row2" style="padding:12px 16px"><div><b>${esc(me.name)}</b><div class="mu">${esc(me.province)}</div></div><span class="bdg no">بانتظار موافقة لوحة التحكم</span></div>`
          : `<button class="ic" style="background:hsl(calc(var(--h) + 7) 64% 25%);padding:18px" data-a="addm"><div class="ci">${ic('store')}</div><b class="sp" style="font-size:1.2rem">إضافة تاجر جديد</b>${ic('chev')}</button>`) +
      (list.length ? list.map(mCard).join('') : '<div class="card mu" style="text-align:center">لا يوجد تجار معتمدون بعد</div>');
  };

  const det = (l, v) => (v ? `<div style="margin-top:8px"><span class="mu">${l}:</span> ${esc(v)}</div>` : '');
  function openMerchant(mid) {
    const m = MX.merchants.find((x) => x.id == mid); if (!m) return;
    const own = S.acc && m.owner === S.acc.e.toLowerCase();
    dlg(`<h2 style="margin-top:0">${esc(m.name)}</h2>${m.img ? `<img src="${m.img}" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:8px">` : ''}
<span class="bdg ok">خصم ${m.discount}%</span>${det('المحافظة', m.province)}${det('التفاصيل', m.details)}${det('العنوان', m.address)}${det('أقرب نقطة دالة', m.landmark)}${det('الخدمات', m.services)}${det('الهاتف', m.phone)}
${own ? '<div class="card mu" style="margin-top:12px">هذا متجرك. حسابك للاستقبال فقط ولا يمكنك التحويل إليه.</div>'
        : `<label style="display:block;margin-top:12px">عدد النقاط<input id="mxa" type="number" inputmode="numeric"></label><button class="btn" data-a="mxpay" data-v="${m.id}">تحويل النقاط</button>`}`);
  }
  async function payMerchant(mid) {
    const n = Math.floor(+(document.querySelector('#mxa') || {}).value || 0), me = id();
    if (!me) return say('سجّل الدخول أولاً');
    if (!(n > 0)) return say('يرجى إدخال عدد النقاط');
    if (S.pts < n) return say('رصيد النقاط غير كافٍ');
    try {
      const j = await post('/api/m/pay', { ...me, id: +mid, pts: n });
      document.querySelector('#d').close();
      pay(n, 'تم تحويل ' + nf(n) + ' نقطة إلى ' + j.name + ' بنجاح'); draw(); poll();
    } catch (e) { say(e.message); }
  }

  /* لوحة التاجر (استقبال فقط) */
  V.mxdash = () => {
    const m = MX.me;
    if (!m || m.status !== 'active') return hd('لوحة المتجر', 'store', { back: 'home' }) + '<div class="card mu" style="text-align:center">لا تملك متجراً معتمداً</div>';
    const cap = m.cap, left = cap > 0 ? Math.max(0, cap - m.today) : null, pc = cap > 0 ? Math.min(100, Math.round(m.today * 100 / cap)) : 0;
    const inp = (i, l, v, ph) => `<label style="display:block;margin-top:8px"><span class="mu">${l}</span><input id="${i}" value="${esc(v || '')}" placeholder="${ph || ''}"></label>`;
    return hd('لوحة المتجر', 'store', { back: 'home' }) +
      `<div class="card"><div class="row2"><b style="font-size:1.3rem">${esc(m.name)}</b><span class="bdg ok">معتمد · استقبال فقط</span></div>
<div class="g2" style="margin-top:10px"><div class="card" style="text-align:center"><div class="mu">استلمت اليوم</div><b class="cy" style="font-size:1.3rem">${nf(m.today)}</b></div><div class="card" style="text-align:center"><div class="mu">إجمالي المستلم</div><b class="cy" style="font-size:1.3rem">${nf(m.total)}</b></div></div>
<div style="margin-top:8px">السقف اليومي: <b>${cap > 0 ? nf(cap) + ' نقطة' : 'غير محدد'}</b>${left != null ? ` · المتبقي: <b>${nf(left)}</b>` : ''}</div>
${cap > 0 ? `<div style="height:8px;border-radius:99px;background:#0003;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pc}%;background:var(--cy)"></div></div>` : ''}
<div class="mu" style="font-size:.85rem;margin-top:6px">السقف يحدده مدير لوحة التحكم. المستخدمون يحوّلون إليك، ولا يمكنك التحويل من هذه اللوحة.</div></div>
<div class="card"><h3 style="margin:0 0 6px">بيانات المتجر</h3>
${inp('mxn', 'اسم المتجر', m.name)}${inp('mxdc', 'نسبة الخصم %', m.discount)}
<label class="btn o sm" style="display:block;text-align:center;margin-top:8px">${m.img ? 'تغيير صورة المتجر' : 'رفع صورة المتجر'}<input id="mxim" type="file" accept="image/*" hidden></label><div id="mxin" class="mu" style="font-size:.85rem"></div>
<label style="display:block;margin-top:8px"><span class="mu">الوصف</span><textarea id="mxd" rows="3" style="width:100%;box-sizing:border-box">${esc(m.details)}</textarea></label>
${inp('mxad', 'العنوان', m.address)}${inp('mxlm', 'أقرب نقطة دالة', m.landmark)}${inp('mxsv', 'الخدمات التي يقدمها المتجر', m.services, 'مثال: توصيل، تقسيط، صيانة')}${inp('mxph', 'رقم الهاتف', m.phone)}
<button class="btn" style="margin-top:10px" data-a="mxsave">حفظ</button></div>
<h3>آخر عمليات الاستلام</h3>${m.tx.length ? m.tx.map((t) => `<div class="card row2" style="padding:10px 14px"><div><b>${esc(t.n || '—')}</b><div class="mu" style="font-size:.8rem">${dt(t.t)}</div></div><b class="cy">+${nf(t.pts)}</b></div>`).join('') : '<div class="card mu" style="text-align:center">لا توجد عمليات بعد</div>'}`;
  }
  let mxImg = null;
  window.addEventListener('change', async (ev) => {
    if (!ev.target || ev.target.id !== 'mxim' || !ev.target.files[0]) return;
    try { mxImg = await shrink(ev.target.files[0], 900, 0.75); const n = document.querySelector('#mxin'); if (n) n.textContent = 'تم اختيار الصورة، اضغط حفظ'; } catch (e) { say('تعذر قراءة الصورة'); }
  }, true);
  async function saveShop() {
    const me = id(), g = (i) => (document.querySelector(i) || {}).value || '';
    try {
      await post('/api/m/profile', { ...me, name: g('#mxn'), discount: g('#mxdc'), image: mxImg, details: g('#mxd'), address: g('#mxad'), landmark: g('#mxlm'), services: g('#mxsv'), phone: g('#mxph') });
      mxImg = null; say('تم حفظ بيانات المتجر'); poll(true);
    } catch (e) { say(e.message); }
  }

  /* شريط اسم المتجر المثبت في الأعلى */
  function bar() {
    let b = document.querySelector('#mxbar'); const m = MX.me && MX.me.status === 'active' && S.acc && S.r !== 'panel' ? MX.me : null;
    if (!m) { if (b) { b.remove(); document.body.style.paddingTop = ''; } return; }
    if (!b) { b = document.createElement('div'); b.id = 'mxbar'; b.setAttribute('data-a', 'go'); b.setAttribute('data-v', 'mxdash'); b.style.cssText = 'position:fixed;top:0;inset-inline:0;z-index:50;height:34px;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--cy);color:#fff;font-weight:700;cursor:pointer'; document.body.append(b); document.body.style.paddingTop = '34px'; }
    b.innerHTML = '🏪 ' + esc(m.name) + ' · لوحة المتجر';
  }

  /* ---------- دعوة الإحالة + المشاركة ---------- */
  const code = () => { try { return String(ucode({ e: S.acc.e })); } catch (e) { return ''; } };
  const invite = () => { const c = code(), link = location.origin + '/?ref=' + encodeURIComponent(c);
    return `🌟 انضم إلى منصة «الدولار العراقي» 🌟\n\n✅ اشترِ عدادات واكسب نقاطاً يومياً\n✅ حوّل واسحب أرباحك بسهولة\n🎁 سجّل برمز الإحالة الخاص بي واستفد من المكافآت\n\n🔑 رمز الإحالة: ${c}\n🔗 رابط المنصة: ${link}`; };
  function inviteDlg() {
    if (!S.acc) return;
    dlg(`<h2 style="margin-top:0">دعوة صديق</h2><div class="card" style="white-space:pre-line;line-height:1.9;padding:14px">${esc(invite())}</div><div class="g2" style="margin-top:10px"><button class="btn" data-a="mxinvc">نسخ الدعوة</button><button class="btn o" data-a="mxshare">${ic('share', 16)} مشاركة</button></div>`);
  }
  async function share() {
    const t = invite();
    try { if (navigator.share) { await navigator.share({ title: 'الدولار العراقي', text: t }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
  }
  const shareRow = () => '<button class="li" data-a="mxshare">' + ic('chev') + '<div class="sp"><b>مشاركة رمز الإحالة</b><div class="mu">أرسل دعوة جاهزة مع رابط المنصة لأصدقائك</div></div></button>';
  const shareCard = '<button class="btn" style="width:100%;margin:10px 0" data-a="mxinv">دعوة صديق ومشاركة رمزك</button>';

  /* ---------- لوحة الوكيل: طرق الدفع بعلامة صح + الوصف ---------- */
  const methodsOf = () => { const e = S.acc ? S.acc.e.toLowerCase() : '', saved = (MX.agents[e] || {}).m || [];
    return agPayList().map((x) => { const s = saved.find((y) => y.n === x.n); return { n: x.n, on: s ? !!s.on : false, v: s ? s.v : '' }; }); };
  const agCard = () => { const e = S.acc.e.toLowerCase(), d = (MX.agents[e] || {}).d || '';
    return `<div class="card" id="mxag"><h3 style="margin:0 0 6px">وصف الوكالة وطرق الدفع</h3><div class="mu" style="font-size:.85rem;margin-bottom:6px">فعّل طرق الدفع التي تستلم عليها واكتب رقمك. تظهر للمشترين عند فتح معلومات وكالتك.</div>
<label style="display:block"><span class="mu">وصف الوكالة (اكتب ما تحب)</span><textarea id="mxagd" rows="4" style="width:100%;box-sizing:border-box" placeholder="ساعات العمل، الشروط، طريقة التعامل...">${esc(d)}</textarea></label>
${methodsOf().map((x, i) => `<div class="row" style="margin-top:8px;gap:8px"><input type="checkbox" id="mxm_on_${i}" ${x.on ? 'checked' : ''} style="width:22px;height:22px;flex:none"><b style="min-width:80px">${esc(x.n)}</b><input id="mxm_v_${i}" dir="ltr" placeholder="رقم الحساب / المحفظة" value="${esc(x.v)}" style="margin:0"></div>`).join('')}
<button class="btn" style="margin-top:10px" data-a="mxagsave">حفظ</button></div>`; };
  async function saveAgent() {
    const me = id(), g = (i) => document.querySelector(i);
    const methods = agPayList().map((x, i) => ({ n: x.n, on: g('#mxm_on_' + i).checked ? 1 : 0, v: g('#mxm_v_' + i).value.trim() }));
    if (methods.some((x) => x.on && !x.v)) return say('اكتب الرقم أمام كل طريقة مفعّلة');
    try { await post('/api/m/agent/save', { ...me, description: g('#mxagd').value, methods }); say('تم حفظ وصف الوكالة وطرق الدفع'); poll(true); } catch (e) { say(e.message); }
  }
  // يظهر للمشتري داخل نافذة معلومات الوكيل
  function agentPublic(i) {
    const o = AG[+i], e = o && String(o[8] || '').toLowerCase(), p = e && MX.agents[e]; if (!p) return;
    const on = (p.m || []).filter((x) => x.on), d = document.querySelector('#d'), first = d && d.querySelector('.card'); if (!first) return;
    first.insertAdjacentHTML('afterend', `<div class="card" style="padding:12px;margin-top:8px">${p.d ? `<b>وصف الوكالة</b><div style="white-space:pre-wrap;line-height:1.8;margin:6px 0 10px">${esc(p.d)}</div>` : ''}<b>طرق الدفع</b>${on.map((x) => `<div class="row" style="margin-top:8px;justify-content:space-between"><span>✅ ${esc(x.n)}</span><span dir="ltr" style="color:var(--cy);font-weight:700">${esc(x.v)}</span></div>`).join('') || '<div class="mu" style="margin-top:6px">لم يحدد الوكيل طرق دفع بعد</div>'}</div>`);
  }

  /* ---------- النقرات ---------- */
  window.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, v = t.dataset.v;
    if (a === 'ag') { setTimeout(() => agentPublic(t.dataset.i), 80); return; }
    if (a === 'rcopy') { setTimeout(inviteDlg, 120); return; } // النسخ الأصلي يعمل ثم تظهر الكليشة
    if (!/^mx/.test(a)) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (a === 'mxo') openMerchant(v);
    else if (a === 'mxpay') payMerchant(v);
    else if (a === 'mxsave') saveShop();
    else if (a === 'mxagsave') saveAgent();
    else if (a === 'mxinv') inviteDlg();
    else if (a === 'mxshare') share();
    else if (a === 'mxinvc') { try { rcCopy(invite()); } catch (e) { navigator.clipboard && navigator.clipboard.writeText(invite()); say('تم نسخ الدعوة'); } }
  }, true);

  /* ---------- ربط الرسم ---------- */
  const _draw = window.draw;
  window.draw = function () {
    _draw.apply(this, arguments);
    try {
      bar();
      const app = document.querySelector('#app');
      if (S.r === 'agdash' && S.acc && myAg() && !app.querySelector('#mxag')) { const h = app.querySelector('.hd'); h && h.insertAdjacentHTML('afterend', agCard()); }
      if (S.r === 'profile') { const b = app.querySelector('button[data-a="rcopy"]'); if (b && !app.querySelector('[data-a="mxshare"]')) b.insertAdjacentHTML('afterend', shareRow()); }
      if ((S.r === 'users' || S.r === 'refer') && S.acc && !app.querySelector('[data-a="mxinv"]')) { const h = app.querySelector('.hd'); h && h.insertAdjacentHTML('afterend', shareCard); }
    } catch (e) {}
  };

  /* ---------- مزامنة كل 5 ثوانٍ ---------- */
  const applied = new Set(JSON.parse(localStorage.getItem('mxapplied') || '[]'));
  async function mirrorRequests() {
    const me = id(); if (!me || (MX.me && MX.me.status !== 'suspended')) return false;
    let did = false;
    for (const x of RQ()) {
      if (x.t !== 'انضمام تاجر' || x.e !== S.acc.e || x.s || applied.has(x.id)) continue;
      try { await post('/api/m/apply', { ...me, name: x.n, province: x.city || '', discount: x.disc || 10 }); applied.add(x.id); did = true; localStorage.setItem('mxapplied', JSON.stringify([...applied])); } catch (e) {}
    }
    return did;
  }
  let busy = false;
  async function poll(force) {
    const me = id(); if (!me || busy || (document.hidden && !force)) return; busy = true;
    try {
      let j = await post('/api/m/state', me);
      MX.me = j.me;
      if (await mirrorRequests()) j = await post('/api/m/state', me);
      const sig = JSON.stringify([j.merchants, j.me, j.av]);
      MX.merchants = j.merchants; MX.me = j.me; MX.av = j.av || {}; MX.agents = j.agents || {};
      const mine = myAv(); if (mine && S.av !== mine) { S.av = mine; }
      if (j.me && j.me.status === 'active') for (const x of RQ()) if (x.t === 'انضمام تاجر' && x.e === S.acc.e && !x.s) { const l = RQ(); const o = l.find((y) => y.id === x.id); if (o) { o.s = 1; LSset('rq', l); } }
      if (sig !== MX.sig) { MX.sig = sig; if (!typing() && ['merchants', 'mxdash', 'profile', 'users', 'home'].includes(S.r)) draw(); else bar(); }
    } catch (e) {} finally { busy = false; }
  }
  window.mxPoll = poll;
  setInterval(poll, 5000); setTimeout(poll, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();

/* المرحلة 2 — التجار + الصورة الشخصية الدائمة + دعوة الإحالة والمشاركة (تحديث كل 5 ثوانٍ من السيرفر) */
(function () {
  if (typeof S === 'undefined' || typeof V === 'undefined') return;
  const MX = (window.MX = { merchants: [], me: null, av: {}, agents: {}, sig: '', mpLimit: 1000000, mpUsed: 0, abuys: [], agWa: false, preqs: [] });
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
  const payRate = () => { try { return (+CFG.agRate > 0 ? +CFG.agRate : 132) / 1000; } catch (e) { return 0.132; } }; // دينار لكل نقطة (سعر المستخدم)
  const iqdOf = (n) => Math.round((+n || 0) * payRate());
  const usdOf = (d) => { try { return '$' + ((+d || 0) / (+CFG.iqd || 1620)).toFixed(2); } catch (e) { return ''; } };
  const leftToday = () => (MX.mpLimit > 0 ? Math.max(0, MX.mpLimit - MX.mpUsed) : Infinity);
  const shortTxt = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  try {
    const st = document.createElement('style');
    st.textContent = `
.mp{--ac:#22d3ee;--xb:#1b2938;--xb2:#172330;--xl:#264a5d;margin-top:14px}
.mp-hero{position:relative;overflow:hidden;border-radius:26px;padding:16px;color:#fff;background:linear-gradient(135deg,#0e8aa3 0%,#0b5f7e 55%,#0a3d5f 100%);border:1.5px solid #1fb5d0;box-shadow:0 10px 32px #22d3ee22;margin-bottom:12px}
.mp-hero:before{content:"";position:absolute;inset-inline-start:-40px;top:-60px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,#ffffff24,transparent 70%);pointer-events:none}
.mp-hero .t{color:#c9eff6;font-size:.9rem;position:relative}.mp-hero .v{font-size:1.9rem;font-weight:800;line-height:1.3;margin:2px 0 10px;position:relative}.mp-hero .v small{font-size:.9rem;font-weight:600;color:#bfe9f1;margin-inline-start:6px}
.mp-st{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:relative}.mp-st>div{background:#06304a80;border:1px solid #ffffff1a;border-radius:16px;padding:8px 12px;min-width:0}
.mp-st small{display:block;color:#bfe3ec;font-size:.76rem}.mp-st b{display:block;font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-p{background:linear-gradient(180deg,var(--xb),var(--xb2));border:1.5px solid var(--xl);border-top:4px solid var(--ac);border-radius:24px;padding:14px;margin-bottom:12px}
.mp-l{display:block;color:#9AA9B5;font-size:.88rem;margin:0 2px 4px}
.mxsel{display:flex;align-items:center;gap:10px;width:100%;text-align:start;font:inherit;color:inherit;background:#0b141c;border:1.5px solid var(--xl);border-radius:18px;padding:10px 12px;cursor:pointer;margin:2px 0}
.mxsel.on,.mxsel:focus-visible{border-color:var(--ac);box-shadow:0 0 0 3px #22d3ee22;outline:0}.mxsel .sp{min-width:0}.mxsel b{display:block}.mxsel small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mxsel>svg{flex:none;transition:transform .2s;color:var(--ac)}.mxsel.on>svg{transform:rotate(90deg)}
.mp-av{flex:none;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#22d3ee1f;color:var(--ac);border:1px solid #22d3ee44;font-weight:800;overflow:hidden}.mp-av svg{width:22px;height:22px}
.mxlist{max-height:250px;overflow:auto;background:#0b141c;border:1.5px solid var(--xl);border-radius:18px;margin:6px 0 2px;padding:4px}
.mxit{display:flex;gap:10px;align-items:center;width:100%;text-align:start;font:inherit;color:inherit;background:none;border:0;border-radius:14px;padding:9px 10px;cursor:pointer}
.mxit:hover,.mxit.on{background:#22d3ee14}.mxit .sp{min-width:0;flex:1}.mxit .l1{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mxit small{display:block;color:#9AA9B5;margin-top:2px;line-height:1.5;white-space:normal;font-size:.78rem}
.mp-bd{flex:none;font-size:.72rem;font-weight:800;border-radius:99px;padding:2px 10px;background:#34d39922;color:#34d399;border:1px solid #34d39966}
.mp-in{display:flex;align-items:center;gap:8px;background:#0b141c;border:1.5px solid var(--line,#27566b);border-radius:18px;padding:0 14px;margin:2px 0}
.mp-in:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px #22d3ee22}
.mp-in input{outline:0!important;border:0!important;background:none!important;margin:0!important;padding:12px 0!important;font-size:1.35rem;font-weight:700;box-shadow:none!important;min-width:0}
.mp-in span{color:var(--ac);font-weight:800;flex:none}
.mp-ch{display:flex;gap:8px;margin:8px 0 2px}.mp-ch button{flex:1;font:inherit;font-weight:700;font-size:.86rem;color:var(--ac);background:#22d3ee14;border:1.5px solid #22d3ee44;border-radius:14px;padding:7px 4px;cursor:pointer}.mp-ch button:active{transform:scale(.96)}
.mp-lim{color:#9AA9B5;font-size:.8rem;margin:6px 2px 0}
.mxeq{background:#0e1923;border:1.5px dashed var(--xl);border-radius:20px;padding:4px 14px;margin:0 0 12px}
.mxeq>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d}.mxeq>div:last-child{border:0}
.mxeq span{color:#9AA9B5;font-size:.88rem}.mxeq b{font-size:1rem}.mxeq .big b{font-size:1.4rem;color:var(--ac)}.mxeq .bad b{color:#ff7a75}
.mp-go{background:linear-gradient(90deg,#0e8aa3,#22d3ee)!important;color:#06222b!important;padding:16px!important;font-size:1.05rem;box-shadow:0 8px 24px #22d3ee30!important}.mp-go[disabled]{opacity:.5;box-shadow:none!important}
.mp-note{display:flex;gap:8px;align-items:flex-start;color:#9AA9B5;font-size:.8rem;line-height:1.6;margin:10px 2px 0}.mp-note svg{flex:none;margin-top:4px;color:var(--ac)}
#mxpp::-webkit-inner-spin-button,#mxpp::-webkit-outer-spin-button,#mxa::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}#mxpp,#mxa{-moz-appearance:textfield}
.mxeq b.cy{color:var(--ac)}`;
    document.head.appendChild(st);
  } catch (e) {}

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
        : me && me.status === 'rejected' && !MX.rejHide
          ? `<div class="card" style="padding:12px;border-color:#ef5350"><b style="color:#ef5350">تم رفض طلب التاجر السابق</b><div class="mu" style="margin-top:4px">${esc(me.note || '')} أُعيدت الرسوم إلى رصيدك، ويمكنك تقديم طلب جديد.</div></div><button class="ic" style="background:hsl(calc(var(--h) + 7) 64% 25%);padding:18px" data-a="addm"><div class="ci">${ic('store')}</div><b class="sp" style="font-size:1.2rem">إضافة تاجر جديد</b>${ic('chev')}</button>`
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
<span class="bdg ok">خصم ${m.discount}%</span>${det('المحافظة', m.province)}${det('المنطقة', m.area)}${det('التفاصيل', m.details)}${det('العنوان', m.address)}${det('أقرب نقطة دالة', m.landmark)}${det('الخدمات', m.services)}${det('الهاتف', m.phone)}
${own ? '<div class="card mu" style="margin-top:12px">هذا متجرك. حسابك للاستقبال فقط ولا يمكنك التحويل إليه.</div>'
        : `<label style="display:block;margin-top:12px">عدد النقاط<input id="mxa" type="number" inputmode="numeric" min="1"></label><div class="mxeq" id="mxeqm" style="display:none"></div><div class="mu" style="font-size:.82rem">${limTxt()}</div><button class="btn" data-a="mxpay" data-v="${m.id}">تحويل النقاط</button>`}`);
  }
  const limTxt = () => (MX.mpLimit > 0 ? 'الحد الأقصى اليومي: ' + nf(MX.mpLimit) + ' نقطة · المتبقي لك اليوم: ' + nf(leftToday()) + ' نقطة' : 'لا يوجد حد يومي للدفع للتجار');
  let paying = false;
  async function payMerchant(mid, amount) {
    if (paying) return;
    const n = Math.floor(amount != null ? +amount : +(document.querySelector('#mxa') || {}).value || 0), me = id();
    if (!me) return say('سجّل الدخول أولاً');
    if (!mid) return say('اختر التاجر أولاً');
    if (!(n > 0)) return say('يرجى إدخال عدد النقاط');
    if (n > leftToday()) return say('تجاوزت الحد اليومي. المتبقي لك اليوم: ' + nf(leftToday()) + ' نقطة');
    if (S.pts < n) return say('رصيد النقاط غير كافٍ');
    paying = true;
    try {
      const j = await post('/api/m/pay', { ...me, id: +mid, pts: n });
      MX.mpUsed += n;
      try { document.querySelector('#d').close(); } catch (e) {}
      // الخصم من رصيد الدافع (الدالة pay الأصلية محلية داخل index.html فلا تُستدعى من هنا)
      try { lrs('الدفع للتاجر', 'التاجر: ' + j.name + ' · ' + nf(n) + ' نقطة'); } catch (e) {}
      S.pts -= n; try { txlog('الدفع للتاجر: ' + j.name, n, 'out'); } catch (e) {}
      try { save(); } catch (e) {}
      say('تم تحويل ' + nf(n) + ' نقطة إلى ' + j.name + ' بنجاح'); draw(); poll(true);
    } catch (e) { say(e.message); } finally { paying = false; }
  }

  /* ---------- نافذة «الدفع للتاجر»: قائمة منسدلة بالتجار + كمية النقاط + ما يعادلها بالدينار ---------- */
  let sel = 0;
  const merchantsForPay = () => MX.merchants.filter((m) => !(S.acc && m.owner === S.acc.e.toLowerCase()));
  const descOf = (m) => shortTxt(m.services || m.details || '', 110) || 'لم يضف التاجر وصفاً لخدماته بعد';
  const eqRow = (l, v, c) => `<div class="${c || ''}"><span>${l}</span><b>${v}</b></div>`;
  const mAv = (m) => `<span class="mp-av" ${m && m.img ? `style="background:url('${m.img}') center/cover;color:transparent"` : ''}>${m && m.img ? '' : ic('store', 22)}</span>`;
  function payDlg() {
    if (!S.acc) return say('سجّل الدخول أولاً');
    sel = 0;
    const list = merchantsForPay(), lf = leftToday();
    dlg(`<div class="row2"><button class="ib" style="border:0;background:none;color:#fff" onclick="d.close()" aria-label="إغلاق">${ic('x', 28)}</button><div class="row"><h2 style="margin:0">الدفع للتاجر</h2><div class="ci" style="width:56px;height:56px;border-radius:19px">${ic('qr', 28)}</div></div></div>
<div class="mp">${list.length ? `
<div class="mp-hero"><div class="t">رصيدك الحالي</div><div class="v" id="mxbal">${nf(S.pts)}<small>نقطة</small></div>
<div class="mp-st"><div><small>المتبقي لك اليوم</small><b id="mxlim2">${lf === Infinity ? 'بلا حد' : nf(lf) + ' نقطة'}</b></div><div><small>سعر النقطة</small><b>${(payRate() * 1000).toFixed(0)} د.ع / 1000</b></div></div></div>
<div class="mp-p"><span class="mp-l">اختر التاجر</span>
<button type="button" class="mxsel" id="mxsel" data-a="mxddt" aria-haspopup="listbox"><span id="mxsav">${mAv(null)}</span><span class="sp" style="flex:1"><b id="mxsn">اختر التاجر</b><small class="mu" id="mxss">اضغط لعرض التجار وخدماتهم</small></span>${ic('chev', 18)}</button>
<div class="mxlist" id="mxlist" role="listbox" hidden>${list.map((m) => `<button type="button" class="mxit" role="option" data-a="mxddp" data-v="${m.id}">${mAv(m)}<span class="sp"><span class="l1"><b>${esc(m.name)}</b><span class="mp-bd">خصم ${m.discount}%</span></span><small>${esc(descOf(m))}</small>${m.province ? `<small style="opacity:.8">${esc(m.province)}${m.area ? ' · ' + esc(m.area) : ''}</small>` : ''}</span></button>`).join('')}</div></div>
<div class="mp-p"><span class="mp-l">عدد النقاط المراد إرسالها</span>
<div class="mp-in"><input id="mxpp" type="number" inputmode="numeric" min="1" placeholder="0" autocomplete="off"><span>نقطة</span></div>
<div class="mp-ch">${[['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', 'الكل']].map((c) => `<button type="button" data-a="mxchip" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
<div class="mp-lim" id="mxlim">${limTxt()}</div></div>
<div class="mxeq" id="mxeq">${eqRow('ما ستدفعه بالدينار', '<b id="mxiq">0</b> د.ع', 'big')}${eqRow('يعادله بالدولار', '<span id="mxus" dir="ltr">≈ $0.00</span>')}${eqRow('رصيدك بعد الدفع', '<span id="mxaf">' + nf(S.pts) + ' نقطة</span>')}</div>
<button class="btn mp-go" id="mxgo" data-a="mxpay2">تحويل النقاط</button>
<div class="mp-note">${ic('info', 16)}<span>تُخصم النقاط من رصيدك وتصل إلى التاجر فوراً.</span></div>`
      : '<div class="card mu" style="text-align:center;margin:20px 0">لا يوجد تجار معتمدون حالياً</div>'}</div>`);
    poll(true).then(() => { const e = document.querySelector('#mxlim'); if (e) e.textContent = limTxt(); const l2 = document.querySelector('#mxlim2'); if (l2) { const x = leftToday(); l2.textContent = x === Infinity ? 'بلا حد' : nf(x) + ' نقطة'; } }).catch(() => {});
  }
  function payPick(mid) {
    const m = MX.merchants.find((x) => x.id == mid); if (!m) return;
    sel = m.id;
    const a = document.querySelector('#mxsn'), b = document.querySelector('#mxss'), l = document.querySelector('#mxlist'), t = document.querySelector('#mxsel'), v = document.querySelector('#mxsav');
    if (a) a.textContent = m.name; if (b) b.textContent = 'خصم ' + m.discount + '% · ' + descOf(m);
    if (v) v.innerHTML = mAv(m);
    if (l) l.hidden = true; if (t) t.classList.remove('on');
    document.querySelectorAll('#mxlist .mxit').forEach((x) => x.classList.toggle('on', x.dataset.v == mid));
  }
  function payToggle() {
    const l = document.querySelector('#mxlist'), t = document.querySelector('#mxsel'); if (!l) return;
    l.hidden = !l.hidden; if (t) t.classList.toggle('on', !l.hidden);
  }
  function payChip(p) {
    const i = document.querySelector('#mxpp'); if (!i) return;
    const cap = Math.min(Math.floor(S.pts), leftToday()), k = (+p || 0) / 100;
    i.value = Math.max(0, k >= 1 ? cap : Math.floor(cap * k));
    payPreview({ target: i });
  }
  function payPreview(ev) {
    const n = Math.floor(+(ev.target.value || 0)), iq = iqdOf(n);
    const a = document.querySelector('#mxiq'), b = document.querySelector('#mxus'), c = document.querySelector('#mxaf'); if (a) a.textContent = nf(iq); if (b) b.textContent = '≈ ' + usdOf(iq);
    if (c) { const af = S.pts - n, bad = af < 0 || n > leftToday(); c.textContent = af < 0 ? 'رصيدك غير كافٍ' : n > leftToday() ? 'تجاوزت الحد اليومي' : nf(af) + ' نقطة'; c.parentElement.parentElement.className = bad ? 'bad' : ''; }
    const m = document.querySelector('#mxeqm'); if (m && ev.target.id === 'mxa') { m.style.display = n > 0 ? '' : 'none'; m.innerHTML = `<div class="mu" style="font-size:.85rem">ما ستدفعه بالدينار</div><b>${nf(iq)}</b> دينار <span class="mu">≈ ${usdOf(iq)}</span>`; }
  }
  document.addEventListener('input', (ev) => { if (ev.target && (ev.target.id === 'mxpp' || ev.target.id === 'mxa')) payPreview(ev); });

  /* لوحة التاجر (استقبال فقط) */
  V.mxdash = () => {
    const m = MX.me;
    if (!m || m.status !== 'active') return hd('لوحة المتجر', 'store', { back: 'home' }) + '<div class="card mu" style="text-align:center">لا تملك متجراً معتمداً</div>';
    const cap = m.cap, left = cap > 0 ? Math.max(0, cap - m.today) : null, pc = cap > 0 ? Math.min(100, Math.round(m.today * 100 / cap)) : 0;
    const ro = (l, v) => (v ? `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:6px"><span class="mu">${l}</span><b style="text-align:end">${esc(v)}</b></div>` : '');
    return hd('لوحة المتجر', 'store', { back: 'home' }) +
      `<div class="card"><div class="row2"><b style="font-size:1.3rem">${esc(m.name)}</b><span class="bdg ok">معتمد · استقبال فقط</span></div>
<div class="g2" style="margin-top:10px"><div class="card" style="text-align:center"><div class="mu">استلمت اليوم</div><b class="cy" style="font-size:1.3rem">${nf(m.today)}</b></div><div class="card" style="text-align:center"><div class="mu">إجمالي المستلم</div><b class="cy" style="font-size:1.3rem">${nf(m.total)}</b></div></div>
<div style="margin-top:8px">السقف اليومي: <b>${cap > 0 ? nf(cap) + ' نقطة' : 'غير محدد'}</b>${left != null ? ` · المتبقي: <b>${nf(left)}</b>` : ''}</div>
${cap > 0 ? `<div style="height:8px;border-radius:99px;background:#0003;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pc}%;background:var(--cy)"></div></div>` : ''}
<div class="mu" style="font-size:.85rem;margin-top:6px">السقف يحدده مدير لوحة التحكم. المستخدمون يحوّلون إليك، ولا يمكنك التحويل من هذه اللوحة.</div></div>
<div class="card"><h3 style="margin:0 0 6px">صورة المتجر</h3><div class="row" style="gap:12px;align-items:center"><div class="ci" style="width:84px;height:84px;flex:none;${m.img ? `background:url('${m.img}') center/cover` : ''}">${m.img ? '' : ic('store', 34)}</div><div class="sp"><label class="btn" for="mxsi" style="display:block;margin:0;text-align:center;cursor:pointer">${m.img ? 'تغيير الصورة' : 'رفع صورة'}</label><input id="mxsi" type="file" accept="image/*" hidden>${m.img ? '<button class="btn o" style="margin-top:6px" data-a="mxsirm">حذف الصورة</button>' : ''}</div></div><div class="mu" style="font-size:.8rem;margin-top:8px">صورة مستقلة عن صورتك الشخصية، تظهر لجميع المستخدمين في قائمة التجار وقائمة الدفع للتاجر.</div></div>
<div class="card"><h3 style="margin:0 0 6px">بيانات المتجر</h3>${ro('المحافظة', m.province)}${ro('المنطقة', m.area)}${ro('أقرب نقطة دالة', m.landmark)}${ro('الهاتف', m.phone)}
<div class="mu" style="font-size:.8rem;margin-top:8px">هذه البيانات تُغيَّر من لوحة التحكم فقط.</div></div>
<div class="card"><h3 style="margin:0 0 6px">ما يمكنك تعديله</h3>
<label style="display:block;margin-top:8px"><span class="mu">نسبة الخصم % (0 - 100)</span><input id="mxdc" type="number" inputmode="numeric" min="0" max="100" value="${esc(m.discount)}"></label>
<label style="display:block;margin-top:8px"><span class="mu">الخدمات التي تقدمها (تظهر للمستخدمين في قائمة الدفع للتاجر)</span><textarea id="mxsv" rows="3" maxlength="400" style="width:100%;box-sizing:border-box" placeholder="مثال: بيع بطاقات شحن، تعبئة رصيد، مستلزمات إلكترونية...">${esc(m.services)}</textarea></label>
<label style="display:block;margin-top:8px"><span class="mu">وصف المتجر</span><textarea id="mxd" rows="4" maxlength="600" style="width:100%;box-sizing:border-box" placeholder="اكتب وصفاً يظهر للمستخدمين...">${esc(m.details)}</textarea></label>
<button class="btn" style="margin-top:10px" data-a="mxsave">حفظ بيانات المتجر</button></div>
<h3>آخر عمليات الاستلام</h3>${m.tx.length ? m.tx.map((t) => `<div class="card row2" style="padding:10px 14px"><div><b>${esc(t.n || '—')}</b><div class="mu" style="font-size:.8rem">${dt(t.t)}</div></div><b class="cy">+${nf(t.pts)}</b></div>`).join('') : '<div class="card mu" style="text-align:center">لا توجد عمليات بعد</div>'}`;
  };
  async function saveShop() {
    const me = id(), g = (i) => (document.querySelector(i) || {}).value || '';
    const dc = Number(g('#mxdc'));
    if (!Number.isFinite(dc) || dc < 0 || dc > 100) return say('نسبة الخصم بين 0 و100');
    try {
      await post('/api/m/profile', { ...me, discount: dc, details: g('#mxd'), services: g('#mxsv') });
      say('تم حفظ بيانات المتجر'); poll(true);
    } catch (e) { say(e.message); }
  }

  /* ---------- طلب الانضمام كتاجر (يُستقطع المبلغ مقدماً ويُرسل للوحة التحكم) ---------- */
  const mrFee = () => { try { return Math.max(0, Math.floor(+CFG.mrFee || 200000)); } catch (e) { return 200000; } };
  const hasCounter = () => { try { return S.ctr.slice(5).some((n) => n > 0); } catch (e) { return false; } };
  let applyImg = '';
  function applyDlg() {
    applyImg = '';
    if (!S.acc) return say('سجّل الدخول أولاً');
    if (MX.me && MX.me.status === 'active') { try { document.querySelector('#d').close(); } catch (e) {} return go('mxdash'); }
    const ok = hasCounter(), fee = mrFee(), enough = S.pts >= fee, code = code_();
    const cond = (good, t) => `<div class="row" style="margin-top:6px"><span class="bdg ${good ? 'ok' : 'no'}">${good ? '✓' : '✗'}</span><span>${t}</span></div>`;
    const fld = (i, l, ph, v, ex) => `<label style="display:block;margin-top:6px"><span class="mu">${l}</span><input id="${i}" placeholder="${ph}" value="${esc(v || '')}" ${ex || ''}></label>`;
    dlg(`<h2 style="margin-top:0">إضافة تاجر جديد</h2>
<div class="card" style="margin-bottom:10px;padding:12px"><b>شروط الانضمام</b>
${cond(ok, 'امتلاك عداد الماسي (300,000 نقطة) فما فوق')}
${cond(enough, 'رصيد يكفي للرسوم: ' + nf(fee) + ' نقطة تُستقطع مقدماً')}
<div class="mu" style="font-size:.85rem;margin-top:6px">يُرسل الطلب إلى لوحة التحكم للموافقة، وتُعاد الرسوم إلى رصيدك إن رُفض الطلب.</div></div>
${ok ? `${fld('mxan', 'اسم المتجر', 'أدخل اسم المتجر')}
${fld('mxap', 'رقم الهاتف', 'أدخل رقم الهاتف', S.phone && !/123 4567/.test(S.phone) ? S.phone : '', 'type="tel" inputmode="tel" dir="ltr"')}
<label style="display:block;margin-top:6px"><span class="mu">المحافظة</span><select id="mxapv" style="width:100%;background:#0b141c;color:#fff;border:1.5px solid var(--line);border-radius:18px;padding:14px 16px;font:inherit;margin:6px 0">${provOpts('', 'اختر المحافظة')}</select></label>
${fld('mxaa', 'المنطقة', 'أدخل المنطقة')}
${fld('mxal', 'أقرب نقطة دالة', 'مثال: مقابل مدرسة، قرب جسر...')}
${fld('mxar', 'رمز الإحالة', '', code, 'readonly dir="ltr" style="opacity:.8"')}
<div style="margin-top:8px"><span class="mu">صورة المتجر (اختيارية، تظهر للجميع في قائمة التجار)</span><div class="row" style="margin-top:6px;gap:12px"><div id="mxaip" class="ci" style="width:72px;height:72px;flex:none">${ic('store', 30)}</div><label class="btn o" for="mxai" style="margin:0;text-align:center;cursor:pointer">اختيار صورة</label><input id="mxai" type="file" accept="image/*" hidden></div></div>
<button class="btn" style="margin-top:10px" data-a="mxapply" ${enough ? '' : 'disabled style="opacity:.5;margin-top:10px"'}>دفع ${nf(fee)} نقطة وإرسال الطلب</button>`
        : '<button class="btn" data-a="go" data-v="counter">شراء عداد الماسي</button>'}
<button class="btn o" style="margin-top:8px" onclick="d.close()">إلغاء</button>`);
  }
  const code_ = () => { try { return String(ucode({ e: S.acc.e })); } catch (e) { return ''; } };
  let applying = false;
  async function applyMerchant() {
    if (applying) return; const me = id(); if (!me) return say('سجّل الدخول أولاً');
    const g = (i) => ((document.querySelector(i) || {}).value || '').trim();
    const name = g('#mxan'), phone = g('#mxap'), province = g('#mxapv'), area = g('#mxaa'), landmark = g('#mxal');
    if (!hasCounter()) return say('تحتاج عداداً من فئة الماسي (300,000 نقطة) فما فوق');
    if (!name) return say('أدخل اسم المتجر');
    if (phone.replace(/\D/g, '').length < 9) return say('أدخل رقم هاتف صحيحاً');
    if (!province) return say('اختر المحافظة');
    if (!area) return say('أدخل المنطقة');
    if (!landmark) return say('أدخل أقرب نقطة دالة');
    const fee = mrFee();
    if (S.pts < fee) return say('رصيدك غير كافٍ، المطلوب ' + nf(fee) + ' نقطة');
    applying = true;
    try {
      const j = await post('/api/m/apply', { ...me, name, phone, province, area, landmark, ref_code: code_(), fee, image: applyImg || undefined });
      if (j.dup) { say('لديك طلب قائم بالفعل'); }
      else {
        try { lrs('رسوم طلب تجارة', 'المبلغ ' + nf(fee) + ' · يُعاد عند رفض الطلب'); } catch (e) {}
        S.pts -= fee; try { txlog('رسوم طلب تجارة', fee, 'out'); } catch (e) {}
        try { save(); } catch (e) {}
        say('تم استقطاع ' + nf(fee) + ' نقطة وإرسال طلبك إلى لوحة التحكم');
      }
      try { document.querySelector('#d').close(); } catch (e) {}
      await poll(true); draw();
    } catch (e) { say(e.message); } finally { applying = false; }
  }

  /* نافذة «أنت تاجر الآن» تظهر مرة واحدة بعد الموافقة */
  function merchantPop() {
    try {
      const m = MX.me; if (!m || m.status !== 'active' || !S.acc || S.r === 'panel') return;
      const d = document.querySelector('#d'); if (!d || d.open) return;
      const k = 'mxseen:' + S.acc.e + ':' + m.id; if (localStorage.getItem(k)) return; localStorage.setItem(k, '1');
      dlg(`<h2 style="margin-top:0;color:#3ddc68">🎉 أنت تاجر الآن</h2><div class="card" style="padding:12px;line-height:2">✓ اسم متجرك <b>${esc(m.name)}</b> يظهر للمستخدمين في قائمة التجار<br>✓ يحوّل لك المستخدمون النقاط مباشرة<br>✓ تعدّل وصف المتجر ونسبة الخصم من قسم التجار<br>✓ لوحة متجر خاصة بك تجدها داخل «قائمة التجار»<br><span class="mu">السقف اليومي: <b>${m.cap > 0 ? nf(m.cap) : 'غير محدد'}</b> نقطة</span></div><button class="btn" data-a="go" data-v="mxdash">فتح لوحة المتجر</button>`);
    } catch (e) {}
  }

  /* الشريط العلوي المثبّت للتاجر أُلغي: لوحة المتجر تظهر داخل «قائمة التجار» فقط لمن كان تاجراً معتمداً (انظر V.merchants) */
  function bar() {
    const b = document.querySelector('#mxbar'); if (b) b.remove();
    if (document.body.style.paddingTop === '34px') document.body.style.paddingTop = '';
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

  /* ---------- لوحة الوكيل: طلب شراء النقاط يُرسل إلى لوحة التحكم (بدل الدعم المباشر) ---------- */
  const abSt = { pending: ['بانتظار الموافقة', 'no'], approved: ['تمت الموافقة', 'ok'], rejected: ['مرفوض', 'no'] };
  const agReqList = () => `<div class="mu" style="font-size:.85rem;margin:8px 0 4px">يصل طلبك إلى الإدارة، وعند الموافقة تُشحن سيولتك بالنقاط المطلوبة فوراً.</div>` +
    (MX.abuys.length ? `<div style="margin-top:10px"><b>طلباتي</b>${MX.abuys.map((r) => `<div class="card row2" style="padding:10px 14px;margin-top:8px"><div><b>${nf(r.pts)} نقطة</b><div class="mu" style="font-size:.8rem">${nf(r.iqd)} دينار · ${dt(r.t)}${r.note ? ' · ' + esc(r.note) : ''}</div></div><span class="bdg ${(abSt[r.st] || ['', 'no'])[1]}" style="white-space:nowrap;flex:none">${(abSt[r.st] || [r.st])[0]}</span></div>`).join('')}</div>` : '');
  const _agdash = V.agdash;
  if (typeof _agdash === 'function') V.agdash = function () {
    const h = _agdash.apply(this, arguments);
    return h.replace(/<button class="btn[^"]*" data-ag="buy">[^<]*<\/button>/, '<button class="btn" data-a="mxagbuy">تقديم طلب للإدارة</button>' + agReqList());
  };
  let buying = false;
  async function sendAgentBuy() {
    if (buying) return; const me = id(); if (!me) return say('سجّل الدخول أولاً');
    const inp = document.querySelector('#agb'), n = Math.floor(+(inp || {}).value || 0);
    if (!(n > 0)) return say('أدخل عدد النقاط المطلوبة');
    buying = true;
    try {
      const j = await post('/api/m/agent/buy', { ...me, pts: n });
      if (inp) inp.value = '';
      const m = document.querySelector('#agbm'); if (m) m.textContent = '';
      say('تم تقديم طلبك (' + nf(n) + ' نقطة = ' + nf(j.iqd) + ' دينار) إلى الإدارة');
      await poll(true); draw();
    } catch (e) { say(e.message); } finally { buying = false; }
  }

  /* ---------- شاشة «طلب شراء وكالة»: أزرار واتساب تُدار من لوحة التحكم + زر «تقديم طلب عبر لوحة التحكم» ---------- */
  const prSt = { pending: ['بانتظار الموافقة', 'no'], approved: ['تمت الموافقة · شُحن رصيدك', 'ok'], rejected: ['مرفوض', 'no'] };
  const prList = () => (MX.preqs.length ? `<div style="margin-top:10px"><b>طلباتي</b>${MX.preqs.map((r) => `<div class="card row2" style="padding:10px 14px;margin-top:8px"><div><b>${nf(r.pts)} نقطة</b><div class="mu" style="font-size:.8rem">${nf(r.iqd)} دينار · ${dt(r.t)}${r.note ? ' · ' + esc(r.note) : ''}</div></div><span class="bdg ${(prSt[r.st] || ['', 'no'])[1]}" style="white-space:nowrap;flex:none">${(prSt[r.st] || [r.st])[0]}</span></div>`).join('')}</div>` : '');
  const ptsBox = (wa) => `<b>طلب شراء نقاط عبر لوحة التحكم</b><div class="mu" style="font-size:.85rem;margin:4px 0 8px">اكتب عدد النقاط التي تحتاجها، يصل طلبك إلى لوحة التحكم مع بياناتك ورقم هاتفك، وعند الموافقة تُشحن النقاط في حسابك مباشرة.</div><input id="agpts" type="number" inputmode="numeric" min="1" placeholder="عدد النقاط المطلوبة" style="margin:0 0 6px"><div id="mxprm" class="mu" style="min-height:1.4em;margin-bottom:6px;font-size:.88rem"></div><button class="btn" data-a="mxptsreq">${ic('coin', 18)} تقديم طلب عبر لوحة التحكم</button>${wa ? `<div style="margin-top:8px">${wa}</div>` : ''}<div id="mxprl">${prList()}</div>`;
  function patchAgy() {
    const d = document.querySelector('#d'); if (!d) return;
    const b = d.querySelector('[data-a="agpb"]');
    if (b && !d.querySelector('#mxpr')) { const box = b.parentElement, wa = MX.agWa ? b.outerHTML : ''; box.id = 'mxpr'; box.innerHTML = ptsBox(wa); }
    if (!MX.agWa) d.querySelectorAll('a[href*="wa.me"]').forEach((x) => x.remove()); // زر «تواصل عبر واتساب» يظهر فقط إذا فعّلته لوحة التحكم
  }
  const refreshPtsList = () => { const l = document.querySelector('#mxprl'); if (l) l.innerHTML = prList(); };
  if (typeof window.agyDlg === 'function') { const _agy = window.agyDlg; window.agyDlg = function () { const r = _agy.apply(this, arguments); try { patchAgy(); } catch (e) {} return r; }; }
  let ptsBusy = false;
  async function sendPtsReq() {
    if (ptsBusy) return; const me = id(); if (!me) return say('سجّل الدخول أولاً');
    const inp = document.querySelector('#agpts'), n = Math.floor(+(inp || {}).value || 0);
    if (!(n > 0)) return say('اكتب عدد النقاط التي تحتاجها');
    ptsBusy = true;
    try {
      const j = await post('/api/m/pts/request', { ...me, pts: n, phone: String((S.phone || (S.acc && S.acc.p)) || '') });
      if (inp) inp.value = ''; const m = document.querySelector('#mxprm'); if (m) m.textContent = '';
      say('تم تقديم طلبك (' + nf(n) + ' نقطة = ' + nf(j.iqd) + ' دينار) إلى لوحة التحكم');
      await poll(true); refreshPtsList();
    } catch (e) { say(e.message); } finally { ptsBusy = false; }
  }
  // لو كان زر واتساب القديم مخفياً ووصل إليه أي استدعاء، يُحوَّل الطلب إلى لوحة التحكم
  if (typeof window.agyBuyPts === 'function') { const _pb = window.agyBuyPts; window.agyBuyPts = function () { if (!MX.agWa) return sendPtsReq(); return _pb.apply(this, arguments); }; }
  document.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'agpts') return;
    const m = document.querySelector('#mxprm'); if (!m) return;
    const n = Math.floor(+e.target.value || 0); m.textContent = n > 0 ? '= ' + nf(iqdOf(n)) + ' دينار (≈ ' + usdOf(iqdOf(n)) + ')' : '';
  });

  /* ---------- صورة المتجر (مستقلة عن الصورة الشخصية) ---------- */
  async function shopImgSet(image) {
    const me = id(); if (!me) return say('سجّل الدخول أولاً');
    try {
      await post('/api/m/shop-img', { ...me, image });
      say(image ? 'تم حفظ صورة المتجر' : 'تم حذف صورة المتجر'); await poll(true);
    } catch (e) { say(e.message); }
  }
  window.addEventListener('change', async (ev) => {
    const t = ev.target; if (!t || (t.id !== 'mxsi' && t.id !== 'mxai')) return;
    const f = t.files && t.files[0]; if (!f) return;
    try {
      const image = await shrink(f, 480, 0.82);
      if (t.id === 'mxsi') { await shopImgSet(image); return; }
      applyImg = image;
      const p = document.querySelector('#mxaip'); if (p) { p.innerHTML = ''; p.style.background = `url('${image}') center/cover`; }
    } catch (e) { say('تعذر قراءة الصورة'); }
  }, true);

  /* ---------- النقرات ---------- */
  window.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, v = t.dataset.v;
    if (a === 'ag') { setTimeout(() => agentPublic(t.dataset.i), 80); return; }
    if (a === 'rcopy') { setTimeout(inviteDlg, 120); return; } // النسخ الأصلي يعمل ثم تظهر الكليشة
    if (a === 'addm' || a === 'adm2') { ev.stopImmediatePropagation(); ev.preventDefault(); applyDlg(); return; }
    if (a === 'pay') { ev.stopImmediatePropagation(); ev.preventDefault(); payDlg(); return; }
    if (a === 'mxapply') { ev.stopImmediatePropagation(); ev.preventDefault(); applyMerchant(); return; }
    if (!/^mx/.test(a)) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (a === 'mxo') openMerchant(v);
    else if (a === 'mxpay') payMerchant(v);
    else if (a === 'mxpay2') payMerchant(sel, (document.querySelector('#mxpp') || {}).value);
    else if (a === 'mxddt') payToggle();
    else if (a === 'mxddp') payPick(v);
    else if (a === 'mxchip') payChip(v);
    else if (a === 'mxagbuy') sendAgentBuy();
    else if (a === 'mxptsreq') sendPtsReq();
    else if (a === 'mxsave') saveShop();
    else if (a === 'mxsirm') shopImgSet('');
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
      if (S.r === 'agdash') { const ob = app.querySelector('[data-ag="buy"]'); if (ob) ob.outerHTML = '<button class="btn" data-a="mxagbuy">تقديم طلب للإدارة</button>' + agReqList(); } // احتياط لو لم يُغلَّف V.agdash
      if (S.r === 'agdash' && S.acc && myAg() && !app.querySelector('#mxag')) { const h = app.querySelector('.hd'); h && h.insertAdjacentHTML('afterend', agCard()); }
      if (S.r === 'profile') { const b = app.querySelector('button[data-a="rcopy"]'); if (b && !app.querySelector('[data-a="mxshare"]')) b.insertAdjacentHTML('afterend', shareRow()); }
      if ((S.r === 'users' || S.r === 'refer') && S.acc && !app.querySelector('[data-a="mxinv"]')) { const h = app.querySelector('.hd'); h && h.insertAdjacentHTML('afterend', shareCard); }
    } catch (e) {}
  };

  /* ---------- مزامنة كل 5 ثوانٍ ---------- */
  const applied = new Set(JSON.parse(localStorage.getItem('mxapplied') || '[]'));
  async function mirrorRequests() { return false; } // الطلب يُرسل الآن مباشرة من نافذة الإضافة
  /* وكيل معتمد: تثبيت الصف في قائمة الوكلاء محلياً فور ظهوره على السيرفر، فيختفي «طلب وكالة» وتظهر «لوحة الوكيل» */
  function syncAgent(j) {
    try {
      if (!S.acc || !j.agent) return;
      const el = S.acc.e.toLowerCase(), i = AG.findIndex((o) => o && !o[6] && String(o[8] || '').toLowerCase() === el);
      let ch = false;
      if (i < 0) { AG.push(j.agent.slice()); LSset('agents', AG); ch = true; }
      if (j.agentCode) { const m = Object.assign({}, AGC()); if (String(m[j.agent[0]]) !== j.agentCode) { m[j.agent[0]] = j.agentCode; window._ragx = m; try { localStorage.setItem('agxc', JSON.stringify(m)); } catch (e) {} ch = true; } }
      for (const x of RQ()) if (x.t === 'طلب وكالة' && String(x.e).toLowerCase() === el && !x.s) { const l = RQ(), o = l.find((y) => y.id === x.id); if (o) { o.s = 1; LSset('rq', l); ch = true; } }
      if (ch) { try { agyPop(); } catch (e) {} if (!typing() && ['agents', 'home', 'agdash'].includes(S.r)) draw(); }
    } catch (e) {}
  }
  let busy = false;
  async function poll(force) {
    const me = id(); if (!me || busy || (document.hidden && !force)) return; busy = true;
    try {
      let j = await post('/api/m/state', me);
      MX.me = j.me;
      if (await mirrorRequests()) j = await post('/api/m/state', me);
      const sig = JSON.stringify([j.merchants, j.me, j.av, j.abuys, j.mpLimit, j.agWa, j.preqs]);
      MX.mpLimit = Number(j.mpLimit) >= 0 ? Number(j.mpLimit) : 1000000; MX.mpUsed = Number(j.mpUsed) || 0; MX.abuys = j.abuys || [];
      MX.agWa = !!j.agWa; MX.preqs = j.preqs || []; try { refreshPtsList(); } catch (e) {}
      MX.merchants = j.merchants; MX.me = j.me; MX.av = j.av || {}; MX.agents = j.agents || {};
      const mine = myAv(); if (mine && S.av !== mine) { S.av = mine; }
      if (j.me && j.me.status === 'active') for (const x of RQ()) if (x.t === 'انضمام تاجر' && x.e === S.acc.e && !x.s) { const l = RQ(); const o = l.find((y) => y.id === x.id); if (o) { o.s = 1; LSset('rq', l); } }
      syncAgent(j);
      merchantPop();
      if (sig !== MX.sig) { MX.sig = sig; if (!typing() && ['merchants', 'mxdash', 'profile', 'home', 'agents', 'agdash'].includes(S.r)) draw(); else bar(); }
    } catch (e) {} finally { busy = false; }
  }
  window.mxPoll = poll;
  setInterval(poll, 5000); setTimeout(poll, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
})();

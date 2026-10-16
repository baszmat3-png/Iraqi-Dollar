/* المرحلة 10 — شاشة «التحويلات» بتصميم جديد + قسم «دولار إلى نقاط» (يعرض رصيدك بالدولار وما يعادله بالنقاط) */
(function () {
  if (typeof S === 'undefined' || typeof V === 'undefined') return;
  const nf = (n) => Math.floor(+n || 0).toLocaleString('en-US');
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const usd2 = (n) => '$' + (+n || 0).toFixed(2);
  const rd = (n) => Math.round(+n || 0).toLocaleString('en-US');
  const rate = () => (+CFG.usdRate > 0 ? +CFG.usdRate : 1620); // نقطة لكل 1$ (نفس سعر «إلى دولار»)
  const q = (s) => document.querySelector(s);
  const A = { fr: '#a78bfa', gm: '#f0628c', us: '#34d399', up: '#f5b82e' };

  try {
    const st = document.createElement('style');
    st.textContent = `
.xf{--xb:#1b2938;--xb2:#172330;--xl:#264a5d}
.xf-hero{position:relative;overflow:hidden;border-radius:28px;padding:18px 16px 14px;margin-bottom:14px;color:#fff;background:linear-gradient(135deg,#0e8aa3 0%,#0b5f7e 55%,#0a3d5f 100%);border:1.5px solid #1fb5d0;box-shadow:0 10px 36px #22d3ee22}
.xf-hero:before{content:"";position:absolute;inset-inline-start:-40px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,#ffffff24,transparent 70%);pointer-events:none}
.xf-hero .t{color:#c9eff6;font-size:.95rem;position:relative}
.xf-hero .v{font-size:2.1rem;font-weight:800;line-height:1.3;margin:2px 0 12px;position:relative}.xf-hero .v small{font-size:.95rem;font-weight:600;color:#bfe9f1;margin-inline-start:6px}
.xf-bal{display:grid;grid-template-columns:1.25fr 1fr;gap:10px;position:relative}
.xf-bal>div{background:#06304a80;border:1px solid #ffffff1a;border-radius:18px;padding:9px 12px;min-width:0}
.xf-bal small{display:block;color:#bfe3ec;font-size:.78rem}.xf-bal b{display:block;font-size:1.05rem;white-space:nowrap}.xf-bal em{display:block;font-style:normal;color:#ffe29a;font-size:.74rem;margin-top:1px}
.xf-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.xf-m{position:relative;display:flex;align-items:center;gap:10px;font:inherit;color:inherit;text-align:start;cursor:pointer;background:linear-gradient(180deg,var(--xb),var(--xb2));border:1.5px solid var(--xl);border-top:4px solid var(--ac);border-radius:22px;padding:11px 12px;min-width:0;transition:background .2s,border-color .2s}
.xf-m .ci{width:38px!important;height:38px!important;background:color-mix(in srgb,var(--ac) 18%,#0b141c)!important;color:var(--ac)!important;flex:none}
.xf-m b{display:block;font-size:.95rem;line-height:1.35}.xf-m small{display:block;color:var(--mu);font-size:.74rem;line-height:1.35}
.xf-m.on{background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 24%,#1b2938),color-mix(in srgb,var(--ac) 10%,#172330));border-color:var(--ac)}
.xf-m i{position:absolute;top:-9px;inset-inline-end:12px;font-style:normal;font-size:.68rem;font-weight:800;background:var(--ac);color:#241a00;border-radius:99px;padding:1px 9px}
.xf-p{background:linear-gradient(180deg,var(--xb),var(--xb2));border:1.5px solid var(--xl);border-top:4px solid var(--ac);border-radius:26px;padding:16px}
.xf-flow{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.xf-chip{flex:1;display:flex;align-items:center;gap:8px;background:#0e1923;border:1px solid var(--xl);border-radius:16px;padding:8px 10px;min-width:0}
.xf-chip .ci{width:32px!important;height:32px!important;flex:none}.xf-chip small{display:block;color:var(--mu);font-size:.72rem;line-height:1.2}.xf-chip b{display:block;font-size:.92rem;line-height:1.3}
.xf-ar{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--ac);color:#10161d}.xf-ar svg{width:18px;height:18px}
.xf-l{display:block;color:var(--mu);font-size:.9rem;margin-top:8px}
.xf-in{display:flex;align-items:center;gap:8px;background:#0b141c;border:1.5px solid var(--line);border-radius:18px;padding:0 14px;margin:6px 0}
.xf-in:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 22%,transparent)}
.xf-in input{outline:0!important;-moz-appearance:textfield;border:0!important;background:none!important;margin:0!important;padding:12px 0!important;font-size:1.35rem;font-weight:700;box-shadow:none!important;min-width:0}
.xf-in input::-webkit-inner-spin-button,.xf-in input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.xf-in span{color:var(--ac);font-weight:800;font-size:1.05rem;flex:none}
.xf-ch{display:flex;gap:8px;margin:8px 0 4px}.xf-ch button{flex:1;font:inherit;font-weight:700;font-size:.88rem;color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,#0b141c);border:1.5px solid color-mix(in srgb,var(--ac) 40%,#0b141c);border-radius:14px;padding:7px 4px;cursor:pointer}
.xf-ch button:active{transform:scale(.96)}
.xf-rc{background:#0e1923;border:1.5px dashed var(--xl);border-radius:20px;padding:6px 14px;margin:12px 0}
.xf-rc>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d}.xf-rc>div:last-child{border:0}
.xf-rc span{color:var(--mu);font-size:.9rem}.xf-rc b{font-size:1rem}.xf-rc .big b{font-size:1.45rem;color:var(--ac)}.xf-rc .bad b{color:#ff7a75}
.xf-go{background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 75%,#000),var(--ac))!important;color:#10161d!important;padding:16px!important;font-size:1.05rem;box-shadow:0 8px 24px color-mix(in srgb,var(--ac) 30%,transparent)!important}
.xf-go[disabled]{opacity:.5;box-shadow:none!important}
.xf-note{display:flex;gap:8px;align-items:flex-start;color:var(--mu);font-size:.82rem;line-height:1.6;margin:10px 2px 0}.xf-note svg{flex:none;margin-top:4px;color:var(--ac)}
.xf-conv{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:8px;margin-bottom:10px}
.xf-sd{border-radius:22px;padding:12px;min-width:0;border:1.5px solid color-mix(in srgb,var(--c) 55%,#0b141c);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 22%,#14202c),#101a24)}
.xf-sd small{display:block;color:#b4c2cf;font-size:.78rem}.xf-sd b{display:block;font-size:1.45rem;line-height:1.35;color:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xf-sd em{font-style:normal;font-size:.76rem;color:var(--mu)}
.xf-mid{display:grid;place-items:center}.xf-mid span{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--ac);color:#10161d;box-shadow:0 0 0 5px #f5b82e22}.xf-mid svg{width:20px;height:20px}
.xf-rate{display:flex;justify-content:center;gap:6px;align-items:center;background:color-mix(in srgb,var(--ac) 10%,#0b141c);border:1px solid color-mix(in srgb,var(--ac) 35%,#0b141c);color:#ffe29a;border-radius:99px;padding:6px 14px;font-size:.86rem;margin:0 auto 6px;width:fit-content;max-width:100%}
.xf-ok{text-align:center}.xf-ok .ck{width:68px;height:68px;border-radius:50%;margin:4px auto 10px;display:grid;place-items:center;background:#34d39922;color:#34d399;border:2px solid #34d399}.xf-ok .ck svg{width:34px;height:34px}
.xf-ok h2{margin:0 0 4px}.xf-ok .pt{font-size:2rem;font-weight:800;color:#f5b82e;margin:6px 0}
@media(max-width:360px){.xf-m small{display:none}.xf-sd b{font-size:1.2rem}}`;
    document.head.appendChild(st);
  } catch (e) {}

  const modes = () => [['friend', 'لصديق', 'user', A.fr, 'إرسال نقاط لعضو'], ['gem', 'إلى جواهر', 'gem', A.gm, 'تحويل النقاط لجواهر'], ['usd', 'إلى دولار', 'cur', A.us, 'النقاط إلى رصيد دولار'], ['u2p', 'دولار إلى نقاط', 'coin', A.up, 'الدولار إلى رصيد نقاط']]
    .filter((x) => !(x[0] === 'friend' && CFG.hft));

  const ptsFromUsd = (d) => Math.floor((+d || 0) * rate() + 1e-9);
  const hero = () => `<div class="xf-hero"><div class="t">رصيدك الحالي</div><div class="v">${nf(S.pts)}<small>نقطة</small></div>
<div class="xf-bal"><div><small>الرصيد بالدولار</small><b>${usd2(S.usd)}</b><em>يعادل ${nf(ptsFromUsd(S.usd))} نقطة</em></div><div><small>الجواهر</small><b>${nf(S.gems)}</b></div></div></div>`;

  const modeBtn = (m) => `<button class="xf-m ${S.ft === m[0] ? 'on' : ''}" style="--ac:${m[3]}" data-a="ft" data-v="${m[0]}">${m[0] === 'u2p' ? '<i>جديد</i>' : ''}<span class="ci">${ic(m[2], 20)}</span><span class="sp"><b>${m[1]}</b><small>${m[4]}</small></span></button>`;
  const chip = (icn, t, b) => `<div class="xf-chip"><span class="ci">${ic(icn, 16)}</span><span class="sp"><small>${t}</small><b>${b}</b></span></div>`;
  const arrow = `<span class="xf-ar">${ic('back')}</span>`;
  const chips = (act) => `<div class="xf-ch">${[['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', 'الكل']].map((c) => `<button type="button" data-a="xchip" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>`;
  const note = (t) => `<div class="xf-note">${ic('info', 16)}<span>${t}</span></div>`;

  function panelPts(m) {
    const k = m[0], to = k === 'friend' ? ['user', 'الوجهة', 'صديق'] : k === 'gem' ? ['gem', 'ستحصل على', 'جواهر'] : ['cur', 'ستحصل على', 'دولار'];
    const hint = k === 'gem' ? CFG.gemRate + ' نقطة = 1 جوهرة' : k === 'usd' ? rd(rate()) + ' نقطة = 1$' : 'رسوم التحويل ' + CFG.fee + '%' + (CFG.ftmax > 0 ? ' · الحد الأقصى ' + nf(CFG.ftmax) + ' نقطة للعملية' : '');
    return `<div class="xf-p" style="--ac:${m[3]}"><div class="xf-flow">${chip('coin', 'من', 'نقاطك')}${arrow}${chip(to[0], to[1], to[2])}</div>
${k === 'friend' ? '<label class="xf-l">اسم الصديق<input id="fn" placeholder="اكتب اسم الصديق..." autocomplete="off"></label>' : ''}
<label class="xf-l">عدد النقاط · <span style="color:${m[3]}">${hint}</span></label>
<div class="xf-in"><input id="fa" type="number" inputmode="numeric" min="1" placeholder="0" autocomplete="off"><span>نقطة</span></div>${chips()}
<div class="xf-rc" id="xfp"></div>
<button class="btn xf-go" data-a="tr">تأكيد التحويل</button></div>`;
  }

  const rcRow = (l, v, cls) => `<div class="${cls || ''}"><span>${l}</span><b>${v}</b></div>`;
  function prevPts() {
    const n = Math.max(0, Math.floor(+(q('#fa') || {}).value || 0)), k = S.ft, fee = k === 'friend' ? Math.ceil(n * CFG.fee / 100) : 0, after = S.pts - n - fee;
    let r = '';
    if (k === 'friend') r = rcRow('المبلغ المرسل', nf(n) + ' نقطة') + rcRow('رسوم التحويل (' + CFG.fee + '%)', nf(fee) + ' نقطة') + rcRow('المجموع المخصوم', nf(n + fee) + ' نقطة', 'big');
    else if (k === 'gem') r = rcRow('ستحصل على', nf(n / CFG.gemRate) + ' جوهرة', 'big') + rcRow('ما يقابلها بالدولار', usd2(n / rate()));
    else r = rcRow('ستحصل على', usd2(n / rate()), 'big') + rcRow('المخصوم من نقاطك', nf(n) + ' نقطة');
    return r + rcRow('رصيد نقاطك بعد التحويل', after < 0 ? 'غير كافٍ' : nf(after) + ' نقطة', after < 0 ? 'bad' : '');
  }

  /* ---------- دولار → نقاط ---------- */
  function calc(v) {
    const have = +S.usd || 0, maxC = Math.floor(have * 100 + 1e-9) / 100, shown = Math.round((+v || 0) * 100) / 100;
    if (!(shown > 0)) return { shown: 0, use: 0, pts: 0, ok: false, max: maxC };
    const all = shown >= maxC - 1e-9, use = all ? have : shown; // «الكل» يشمل كسور السنت الباقية
    return { shown, use, pts: ptsFromUsd(use), ok: shown <= maxC + 1e-9 && use > 0, max: maxC };
  }
  function panelU2P(m) {
    const have = +S.usd || 0;
    return `<div class="xf-p" style="--ac:${m[3]}"><div class="xf-conv"><div class="xf-sd" style="--c:${A.us}"><small>رصيدك بالدولار</small><b>${usd2(have)}</b><em>دولار أمريكي</em></div>
<div class="xf-mid"><span>${ic('swap')}</span></div><div class="xf-sd" style="--c:${A.up}"><small>ما يعادله بالنقاط</small><b>${nf(ptsFromUsd(have))}</b><em>نقطة</em></div></div>
<div class="xf-rate">سعر الصرف: 1$ ≈ ${rd(rate())} نقطة</div>
<label class="xf-l">المبلغ المراد تحويله بالدولار</label>
<div class="xf-in"><span>$</span><input id="xu" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" autocomplete="off" ${have <= 0 ? 'disabled' : ''}></div>${chips()}
<div class="xf-rc" id="xfp"></div>
<button class="btn xf-go" id="xfgo" data-a="xu2p" ${have <= 0 ? 'disabled' : ''}>${have <= 0 ? 'لا يوجد رصيد دولار للتحويل' : 'تحويل إلى نقاط'}</button>
${note('التحويل فوري وبنفس سعر «إلى دولار»، فلا تخسر شيئاً عند التحويل بين النقاط والدولار.')}</div>`;
  }
  function prevU2P() {
    const r = calc((q('#xu') || {}).value), over = (+(q('#xu') || {}).value || 0) > r.max + 1e-9;
    const go = q('#xfgo'); if (go && (+S.usd || 0) > 0) go.disabled = !r.ok || r.pts < 1;
    return rcRow('ستحصل على', nf(r.pts) + ' نقطة', 'big') + rcRow('المخصوم من رصيدك', usd2(r.use)) + rcRow('رصيدك بالدولار بعد', over ? 'غير كافٍ' : usd2(Math.max(0, (+S.usd || 0) - r.use)), over ? 'bad' : '') + rcRow('رصيدك بالنقاط بعد', nf(S.pts + r.pts) + ' نقطة');
  }
  function prev() { const p = q('#xfp'); if (!p) return; p.innerHTML = S.ft === 'u2p' ? prevU2P() : prevPts(); }

  V.transfer = () => {
    const L = modes(); if (!L.some((x) => x[0] === S.ft)) S.ft = L[0][0];
    const m = L.find((x) => x[0] === S.ft);
    setTimeout(prev, 0);
    return hd('التحويلات', 'swap', { back: 'home' }) + `<div class="xf">${hero()}<div class="xf-modes">${L.map(modeBtn).join('')}</div>${S.ft === 'u2p' ? panelU2P(m) : panelPts(m)}</div>`;
  };

  let busy = false;
  function doU2P() {
    if (busy) return;
    if (!S.acc) return say('سجّل الدخول أولاً');
    const r = calc((q('#xu') || {}).value);
    if (!(r.shown > 0)) return say('أدخل المبلغ بالدولار');
    if (!r.ok) return say('رصيدك بالدولار غير كافٍ');
    if (r.pts < 1) return say('المبلغ صغير، أقل من نقطة واحدة');
    busy = true;
    try {
      lrs('تحويل دولار إلى نقاط', usd2(r.use) + ' × ' + rd(rate()) + ' = ' + nf(r.pts) + ' نقطة');
      S.usd = Math.max(0, +((+S.usd || 0) - r.use).toFixed(6));
      S.pts += r.pts;
      try { txlog('تحويل دولار إلى نقاط', r.pts, 'in'); } catch (e) {}
      try { save(); } catch (e) {}
      draw();
      dlg(`<div class="xf-ok"><div class="ck">${ic('chk')}</div><h2>تم التحويل بنجاح</h2><div class="mu">حوّلت ${usd2(r.use)} إلى نقاط</div><div class="pt">+${nf(r.pts)} نقطة</div>
<div class="card" style="margin:10px 0;text-align:start"><div class="row2"><span class="mu">رصيدك بالدولار الآن</span><b>${usd2(S.usd)}</b></div><div class="row2" style="margin-top:6px"><span class="mu">رصيدك بالنقاط الآن</span><b class="cy">${nf(S.pts)}</b></div></div>
<button class="btn" onclick="d.close()">تم</button></div>`);
    } finally { busy = false; }
  }

  function setChip(p) {
    const k = S.ft, p1 = (+p || 0) / 100;
    if (k === 'u2p') {
      const i = q('#xu'); if (!i) return;
      const have = +S.usd || 0, mx = Math.floor(have * 100 + 1e-9) / 100;
      i.value = p1 >= 1 ? mx.toFixed(2) : (Math.floor(have * p1 * 100) / 100).toFixed(2);
    } else {
      const i = q('#fa'); if (!i) return;
      const base = k === 'friend' ? Math.floor(S.pts / (1 + CFG.fee / 100)) : Math.floor(S.pts);
      i.value = Math.max(0, p1 >= 1 ? base : Math.floor(base * p1));
    }
    prev();
  }

  window.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a;
    if (a === 'xu2p') { ev.stopImmediatePropagation(); ev.preventDefault(); doU2P(); }
    else if (a === 'xchip') { ev.stopImmediatePropagation(); ev.preventDefault(); setChip(t.dataset.v); }
  }, true);
  document.addEventListener('input', (ev) => { const i = ev.target && ev.target.id; if (i === 'fa' || i === 'xu') prev(); });
})();

/* متجر العدادات — الواجهة (كل العمليات على السيرفر: عرض/إلغاء/شراء، خصم وإضافة النقاط، رسوم 8%) */
(function () {
  if (window.CM) return;
  const CM = window.CM = { list: [], my: [], mk: 20, fee: 8, ok: 0, busy: 0 };
  const dayEx = '<span class="mu" style="font-size:.78rem">';
  const hdr = () => { const a = S.acc; return a && a.e && a.h ? { 'x-e': encodeURIComponent(a.e), 'x-h': a.h, 'Content-Type': 'application/json' } : null; };
  const nm = (i) => (CT[i] ? CT[i][0] : 'عداد');
  const rows = (a) => `<div class="card" style="padding:12px">${a.map((r) => `<div class="row2" style="padding:4px 0;gap:10px"><span class="mu">${r[0]}</span><b style="text-align:end">${r[1]}</b></div>`).join('')}</div>`;
  const em = (t) => `<div class="card mu" style="text-align:center">${t}</div>`;
  const redraw = () => { try { if (S.r === 'cmarket') { const dd = document.getElementById('d'); if (!(dd && dd.open)) draw(); } } catch (x) {} };
  const adopt = (cl) => { try { if (window.__csyncReconcile && S.acc && Array.isArray(cl)) window.__csyncReconcile(S.acc.e, cl, true); } catch (x) {} };
  const pull = () => { try { if (window.__balPull) window.__balPull(); } catch (x) {} };

  CM.load = async function () {
    const h = hdr(); if (CM.busy) return; CM.busy = 1;
    try {
      const r = await fetch('/api/ctr/market', { cache: 'no-store', headers: h || {} });
      const j = await r.json();
      if (j && j.ok) { CM.list = j.list || []; CM.my = j.my || []; CM.mk = j.mkPct; CM.fee = j.feePct; CM.ok = 1; }
    } catch (x) {}
    CM.busy = 0; redraw();
  };
  async function post(path, body) {
    const h = hdr(); if (!h) { toast('سجّل الدخول أولاً'); return null; }
    try {
      const r = await fetch(path, { method: 'POST', cache: 'no-store', headers: h, body: JSON.stringify(Object.assign({ e: S.acc.e, h: S.acc.h }, body)) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { toast(j.error || j.message || 'تعذّر تنفيذ العملية'); return null; }
      return j;
    } catch (x) { toast('تحقق من الاتصال بالإنترنت'); return null; }
  }
  const dl = (l) => Math.ceil((l.e - Date.now()) / 864e5);
  const val = (i, e) => { const c = CT[i], rem = Math.max(0, Math.min(360 * 864e5, e - Date.now())), v = Math.max(1, Math.floor(c[2] * rem / (360 * 864e5))); return { v, cap: Math.floor(v * (1 + CM.mk / 100)) }; };

  CM.view = function () {
    if (!CM.ok && !CM.busy) setTimeout(CM.load, 0);
    const mkc = (L) => {
      const c = CT[L.ci], m = L.pct;
      return `<div class="card"><div class="row2"><b style="color:${c[4]}">عداد ${c[0]}</b><span class="bdg ${m > 0 ? 'no' : 'ok'}">${m > 0 ? '+' + m + '%' : m < 0 ? m + '%' : 'بسعر القيمة'}</span></div>
      <div class="mu">البائع: ${L.seller}</div>
      <div class="mu">⏳ المتبقي <b style="color:var(--cy)">${L.days}</b> يوماً من 360 · يمنح ${f(c[3])} نقطة كل 24 ساعة</div>
      <div class="row2" style="margin-top:8px"><div><b class="cy">${f(L.price)} نقطة</b><div class="mu" style="font-size:.8rem">قيمته بحسب مدته: ${f(L.valued)}</div></div><button class="btn sm" data-a="mb" data-i="${L.id}">تفاصيل وشراء</button></div></div>`;
    };
    return hd('متجر العدادات', 'gauge', { back: 'home' }) +
      `<div class="note" style="color:var(--cy);background:#0f2a33;border-color:var(--line)">${ic('info', 18)}<span>يُسعَّر العداد بحسب مدته المتبقية، ولا يُعرض بأكثر من قيمته + ${CM.mk}%. رسوم العرض ${CM.fee}% تُدفع بالنقاط. يستلم المشتري العداد بمدته المتبقية نفسها.</span></div>
      <div class="seg">${[['mk', 'السوق'], ['my', 'عدادي للبيع']].map((x) => `<button class="${S.mt == x[0] ? 'on' : ''}" data-a="mtab" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>` +
      (S.mt == 'mk' ? (CM.list.length ? CM.list.map(mkc).join('') : em(CM.ok ? 'لا توجد عروض الآن' : 'جارٍ التحميل...'))
        : sec('عدادات يمكنك عرضها') + (S.cl.length ? S.cl.map((l, j) => { const c = CT[l.i]; return `<div class="card row2" style="padding:12px 16px"><div><b style="color:${c[4]}">عداد ${c[0]}</b><div class="mu">⏳ المتبقي ${dl(l)} يوماً · ربح متبقٍّ ≈ ${f(c[3] * dl(l))} نقطة</div></div><button class="btn sm" data-a="sl" data-i="${j}">عرض للبيع</button></div>`; }).join('') : em('لا تملك عدادات'))
        + sec('عروضي') + (CM.my.length ? CM.my.map((L) => { const c = CT[L.ci]; return `<div class="card row2" style="padding:12px 16px"><div><b style="color:${c[4]}">عداد ${c[0]}</b><div class="mu">⏳ المتبقي ${L.days} يوماً</div><div class="cy">${f(L.price)} نقطة</div></div><button class="btn o sm" data-a="slx" data-i="${L.id}">إلغاء العرض</button></div>`; }).join('') : em('لا توجد عروض')));
  };

  CM.sl = function (i) {
    const l = S.cl[+i]; if (!l) return; const c = CT[l.i], x = val(l.i, l.e), d = dl(l);
    return dlg(`<h2 style="margin-top:0">عرض عداد ${c[0]} للبيع</h2>${rows([
      ['المدة المتبقية', d + ' يوماً (سيستلمه المشتري بالمدة نفسها)'], ['سعر العداد الأصلي', f(c[2]) + ' نقطة'], ['قيمته بحسب مدته', f(x.v) + ' نقطة'],
      ['الحد الأقصى (+' + CM.mk + '%)', f(x.cap) + ' نقطة'], ['رسوم العرض', CM.fee + '% من سعر العرض (بالنقاط)']])}
      <label>سعر العرض بالنقاط<input id="slp" type="number" inputmode="numeric" value="${x.v}" oninput="CM.fe()"></label>
      <div class="mu" id="slf" style="margin:6px 0"></div><button class="btn" data-a="slc" data-i="${i}">عرض للبيع</button>`);
    // eslint-disable-line
  };
  CM.fe = function () { const q = Math.round(+document.getElementById('slp').value) || 0, fe = Math.ceil(q * CM.fee / 100); const el = document.getElementById('slf'); if (el) el.textContent = 'رسوم العرض: ' + f(fe) + ' نقطة · صافي ما تستلمه عند البيع: ' + f(q) + ' نقطة'; };
  CM.slc = async function (i) {
    const l = S.cl[+i]; if (!l) return; const q = Math.round(+document.getElementById('slp').value);
    if (!q || q < 1) return toast('أدخل سعراً صحيحاً');
    const x = val(l.i, l.e); if (q > x.cap) return toast('لا يمكن العرض بأكثر من ' + f(x.cap) + ' نقطة');
    const fe = Math.ceil(q * CM.fee / 100); if (S.pts < fe) return toast('رصيدك لا يكفي لرسوم العرض: ' + f(fe) + ' نقطة');
    document.getElementById('d').close();
    const j = await post('/api/ctr/list', { ci: l.i, exp: l.e, price: q });
    if (j) { adopt(j.cl); pull(); toast('تم عرض العداد للبيع · خُصمت رسوم ' + f(j.fee) + ' نقطة'); S.mt = 'my'; CM.load(); }
  };
  CM.slx = async function (id) { const j = await post('/api/ctr/cancel', { id: +id }); if (j) { adopt(j.cl); toast('تم إلغاء العرض وعاد العداد إليك'); CM.load(); } };
  CM.mb = function (id) {
    const L = CM.list.find((x) => x.id == id); if (!L) return; const c = CT[L.ci], tot = c[3] * L.days, net = tot - L.price;
    return dlg(`<h2 style="margin-top:0">شراء عداد ${c[0]}</h2>${S.pts < L.price ? `<div class="note" style="color:#ef5350;background:#3a2025;border-color:#7a3a3a">${ic('warn', 18)}<span>رصيدك غير كافٍ، ينقصك ${f(L.price - S.pts)} نقطة</span></div>` : ''}${rows([
      ['السعر', f(L.price) + ' نقطة'], ['البائع', L.seller], ['المدة المتبقية', L.days + ' يوماً من 360 (ينتهي تلقائياً)'],
      ['الربح اليومي', f(c[3]) + ' نقطة'], ['إجمالي الربح المتوقع', f(tot) + ' نقطة'], ['صافي الربح بعد الشراء', (net >= 0 ? '+' : '') + f(net) + ' نقطة'],
      ['سعر العداد الأصلي', f(c[2]) + ' نقطة'], ['قيمته بحسب مدته', f(L.valued) + ' نقطة'], ['رصيدك الحالي', f(S.pts) + ' نقطة']])}
      <div class="mu" style="margin:6px 0">تُخصم النقاط من رصيدك وتُضاف للبائع، ويصلك العداد فوراً بمدته المتبقية.</div><button class="btn" data-a="mbc" data-i="${id}">تأكيد الشراء</button>`);
  };
  CM.mbc = async function (id) {
    document.getElementById('d').close();
    const j = await post('/api/ctr/buy', { id: +id });
    if (j) { adopt(j.cl); pull(); toast('تم شراء العداد — متبقٍّ له ' + j.days + ' يوماً'); S.mt = 'mk'; CM.load(); }
    else CM.load();
  };
})();
setInterval(function () { try { if (window.CM && S.r === 'cmarket' && document.visibilityState !== 'hidden') CM.load(); } catch (x) {} }, 8000);

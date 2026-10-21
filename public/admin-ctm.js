/* لوحة الإدارة — «المتجر البيع»: إحصائيات العمولات، العروض المفتوحة، التحكم بنسب العمولة والإلغاء */
(function () {
  if (window.CTMA) return;
  const C = window.CTMA = { ok: 0, busy: 0, d: null, t: 0 };
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const F = (n) => Number(n || 0).toLocaleString('en');
  const D = (v) => { try { return new Date(v).toLocaleString('ar-IQ'); } catch (x) { return ''; } };
  const nm = (i) => { try { return CT[i][0]; } catch (x) { return 'عداد ' + i; } };
  C.load = async function () {
    if (C.busy) return; C.busy = 1;
    const j = await ctlApi('/ctr-market', 'GET');
    if (j) { C.d = j; C.ok = 1; C.t = Date.now(); }
    C.busy = 0; const b = document.getElementById('ctm-box'); if (b) b.innerHTML = C.inner();
  };
  C.inner = function () {
    const d = C.d; if (!d) return '<div class="c mu" style="text-align:center;padding:22px">جارٍ التحميل...</div>';
    const by = {}; (d.stats || []).forEach((s) => { by[s.status] = s; });
    const rv = {}; (d.revenue || []).forEach((r) => { rv[r.kind] = Number(r.pts); });
    const fees = (rv.ctr_list_fee || 0) + (rv.ctr_cancel_refund || 0);
    const sold = by.sold || { n: 0, vol: 0 }, can = by.cancelled || { n: 0 }, op = d.open || [];
    const kpi = (t, v) => `<div class="c kp"><div class="rw"><small>${t}</small></div><b>${v}</b></div>`;
    const rows = op.map((L) => `<tr><td>${E(L.seller || '')}<div class="mu" dir="ltr" style="font-size:.7rem">${E(L.email)}</div></td><td>${E(nm(L.ci))}</td><td>${L.days} يوماً</td><td>${F(L.price)}<div class="mu" style="font-size:.7rem">عُرض بـ ${F(L.listed)}</div></td><td>${F(L.valued)}</td><td>${F(L.fee)}</td><td>${D(L.at)}</td><td><button class="btn" style="color:#ff6b6b" data-a="p_ctmcan" data-v="${L.id}">إلغاء</button></td></tr>`);
    const rec = (d.recent || []).map((L) => `<tr><td>${E(L.seller_name || L.seller_email)}</td><td>${E(nm(L.ci))}</td><td>${F(L.price)}</td><td>${F(L.fee)}</td><td>${L.status === 'sold' ? 'بيع' : 'أُلغي'}</td><td>${L.buyer_email ? E(L.buyer_email) : '-'}</td><td>${D(L.closed_at || L.created_at)}</td></tr>`);
    const tb = (h, r, e) => `<div class="tw"><table><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr>${r.join('') || `<tr><td colspan="${h.length}" class="mu">${e}</td></tr>`}</table></div>`;
    return `<div class="gd k" style="margin-bottom:12px">${kpi('أرباح العمولات (صافي)', F(fees) + ' نقطة')}${kpi('عروض مفتوحة', F(op.length))}${kpi('عدادات بيعت', F(sold.n))}${kpi('حجم المبيعات', F(sold.vol) + ' نقطة')}${kpi('عروض أُلغيت', F(can.n))}</div>
<div class="c" style="margin-bottom:12px"><h3>⚙️ نسب المتجر</h3>
<div class="row2" style="gap:8px;flex-wrap:wrap">
<label style="flex:1;min-width:130px">عمولة العرض %<input id="ctm_fee" type="number" min="0" max="50" step="0.5" value="${d.cfg.fee}" style="width:100%"></label>
<label style="flex:1;min-width:130px">يُستبقى عند الإلغاء % (من السعر)<input id="ctm_cx" type="number" min="0" max="50" step="0.5" value="${d.cfg.cx}" style="width:100%"></label>
<label style="flex:1;min-width:130px">أعلى سعر فوق القيمة %<input id="ctm_mk" type="number" min="0" max="100" step="1" value="${d.cfg.mk}" style="width:100%"></label></div>
<div class="mu" style="font-size:.78rem;margin:6px 0">العمولة تُخصم عند العرض. عند إلغاء البائع يُستبقى نسبة الإلغاء من السعر ويُردّ له باقي العمولة. تسري على العروض الجديدة فوراً.</div>
<button class="btn" data-a="p_ctmsave">حفظ</button></div>
<h4 style="margin:10px 0 4px">📦 العروض المفتوحة (${op.length})</h4>${tb(['البائع', 'العداد', 'المتبقي', 'السعر الحالي', 'القيمة', 'العمولة', 'وقت العرض', ''], rows, 'لا توجد عروض')}
<h4 style="margin:14px 0 4px">🧾 آخر العمليات</h4>${tb(['البائع', 'العداد', 'السعر', 'العمولة', 'الحالة', 'المشتري', 'الوقت'], rec, 'لا توجد عمليات')}`;
  };
  C.html = function () {
    if (!C.ok || Date.now() - C.t > 15000) setTimeout(C.load, 0);
    return `<div id="ctm-box">${C.inner()}</div>`;
  };
  C.act = function (a, v) {
    if (a === 'ctmsave') {
      const g = (id) => +(document.getElementById(id) || {}).value;
      ctlApi('/ctr-market/settings', 'POST', { fee: g('ctm_fee'), cx: g('ctm_cx'), mk: g('ctm_mk') }).then((j) => { if (j) { toast('تم حفظ نسب المتجر'); C.load(); } });
      return 1;
    }
    if (a === 'ctmcan') {
      if (!confirm('إلغاء هذا العرض؟ يعود العداد لصاحبه وتُردّ له كامل عمولة العرض.')) return 1;
      ctlApi('/ctr-market/cancel', 'POST', { id: +v }).then((j) => { if (j) { toast('تم إلغاء العرض'); C.load(); } });
      return 1;
    }
    return 0;
  };
})();

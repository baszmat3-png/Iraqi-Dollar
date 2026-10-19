/* لوحة التحكم — إدارة P2P: تدقيق التحويلات، البائعون والمستويات، التقييمات، الإعلانات، الإعدادات (طبقة مستقلة) */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NF = (n) => Math.floor(Number(n) || 0).toLocaleString('en');
  const N2 = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString('en', { maximumFractionDigits: 2 });
  const dtf = (t) => t ? new Date(t).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const $ = (s, r) => (r || document).querySelector(s);
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  async function api(path, body) {
    if (!key()) throw new Error('احفظ مفتاح الإدارة أولاً (الإعدادات ← التحكم المركزي)');
    const r = await fetch('/api/ctl/p2p/' + path, { method: body ? 'POST' : 'GET', headers: { 'X-Admin-Key': key(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
    return j;
  }
  const LV = { bronze: ['برونزي', '#e0925a'], silver: ['فضي', '#d5dde5'], gold: ['ذهبي', '#ffd34d'], trusted: ['موثوق', '#2bcfe2'] };
  const ST = { awaiting_payment: 'بانتظار الدفع', proof_submitted: 'بانتظار التدقيق', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي', disputed: 'قيد التحقيق' };
  const SC = { awaiting_payment: '#ffb300', proof_submitted: '#2bcfe2', completed: '#3ad98f', rejected: '#ff7a77', cancelled: '#ff7a77', expired: '#ff7a77', disputed: '#c79bff', pending: '#ffb300', approved: '#3ad98f', suspended: '#ff7a77' };
  const SS = { pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض', suspended: 'موقوف' };
  const pill = (t, c) => `<span class="pa-p" style="color:${c};background:${c}22">${esc(t)}</span>`;
  const lvp = (k) => { const l = LV[k] || LV.bronze; return `<span class="pa-p" style="color:${l[1]};background:${l[1]}1f;border:1px solid ${l[1]}66">🛡 ${l[0]}</span>`; };

  const css = document.createElement('style');
  css.textContent = `
#pab{position:fixed;bottom:80px;inset-inline-start:16px;z-index:9998;display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#7c4dff,#b57bff);color:#fff;border:0;border-radius:99px;padding:11px 18px;font:700 .9rem Cairo,Tahoma,sans-serif;box-shadow:0 6px 22px #0007;cursor:pointer}
#pab i{background:#ef5350;color:#fff;border-radius:99px;padding:1px 8px;font-style:normal;font-size:12px}
#pao{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#e8f1f6;background:#0E1621;--ac:#b57bff;--bd:#3a3566;--cd:#1b2133;--mu:#8f9bb3}
#pao.on{display:flex}#pao *{box-sizing:border-box}
#pao .h{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 10px;border-bottom:1px solid #ffffff0d}
#pao h1{margin:0;font-size:1.25rem;flex:1}#pao .x{width:40px;height:40px;border-radius:12px;border:1.5px solid var(--bd);background:#241f46;color:var(--ac);font-size:1.2rem;cursor:pointer}
#pao .n{display:flex;gap:8px;padding:10px 12px;overflow-x:auto;border-bottom:1px solid #ffffff0d;scrollbar-width:none}
#pao .n button{flex:none;font:600 .85rem Cairo,Tahoma,sans-serif;border:1.5px solid var(--bd);background:#241f46;color:var(--ac);border-radius:99px;padding:7px 15px;cursor:pointer;display:flex;gap:6px;align-items:center}
#pao .n button.on{background:var(--ac);color:#1a0b33;border-color:var(--ac)}#pao .n button i{font-style:normal;background:#ef5350;color:#fff;border-radius:99px;font-size:.7rem;padding:0 6px}
#pam{flex:1;overflow:auto;padding:14px;max-width:1000px;width:100%;margin:0 auto}
#pao .c{background:var(--cd);border:1.5px solid var(--bd);border-radius:18px;padding:14px;margin-bottom:12px}
#pao .r{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#pao .g{flex:1;min-width:0}#pao .mu{color:var(--mu);font-size:.8rem}
#pao .b{border:0;border-radius:12px;padding:9px 16px;font:700 .85rem Cairo,Tahoma,sans-serif;cursor:pointer;background:var(--ac);color:#1a0b33}
#pao .b.o{background:none;border:1.5px solid var(--bd);color:var(--ac)}#pao .b.g2{background:#22b573;color:#fff}#pao .b.rd{background:#ef5350;color:#fff}#pao .b.pu{background:#7c4dff;color:#fff}#pao .b[disabled]{opacity:.5;pointer-events:none}
#pao input,#pao select,#pao textarea{width:100%;background:#0E1621;border:1.5px solid var(--bd);border-radius:10px;color:#fff;font:inherit;padding:9px 11px;margin-top:4px}
#pao label{display:block;font-size:.8rem;color:var(--mu);margin-top:9px}
.pa-p{display:inline-block;font-size:.72rem;font-weight:700;padding:2px 10px;border-radius:99px}
#pao .k{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px}#pao .k div{background:var(--cd);border:1.5px solid var(--bd);border-radius:14px;padding:10px;text-align:center}
#pao .k b{display:block;font-size:1.2rem}#pao .k span{font-size:.72rem;color:var(--mu)}
#pao .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:640px){#pao .two{grid-template-columns:1fr}}
#pao .pb{background:#0E1621;border:1.5px solid var(--bd);border-radius:14px;padding:12px}
#pao .pb h4{margin:0 0 8px;font-size:.95rem;color:var(--ac)}#pao .kv{display:flex;justify-content:space-between;gap:8px;font-size:.84rem;padding:3px 0;border-bottom:1px dashed #ffffff0f}#pao .kv span:first-child{color:var(--mu)}
#pao .ac{border:2px solid #3ad98f!important;background:#3ad98f12}#pao .mt{border:1px solid var(--bd);border-radius:12px;padding:8px 10px;margin-top:6px;font-size:.84rem}
#pao img.pf{width:100%;max-height:480px;object-fit:contain;background:#000;border-radius:12px;cursor:zoom-in}
#pao .msg{padding:6px 10px;border-radius:12px;margin-top:5px;font-size:.82rem;max-width:88%;white-space:pre-wrap}#pao .msg.buyer{background:#243445}#pao .msg.seller{background:#34264d;margin-inline-start:auto}#pao .msg.s{background:#ffffff0d;color:var(--mu);margin:5px auto;font-size:.74rem;text-align:center}
#pao .msg img{max-width:150px;border-radius:8px;display:block;margin-top:4px}
#pao .ck{display:flex;gap:8px;align-items:center;font-size:.84rem;margin-top:6px}#pao .ck input{width:auto;margin:0}
#pao .al{background:#3a1f1f;border:1px solid #7a3030;color:#ffb4b0;border-radius:12px;padding:8px 12px;margin-bottom:10px;font-size:.84rem}
#pao .em{text-align:center;color:var(--mu);padding:28px}
#paz{position:fixed;inset:0;z-index:10001;background:#000d;display:none;place-items:center;padding:10px}#paz.on{display:grid}#paz img{max-width:100%;max-height:100%;border-radius:10px}
`;
  document.head.appendChild(css);

  const btn = document.createElement('button'); btn.id = 'pab'; btn.innerHTML = '⇄ P2P'; document.body.appendChild(btn);
  const ov = document.createElement('div'); ov.id = 'pao';
  ov.innerHTML = `<div class="h"><h1>إدارة شراء النقاط P2P</h1><button class="x" id="pax">✕</button></div><div class="n" id="pan"></div><div id="pam"></div>`;
  document.body.appendChild(ov);
  const zoom = document.createElement('div'); zoom.id = 'paz'; zoom.onclick = () => zoom.classList.remove('on'); document.body.appendChild(zoom);

  const A = { tab: 'review', ov: null, ofilt: 'review', sfilt: '', od: null, busy: 0 };
  const TABS = [['review', 'التدقيق'], ['orders', 'كل الطلبات'], ['sellers', 'البائعون'], ['reviews', 'التقييمات'], ['ads', 'الإعلانات'], ['counters', 'العدادات'], ['cfg', 'الإعدادات']];
  const M = $('#pam'), N = $('#pan');

  function nav() {
    const c = (A.ov && A.ov.counts) || {}, sp = (A.ov && A.ov.sellers) || {};
    const bd = { review: (c.proof || 0) + (c.disputed || 0), sellers: sp.pending || 0 };
    N.innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${A.tab === k ? 'on' : ''}">${l}${bd[k] ? `<i>${bd[k]}</i>` : ''}</button>`).join('');
  }
  async function refreshOv() {
    try { A.ov = await api('overview'); const n = (A.ov.counts.proof || 0) + (A.ov.counts.disputed || 0) + (A.ov.sellers.pending || 0); btn.innerHTML = '⇄ P2P' + (n ? ` <i>${n}</i>` : ''); nav(); } catch (e) { /* مفتاح غير محفوظ */ }
  }
  async function show(tab) {
    if (tab) A.tab = tab; A.od = null; nav(); M.innerHTML = '<div class="em">جارٍ التحميل...</div>';
    try { await refreshOv(); await VIEW[A.tab](); } catch (e) { M.innerHTML = `<div class="em">${esc(e.message)}</div>`; }
  }

  const kpis = () => { const c = A.ov.counts; return `<div class="k"><div><b style="color:#2bcfe2">${c.proof}</b><span>بانتظار التدقيق</span></div><div><b style="color:#c79bff">${c.disputed}</b><span>اعتراضات</span></div><div><b>${c.awaiting}</b><span>بانتظار الدفع</span></div><div><b style="color:#3ad98f">${c.done}</b><span>صفقات مكتملة</span></div><div><b>${NF(c.vol)}</b><span>نقاط مُباعة</span></div><div><b>${NF(c.iqd)}</b><span>د.ع تداول</span></div></div>`; };

  const orderRow = (o) => `<div class="c" style="cursor:pointer;${o.flag === 'dispute' || o.status === 'disputed' ? 'border-color:#c79bff' : ''}" data-oid="${o.id}"><div class="r"><b class="g">#${o.id} · ${esc(o.buyer)} ← ${esc(o.seller)}</b>${pill(ST[o.status], SC[o.status])}</div>
<div class="r" style="margin-top:6px"><span class="g"><b style="color:var(--ac)">${NF(o.pts)}</b> نقطة · <b>${NF(o.iqd)}</b> د.ع · ${esc((o.method || {}).label || '')}</span><span class="mu">${dtf(o.proofAt || o.t)}</span></div>
${o.flag === 'dispute' ? `<div class="al" style="margin:8px 0 0">⚠️ اعتراض البائع: ${esc(o.flagNote)}</div>` : o.flag === 'received' ? '<div class="mu" style="margin-top:6px;color:#3ad98f">✓ البائع أكّد استلام المبلغ</div>' : ''}
${o.hasProof ? '<div class="mu" style="margin-top:4px">📎 صورة التحويل مرفقة</div>' : ''}</div>`;

  const VIEW = {
    async counters() {
      const j = await api('counters');
      const q0 = (A.cq || '').trim().toLowerCase();
      const list = j.users.filter((u) => !q0 || [u.name, u.email, u.phone, u.uid].some((x) => String(x || '').toLowerCase().includes(q0)));
      M.innerHTML = `<div class="k"><div><b style="color:#2bcfe2">${NF(j.totalActive)}</b><span>عدادات فعّالة</span></div><div><b>${NF(j.usersWith)}</b><span>مستخدمون لديهم عدادات</span></div><div><b style="color:#3ad98f">${NF(j.dailyTotal)}</b><span>نقاط/يوم إجمالاً</span></div><div><b style="color:#ffb454">${NF(j.unsynced)}</b><span>لم تُزامن بعد</span></div></div>`
        + `<div class="c"><div class="r">${j.byType.filter((x) => x.count).map((x) => pill(x.name + ' × ' + x.count, '#2bcfe2')).join('') || '<span class="mu">لا توجد عدادات</span>'}</div></div>`
        + `<input id="pacq" placeholder="بحث بالاسم أو البريد أو الهاتف" value="${esc(A.cq || '')}" style="width:100%;padding:11px;margin-bottom:12px;border-radius:12px;border:1.5px solid var(--bd);background:var(--cd);color:inherit;font:inherit">`
        + (list.map((u) => `<div class="c"><div class="r"><b>${esc(u.name || u.email)}</b>${u.unsynced ? pill('لم تُزامن بعد', '#ffb454') : pill(u.counters.length + ' عداد', '#3ad98f')}</div>`
          + `<div class="mu" style="margin:4px 0 8px;direction:ltr;text-align:right">${esc(u.email)} ${u.phone ? '· ' + esc(u.phone) : ''}</div>`
          + (u.counters.map((c) => `<div class="r" style="justify-content:space-between;padding:6px 0;border-top:1px solid #ffffff10"><b>${esc(c.name)}</b><span class="mu">${NF(c.daily)} نقطة/يوم · ينتهي ${dtf(c.exp)} (${c.days} يوم)</span></div>`).join('') || '<div class="mu">يملك عدادات على جهازه ولم تصل بعد — تُزامن عند فتح التطبيق.</div>')
          + `<div class="mu" style="margin-top:6px;font-size:.78rem">آخر مزامنة: ${dtf(u.syncedAt)} · الرصيد: ${NF(u.pts)}</div></div>`).join('') || '<div class="em">لا نتائج</div>');
      const inp = $('#pacq', M); if (inp) inp.oninput = () => { A.cq = inp.value; clearTimeout(A.ct); A.ct = setTimeout(() => VIEW.counters().then(() => { const i2 = $('#pacq', M); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } }), 300); };
    },
    async review() {
      const j = await api('orders?status=review');
      M.innerHTML = kpis() + (j.orders.map(orderRow).join('') || '<div class="em">لا توجد طلبات بانتظار التدقيق ✓</div>');
    },
    async orders() {
      const j = await api('orders?status=' + A.ofilt);
      const f = [['review', 'التدقيق'], ['awaiting_payment', 'بانتظار الدفع'], ['completed', 'المكتملة'], ['rejected', 'المرفوضة'], ['expired', 'المنتهية'], ['cancelled', 'الملغاة'], ['all', 'الكل']];
      M.innerHTML = `<div class="r" style="margin-bottom:10px">${f.map(([k, l]) => `<button class="b ${A.ofilt === k ? '' : 'o'}" data-of="${k}">${l}</button>`).join('')}</div>` + (j.orders.map(orderRow).join('') || '<div class="em">لا توجد طلبات</div>');
    },

    async sellers() {
      const j = await api('sellers' + (A.sfilt ? '?status=' + A.sfilt : ''));
      const f = [['', 'الكل'], ['pending', 'بانتظار الاعتماد'], ['approved', 'المعتمدون'], ['suspended', 'الموقوفون'], ['rejected', 'المرفوضون']];
      M.innerHTML = `<div class="r" style="margin-bottom:10px">${f.map(([k, l]) => `<button class="b ${A.sfilt === k ? '' : 'o'}" data-sf="${k}">${l}</button>`).join('')}</div>` + (j.sellers.map((s) => sellerCard(s, j.reqCounter)).join('') || '<div class="em">لا يوجد بائعون</div>');
    },

    async reviews() {
      const j = await api('reviews');
      M.innerHTML = j.reviews.map((r) => `<div class="c" ${r.hidden ? 'style="opacity:.55"' : ''}><div class="r"><b class="g">${esc(r.buyer)} ← ${esc(r.seller)}</b><span style="color:#ffc107">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span></div>
<div style="margin-top:6px">${esc(r.comment) || '<span class="mu">بلا تعليق</span>'}</div><div class="r" style="margin-top:8px"><span class="mu g">طلب #${r.order} · ${dtf(r.t)}</span><button class="b o" data-rh="${r.id}" data-hv="${r.hidden ? 0 : 1}">${r.hidden ? 'إظهار' : 'إخفاء التعليق'}</button></div></div>`).join('') || '<div class="em">لا توجد تقييمات</div>';
    },

    async ads() {
      const j = await api('ads');
      M.innerHTML = `<div class="c">السعر الرسمي: <b>${N2(j.range.official)}</b> — النطاق المسموح <b>${N2(j.range.min)} – ${N2(j.range.max)}</b> د.ع/1000 نقطة</div>` +
        (j.ads.map((a) => `<div class="c"><div class="r"><b class="g">#${a.id} · ${esc(a.seller)}</b>${pill(a.status === 'active' ? 'نشط' : 'متوقف', a.status === 'active' ? '#3ad98f' : '#ffb300')}${a.out ? pill('خارج النطاق', '#ff7a77') : ''}</div>
<div class="r" style="margin-top:6px"><span class="g">السعر <b>${N2(a.price)}</b> · المتاح <b>${NF(a.avail)}</b> / ${NF(a.total)} نقطة</span><button class="b rd" data-ac="${a.id}">إغلاق وإرجاع النقاط</button></div></div>`).join('') || '<div class="em">لا توجد إعلانات مفتوحة</div>');
    },

    async cfg() {
      const j = await api('settings'), c = j.cfg, ct = ['عشرة آلاف (7)', 'بسيط (0)', 'الاعتيادي (1)', 'برونزي (2)', 'الفضي (3)', 'الذهبي (4)', 'الماسي (5)', 'الناري (6)', 'تيتانيوم (8)'];
      M.innerHTML = `<div class="c"><b>⚙️ إعدادات P2P</b>
<div class="ck"><input type="checkbox" id="s_en" ${c.enabled ? 'checked' : ''}><span>تفعيل نظام P2P</span></div>
<div class="mu" style="margin-top:6px">السعر الرسمي الحالي: <b style="color:#fff">${N2(j.range.official)}</b> د.ع/1000 نقطة → النطاق ${N2(j.range.min)} – ${N2(j.range.max)}</div>
<label>تثبيت السعر الرسمي يدوياً (0 = استخدم سعر التطبيق المنشور)<input id="s_of" type="number" step="0.01" value="${c.officialOverride}"></label>
<label>أقصى زيادة عن السعر الرسمي (٪)<input id="s_mk" type="number" step="0.5" value="${c.maxMarkupPct}"></label>
<label>شرط العداد (ملغى — الجميع يبيعون ويشترون، القيمة لا تؤثر)<input id="s_ci" type="number" value="${c.reqCounterIdx}"></label>
<label>أقل كمية للإعلان (نقطة)<input id="s_ma" type="number" value="${c.minAdPts}"></label>
<label>أقل كمية للطلب (نقطة)<input id="s_mo" type="number" value="${c.minOrderPts}"></label>
<label>مهلة الدفع (دقيقة)<input id="s_pw" type="number" value="${c.payWindowMin}"></label>
<label>عمولة المنصة من النقاط المستلمة (٪)<input id="s_fe" type="number" step="0.1" value="${c.feePct}"></label>
<label>أقصى طلبات مفتوحة للمشتري<input id="s_mx" type="number" value="${c.maxOpenOrders}"></label>
<button class="b" style="margin-top:14px;width:100%" data-save="1">حفظ الإعدادات</button></div>
<div class="mu">تذكير: ظهور القسم للمستخدمين يتحكم به أيضاً مفتاح «شراء النقاط» في الإعدادات ← إظهار/إخفاء الأقسام ثم «نشر للجميع».</div>`;
    },
  };

  function sellerCard(s, rc) {
    const st = s.stats, m = s.methods || [];
    return `<div class="c"><div class="r"><b class="g">${esc(s.name || s.email)}</b>${pill(SS[s.status], SC[s.status])}${s.status === 'approved' ? lvp(s.level) : ''}</div>
<div class="mu" dir="ltr" style="text-align:right;margin-top:3px">${esc(s.email)} · ${esc(s.phone || '')}</div>
<div class="two" style="margin-top:10px"><div class="pb"><h4>بيانات البائع</h4>
<div class="kv"><span>الاسم المصرفي</span><b>${esc(s.fullName)}</b></div><div class="kv"><span>هاتف الصرف</span><b dir="ltr">${esc(s.sphone)}</b></div><div class="kv"><span>الرصيد</span><b>${NF(s.bal)}</b></div>
<div class="kv"><span>KYC</span><b>${s.kyc ? '✓' : '—'}</b></div><div class="kv"><span>عداد «${rc}» فعّال</span><b>${rc < 0 ? 'غير مطلوب' : s.counter ? '✓' : '✕'}</b></div>
<div class="ck"><input type="checkbox" data-waive="${esc(s.email)}" ${s.waive ? 'checked' : ''}><span>إعفاء من شرط العداد</span></div></div>
<div class="pb"><h4>التعاملات والتقييم</h4><div class="kv"><span>صفقات ناجحة</span><b>${st.done}</b></div><div class="kv"><span>مرفوضة</span><b>${st.bad}</b></div><div class="kv"><span>اعتراضات عليه</span><b>${st.disputes}</b></div>
<div class="kv"><span>نسبة الإتمام</span><b>${st.rate == null ? '—' : Math.round(st.rate * 100) + '٪'}</b></div><div class="kv"><span>التقييم</span><b>${st.avg == null ? '—' : N2(st.avg) + ' ★ (' + st.n + ')'}</b></div><div class="kv"><span>حجم التداول</span><b>${NF(st.vol)}</b></div>
<div class="kv"><span>اقتراح النظام</span>${lvp(s.suggest)}</div></div></div>
<div class="pb" style="margin-top:10px"><h4>حسابات الدفع (للمطابقة)</h4>${m.map((x) => `<div class="mt"><b>${esc(x.label)}</b> — ${esc(x.holder)}<br><span dir="ltr">${esc(x.number)}</span> ${x.bank ? '· ' + esc(x.bank) : ''}</div>`).join('') || '<span class="mu">—</span>'}${s.bio ? `<div class="mu" style="margin-top:8px">نبذة: ${esc(s.bio)}</div>` : ''}</div>
<label>ملاحظة الإدارة (تظهر للبائع عند الرفض/الإيقاف)<input data-note="${esc(s.email)}" value="${esc(s.adminNote)}" maxlength="300"></label>
<div class="r" style="margin-top:10px"><span class="mu">منح المستوى:</span>${Object.keys(LV).map((k) => `<button class="b ${s.level === k ? '' : 'o'}" data-lv="${k}" data-e="${esc(s.email)}">${LV[k][0]}</button>`).join('')}</div>
<div class="r" style="margin-top:10px">${s.status !== 'approved' ? `<button class="b g2" data-sd="approved" data-e="${esc(s.email)}">اعتماد</button>` : ''}${s.status !== 'suspended' && s.status !== 'rejected' ? `<button class="b rd" data-sd="suspended" data-e="${esc(s.email)}">إيقاف</button>` : ''}${s.status === 'pending' ? `<button class="b rd" data-sd="rejected" data-e="${esc(s.email)}">رفض</button>` : ''}</div></div>`;
  }

  /* ---------- تفاصيل طلب (شاشة التدقيق) ---------- */
  async function openOrder(id) {
    M.innerHTML = '<div class="em">جارٍ التحميل...</div>';
    const j = await api('order/' + id); A.od = j; const o = j.order, b = j.buyer, s = j.seller, mm = o.method || {};
    const review = ['proof_submitted', 'disputed'].includes(o.status);
    const usedIdx = (s.methods || []).findIndex((x) => x.number === mm.number && x.type === mm.type);
    const hist = (h) => `${h.done} ناجحة · ${h.rej} مرفوضة · ${h.total} إجمالي`;
    M.innerHTML = `<button class="b o" data-back="1" style="margin-bottom:10px">← رجوع</button>
<div class="c"><div class="r"><b class="g" style="font-size:1.1rem">طلب #${o.id}</b>${pill(ST[o.status], SC[o.status])}</div>
<div class="k" style="margin:12px 0 0"><div><b style="color:var(--ac)">${NF(o.pts)}</b><span>نقطة</span></div><div><b>${NF(o.iqd)}</b><span>د.ع المطلوب</span></div><div><b>${N2(o.price)}</b><span>سعر/1000</span></div>${o.fee ? `<div><b>${NF(o.fee)}</b><span>عمولة</span></div>` : ''}</div>
<div class="mu" style="margin-top:8px">أُنشئ ${dtf(o.t)} · رُفعت الصورة ${dtf(o.proofAt)}${o.decidedAt ? ' · القرار ' + dtf(o.decidedAt) : ''}</div>
${o.flag === 'dispute' ? `<div class="al" style="margin-top:10px">⚠️ اعتراض البائع: لم يصل المبلغ — ${esc(o.flagNote)}</div>` : o.flag === 'received' ? '<div class="mu" style="margin-top:10px;color:#3ad98f">✓ البائع أكّد استلام المبلغ</div>' : '<div class="mu" style="margin-top:10px">البائع لم يؤكد الاستلام بعد</div>'}
${o.note ? `<div class="mu" style="margin-top:8px">ملاحظة الإدارة: ${esc(o.note)}</div>` : ''}</div>
<div class="two"><div class="c"><h4 style="margin:0 0 8px;color:#2bcfe2">👤 المشتري</h4><div class="kv"><span>الاسم</span><b>${esc(b.name)}</b></div><div class="kv"><span>البريد</span><b dir="ltr">${esc(b.email)}</b></div><div class="kv"><span>الهاتف</span><b dir="ltr">${esc(b.phone)}</b></div>
<div class="kv"><span>KYC</span><b>${b.kyc ? '✓' : '—'}</b></div><div class="kv"><span>الرصيد</span><b>${NF(b.pts)}</b></div><div class="kv"><span>عضو منذ</span><b>${dtf(b.since)}</b></div><div class="kv"><span>صفقاته</span><b>${hist(b.hist)}</b></div>${b.blk ? '<div class="al">الحساب محظور</div>' : ''}</div>
<div class="c"><h4 style="margin:0 0 8px;color:var(--ac)">🏷 البائع ${lvp(s.level)}</h4><div class="kv"><span>الاسم</span><b>${esc(s.name)}</b></div><div class="kv"><span>الاسم المصرفي</span><b>${esc(s.fullName)}</b></div><div class="kv"><span>البريد</span><b dir="ltr">${esc(s.email)}</b></div>
<div class="kv"><span>الهاتف</span><b dir="ltr">${esc(s.phone)} / ${esc(s.sphone)}</b></div><div class="kv"><span>صفقاته</span><b>${hist(s.hist)}</b></div></div></div>
<div class="c"><h4 style="margin:0 0 8px">🏦 حسابات البائع للمطابقة</h4><div class="mu">الحساب الذي اختاره المشتري للدفع مميّز بالأخضر</div>
${(s.methods || []).map((x, i) => `<div class="mt ${i === usedIdx ? 'ac' : ''}"><b>${esc(x.label)}</b> ${i === usedIdx ? pill('المختار للدفع', '#3ad98f') : ''}<br>صاحب الحساب: <b>${esc(x.holder)}</b><br>الرقم: <b dir="ltr">${esc(x.number)}</b>${x.bank ? ' · ' + esc(x.bank) : ''}</div>`).join('') || '<span class="mu">—</span>'}
${usedIdx < 0 ? `<div class="mt ac"><b>${esc(mm.label)}</b> (نسخة وقت الطلب — عُدّلت لاحقاً)<br>${esc(mm.holder)}<br><b dir="ltr">${esc(mm.number)}</b></div>` : ''}</div>
<div class="c"><h4 style="margin:0 0 8px">🧾 صورة التحويل</h4>${j.proof ? `<img class="pf" src="${j.proof}" data-zoom="1">` : '<div class="mu">لم يرفع المشتري صورة بعد</div>'}
${review ? `<div style="margin-top:12px"><div class="mu">قائمة المطابقة (للتدقيق فقط)</div><label class="ck"><input type="checkbox" class="chk"> المبلغ في الصورة = ${NF(o.iqd)} د.ع</label><label class="ck"><input type="checkbox" class="chk"> رقم/اسم المستلم = حساب البائع الأخضر أعلاه</label><label class="ck"><input type="checkbox" class="chk"> التاريخ والوقت حديث وبعد إنشاء الطلب</label><label class="ck"><input type="checkbox" class="chk"> الصورة غير مكررة في طلب آخر وغير معدّلة</label></div>` : ''}</div>
<div class="c"><h4 style="margin:0 0 8px">💬 دردشة الطرفين</h4>${j.msgs.map((m) => `<div class="msg ${m.from === '*' ? 's' : m.from}">${esc(m.x)}${m.img ? `<img src="${SAFE_SRC(m.img)}" data-zoom="1">` : ''}</div>`).join('') || '<div class="mu">لا توجد رسائل</div>'}</div>
${review ? `<div class="c"><label style="margin-top:0">ملاحظة / سبب القرار (إلزامية عند الرفض وتظهر للطرفين)<textarea id="dn" rows="2" maxlength="300"></textarea></label>
<div class="r" style="margin-top:12px"><button class="b g2 g" data-dec="approve">✅ موافقة وإضافة النقاط للمشتري</button><button class="b rd g" data-dec="reject">❌ رفض وإعادة النقاط للإعلان</button></div>
${o.status !== 'disputed' ? '<button class="b pu" style="margin-top:8px;width:100%" data-dec="dispute">⚖️ وضع قيد التحقيق</button>' : ''}</div>` : ''}`;
  }

  async function decide(act, btnEl) {
    if (A.busy) return; const o = A.od.order, note = ($('#dn') || {}).value || '';
    if (act === 'reject' && note.trim().length < 3) return say('اكتب سبب الرفض');
    if (act === 'approve') { const un = [...document.querySelectorAll('.chk')].filter((x) => !x.checked).length; if (un && !confirm(`${un} من بنود المطابقة غير مؤشّرة. هل تريد الموافقة رغم ذلك؟`)) return; }
    if (!confirm(act === 'approve' ? `تأكيد الموافقة؟ ستُضاف ${NF(o.pts - o.fee)} نقطة لرصيد المشتري.` : act === 'reject' ? 'تأكيد الرفض؟' : 'وضع الطلب قيد التحقيق؟')) return;
    A.busy = 1; btnEl.disabled = true;
    try { await api('order/decide', { id: o.id, act, note }); say('تم تنفيذ القرار'); await show('review'); } catch (e) { say(e.message); btnEl.disabled = false; } finally { A.busy = 0; }
  }

  async function sellerDecide(body) {
    try { await api('seller/decide', body); say('تم الحفظ'); await show('sellers'); } catch (e) { say(e.message); }
  }

  ov.addEventListener('click', async (e) => {
    const t = e.target, g = (a) => t.closest('[' + a + ']');
    if (t.id === 'pax') return close();
    let x;
    if ((x = g('data-t'))) return show(x.dataset.t);
    if ((x = g('data-back'))) return show(A.tab);
    if (t.dataset && t.dataset.zoom) { zoom.innerHTML = `<img src="${t.src}">`; return zoom.classList.add('on'); }
    if ((x = g('data-dec'))) return decide(x.dataset.dec, x);
    if ((x = g('data-oid'))) return openOrder(x.dataset.oid).catch((er) => say(er.message));
    if ((x = g('data-of'))) { A.ofilt = x.dataset.of; return show('orders'); }
    if ((x = g('data-sf'))) { A.sfilt = x.dataset.sf; return show('sellers'); }
    if ((x = g('data-rh'))) { try { await api('review/hide', { id: +x.dataset.rh, hidden: x.dataset.hv === '1' }); show('reviews'); } catch (er) { say(er.message); } return; }
    if ((x = g('data-ac'))) { if (!confirm('إغلاق الإعلان وإرجاع النقاط غير المباعة للبائع؟')) return; try { await api('ad/close', { id: +x.dataset.ac }); say('تم الإغلاق'); show('ads'); } catch (er) { say(er.message); } return; }
    if ((x = g('data-lv'))) { const e2 = x.dataset.e, nt = ($('[data-note="' + CSS.escape(e2) + '"]') || {}).value; return sellerDecide({ email: e2, level: x.dataset.lv, note: nt }); }
    if ((x = g('data-sd'))) { const e2 = x.dataset.e, nt = ($('[data-note="' + CSS.escape(e2) + '"]') || {}).value; if (x.dataset.sd !== 'approved' && !confirm('تأكيد الإجراء؟')) return; return sellerDecide({ email: e2, status: x.dataset.sd, note: nt }); }
    if (g('data-save')) {
      const v = (id) => Number($('#' + id).value);
      try { await api('settings', { cfg: { enabled: $('#s_en').checked, officialOverride: v('s_of'), maxMarkupPct: v('s_mk'), reqCounterIdx: v('s_ci'), minAdPts: v('s_ma'), minOrderPts: v('s_mo'), payWindowMin: v('s_pw'), feePct: v('s_fe'), maxOpenOrders: v('s_mx') } }); say('تم حفظ الإعدادات'); show('cfg'); } catch (er) { say(er.message); }
    }
  });
  ov.addEventListener('change', async (e) => {
    const w = e.target.dataset && e.target.dataset.waive; if (!w) return;
    try { await api('seller/decide', { email: w, waive: e.target.checked }); say('تم'); } catch (er) { say(er.message); }
  });

  function open() { ov.classList.add('on'); show(A.tab); }
  function close() { ov.classList.remove('on'); refreshOv(); }
  btn.onclick = open;
  setTimeout(refreshOv, 2500); setInterval(() => { if (!ov.classList.contains('on') && !document.hidden) refreshOv(); }, 30000);
})();

/* ===== إخفاء الأزرار العائمة قبل تسجيل دخول الإدارة (تظهر فقط بعد الدخول) ===== */
(function () {
  if (window.__stfGate) return; window.__stfGate = 1;
  const st = document.createElement('style');
  st.textContent = 'body:not(.stf-in) #axb,body:not(.stf-in) #axo,body:not(.stf-in) #pab,body:not(.stf-in) #pao,body:not(.stf-in) #paz,body:not(.stf-in) #nwb,body:not(.stf-in) #nwo{display:none!important}';
  document.head.appendChild(st);
  const chk = () => { document.body.classList.toggle('stf-in', !!document.querySelector('[data-a="stfout"]')); };
  let q = 0;
  const kick = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; chk(); }); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  setInterval(chk, 700); chk();
})();

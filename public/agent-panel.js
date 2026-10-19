/* لوحة الوكيل — تصميم جديد (مرحلة 22)
   - معلومات الوكالة: عرض كامل + زر «تعديل» يفتح النموذج
   - تحويل نقاط من حساب الوكيل إلى سيولة الوكالة (مع مربع رصيد الحساب وزر «تحويل الكل») — سيولة الإدارة باقية كما هي
   - سجل عمليات لحظي (SSE + فحص احتياطي): شحن الأعضاء، ما يصل من الإدارة، التحويلات الواردة — باسم الطرف ورمز إحالته وصورته */
(function () {
  if (window.__agp) return;
  if (typeof S === 'undefined' || typeof AG === 'undefined' || typeof V === 'undefined' || typeof myAg !== 'function') return;
  window.__agp = 1;

  /* ---------------- التنسيق ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  .agp{--g:#3ddc68;--r:#fb7185;--a:#f5a524;--glass:linear-gradient(180deg,#ffffff0d,#ffffff04);--bd2:#ffffff17;display:block}
  .agp *{box-sizing:border-box}
  .agp .hero{position:relative;overflow:hidden;border-radius:26px;padding:18px 18px 16px;margin:4px 0 12px;border:1px solid #2bcfe244;
    background:radial-gradient(120% 140% at 100% 0%,#2bcfe233 0,transparent 55%),radial-gradient(90% 120% at 0% 100%,#3ddc6826 0,transparent 55%),linear-gradient(160deg,#10323b,#101c28 70%)}
  .agp .hero:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,#ffffff06 0 1px,transparent 1px 14px);pointer-events:none}
  .agp .hrow{position:relative;display:flex;align-items:center;gap:14px}
  .agp .av{width:62px;height:62px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;font-size:1.5rem;color:#06232a;
    background:linear-gradient(135deg,#2bcfe2,#1a8fa3) center/cover;box-shadow:0 0 0 3px #0e1621,0 0 0 5px #2bcfe2aa,0 8px 24px #2bcfe244}
  .agp .hn{min-width:0;flex:1}
  .agp .hn b{display:block;font-size:1.25rem;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .agp .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .agp .chip{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:99px;background:#ffffff12;border:1px solid var(--bd2);color:#dfeaf1;font-family:inherit;cursor:default}
  .agp button.chip{cursor:pointer}
  .agp .chip.ok{background:#3ddc6820;border-color:#3ddc6866;color:#7dffa0}
  .agp .live{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;color:#9fb4c2}
  .agp .dot{width:8px;height:8px;border-radius:50%;background:#7d8c98;flex:none}
  .agp .dot.on{background:var(--g);box-shadow:0 0 0 0 #3ddc6888;animation:agpPulse 1.8s infinite}
  @keyframes agpPulse{0%{box-shadow:0 0 0 0 #3ddc6899}70%{box-shadow:0 0 0 9px #3ddc6800}100%{box-shadow:0 0 0 0 #3ddc6800}}
  .agp .big{position:relative;margin-top:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
  .agp .big small{display:block;color:#a9bdca;font-size:.82rem;margin-bottom:2px}
  .agp .big .num{font-size:2.15rem;font-weight:800;letter-spacing:.2px;line-height:1.1;background:linear-gradient(90deg,#fff,#8be9f3);-webkit-background-clip:text;background-clip:text;color:transparent}
  .agp .big .unit{font-size:.9rem;color:#a9bdca;font-weight:600;margin-inline-start:6px}
  .agp .spark{flex:none;width:112px;height:46px}
  .agp .kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .agp .kpi{background:var(--glass);border:1px solid var(--bd2);border-radius:20px;padding:13px 14px;position:relative;overflow:hidden}
  .agp .kpi i{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;margin-bottom:8px;background:#2bcfe21f;color:#2bcfe2}
  .agp .kpi.g i{background:#3ddc6820;color:var(--g)}.agp .kpi.a i{background:#f5a52422;color:var(--a)}.agp .kpi.p i{background:#a78bfa24;color:#a78bfa}
  .agp .kpi small{display:block;color:var(--mu);font-size:.78rem}
  .agp .kpi b{display:block;font-size:1.25rem;margin-top:2px}
  .agp .kpi em{display:block;font-style:normal;color:var(--mu);font-size:.72rem;margin-top:2px}
  .agp svg{display:block}
  .agp .tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:18px;background:#0b141c;border:1px solid var(--bd2);margin-bottom:12px;position:sticky;top:6px;z-index:5;backdrop-filter:blur(10px)}
  .agp .tab{font:inherit;font-weight:700;font-size:.9rem;border:0;border-radius:14px;padding:10px 6px;background:transparent;color:var(--mu);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:.18s}
  .agp .tab.on{background:linear-gradient(90deg,#00b9c4,#2bcfe2);color:#04222a;box-shadow:0 6px 18px #2bcfe233}
  .agp .tab u{text-decoration:none;font-size:.7rem;background:#04222a22;border-radius:99px;padding:1px 7px}
  .agp .pan{background:var(--glass);border:1px solid var(--bd2);border-radius:22px;padding:16px;margin-bottom:12px}
  .agp .pan h3{margin:0 0 4px;font-size:1.05rem;display:flex;align-items:center;gap:8px}
  .agp .pan h3 i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#2bcfe21f;color:#2bcfe2;flex:none}
  .agp .pan .sub{color:var(--mu);font-size:.84rem;line-height:1.7;margin-bottom:8px}
  .agp .pan .hd2{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
  .agp .mini{font:inherit;font-weight:700;font-size:.82rem;border-radius:12px;padding:7px 14px;border:1.5px solid var(--line);background:#ffffff08;color:var(--cy);cursor:pointer;display:inline-flex;gap:6px;align-items:center;width:auto}
  .agp .mini.g{background:#3ddc6818;border-color:#3ddc6866;color:#7dffa0}
  .agp .accbox{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 8px;padding:14px 16px;border-radius:18px;border:1px dashed #2bcfe277;background:linear-gradient(135deg,#2bcfe21a,#2bcfe206)}
  .agp .accbox small{color:#a9bdca;font-size:.8rem;display:block}
  .agp .accbox b{font-size:1.55rem}
  .agp .accbox b span{font-size:.8rem;color:var(--mu);font-weight:600;margin-inline-start:4px}
  .agp .pcts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:2px 0 8px}
  .agp .pc{font:inherit;font-weight:700;font-size:.82rem;border-radius:12px;padding:8px 0;border:1px solid var(--bd2);background:#ffffff08;color:#dfeaf1;cursor:pointer}
  .agp .pc:active{transform:scale(.97)}
  .agp .pv{min-height:1.5em;font-size:.84rem;color:var(--mu);margin:2px 2px 8px}
  .agp .pv b{color:var(--cy)}
  .agp .meth{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:16px;background:#ffffff08;border:1px solid var(--bd2);margin-top:8px}
  .agp .meth .ok{width:24px;height:24px;border-radius:8px;background:#3ddc6822;color:var(--g);display:grid;place-items:center;flex:none}
  .agp .meth b{flex:1;min-width:0}
  .agp .meth .nm{direction:ltr;color:var(--cy);font-weight:700;letter-spacing:.3px}
  .agp .desc{white-space:pre-wrap;line-height:1.85;font-size:.93rem;padding:12px 14px;border-radius:16px;background:#ffffff08;border:1px solid var(--bd2);margin:6px 0 10px}
  .agp .empty{color:var(--mu);text-align:center;padding:22px 10px;font-size:.9rem;line-height:1.8}
  .agp .sw{display:flex;align-items:center;gap:10px;margin-top:10px}
  .agp .sw label{display:flex;align-items:center;gap:10px;min-width:104px;font-weight:700;cursor:pointer}
  .agp .sw input[type=checkbox]{appearance:none;-webkit-appearance:none;width:44px;height:26px;border-radius:99px;background:#33424f;position:relative;flex:none;margin:0;padding:0;border:0;cursor:pointer;transition:.18s}
  .agp .sw input[type=checkbox]:before{content:"";position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.18s}
  .agp .sw input[type=checkbox]:checked{background:#1fc7d4}
  .agp .sw input[type=checkbox]:checked:before{inset-inline-start:21px}
  .agp .sw input[type=text]{margin:0;flex:1;min-width:0}
  .agp .acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .agp .flt{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin:6px -2px 8px;scrollbar-width:none}
  .agp .flt::-webkit-scrollbar{display:none}
  .agp .fb{font:inherit;font-weight:700;font-size:.8rem;white-space:nowrap;border-radius:99px;padding:7px 14px;border:1px solid var(--bd2);background:#ffffff08;color:var(--mu);cursor:pointer}
  .agp .fb.on{background:#2bcfe226;border-color:#2bcfe2aa;color:#8be9f3}
  .agp .day{font-size:.78rem;color:var(--mu);margin:14px 4px 6px;font-weight:700;letter-spacing:.2px}
  .agp .lg{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:18px;background:#ffffff07;border:1px solid var(--bd2);margin-bottom:8px;animation:agpIn .35s ease both}
  @keyframes agpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .agp .lg .av{width:46px;height:46px;font-size:1.1rem;box-shadow:none;position:relative}
  .agp .lg .av.sys{background:linear-gradient(135deg,#a78bfa,#6d5ae6);color:#fff}
  .agp .lg .av.me{background:linear-gradient(135deg,#3ddc68,#1a9a45);color:#04200c}
  .agp .lg .mid{flex:1;min-width:0;line-height:1.5}
  .agp .lg .mid b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.95rem}
  .agp .lg .mid small{display:block;color:var(--mu);font-size:.74rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .agp .lg .cd{display:inline-flex;align-items:center;gap:4px;direction:ltr;font-weight:700;color:#8be9f3;background:#2bcfe215;border-radius:8px;padding:0 6px;font-size:.72rem;border:0;font-family:inherit;cursor:pointer}
  .agp .lg .amt{flex:none;text-align:end;line-height:1.35}
  .agp .lg .amt b{display:block;font-size:1.02rem;direction:ltr}
  .agp .lg .amt b.in{color:var(--g)}.agp .lg .amt b.out{color:var(--r)}
  .agp .lg .amt span{display:inline-block;font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;background:#ffffff12;color:#c4d3dd}
  .agp .more{display:block;margin:10px auto 0}
  .agp .reqs .rq{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:14px;background:#ffffff07;border:1px solid var(--bd2);margin-top:8px}
  .agp .reqs small{color:var(--mu);font-size:.76rem;display:block}
  .agp .tag{font-size:.72rem;font-weight:700;border-radius:99px;padding:3px 10px;white-space:nowrap}
  .agp .tag.ok{background:#3ddc6822;color:#7dffa0}.agp .tag.no{background:#fb718522;color:#ff9fb0}.agp .tag.wt{background:#f5a52422;color:#ffc766}
  .agp .sup{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;color:#fff;font-weight:700;padding:13px;border-radius:18px;background:#25d366;margin-top:4px}
  .agp .sk{height:62px;border-radius:18px;margin-bottom:8px;background:linear-gradient(100deg,#ffffff07 30%,#ffffff12 50%,#ffffff07 70%) 0 0/200% 100%;animation:agpSk 1.3s linear infinite}
  @keyframes agpSk{to{background-position:-200% 0}}
  .agp textarea{font:inherit;width:100%;background:var(--inp);color:#fff;border:1.5px solid var(--line);border-radius:18px;padding:12px 14px;margin:6px 0;resize:vertical;min-height:110px}
  @media(prefers-reduced-motion:reduce){.agp *{animation:none!important;transition:none!important}}`;
  document.head.appendChild(css);

  /* ---------------- أدوات ---------------- */
  const AP = { tab: 'ops', flt: 'all', edit: false, draft: null, log: [], sum: null, chart: [], loaded: false, live: false, at: 0, shown: 40, sig: '', busy: false, topBusy: false };
  const E = (v) => { try { return esc(v); } catch (e) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'); } };
  const nf = (n) => { try { return f(n); } catch (e) { return String(Math.floor(n || 0)); } };
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const id = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  async function post(p, b) {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || j.message || 'تعذر الاتصال بالخادم'); e.status = r.status; throw e; }
    return j;
  }
  const IC = {
    wallet: '<path d="M3 7a3 3 0 0 1 3-3h11v3"/><path d="M3 7v10a3 3 0 0 0 3 3h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a3 3 0 0 1-3-1z"/><circle cx="16.5" cy="14" r="1.2"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18 14.3c1.9.8 3 2.6 3 5.7"/>',
    shield: '<path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
    down: '<path d="M12 4v13"/><path d="m6 12 6 6 6-6"/><path d="M5 21h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    store: '<path d="M4 9 5.5 4h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  };
  const I = (n, z) => `<svg viewBox="0 0 24 24" width="${z || 16}" height="${z || 16}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

  const vals = () => { const a = myAg(); const o = a ? a.o : []; const liq = +o[4] || 0, off = +o[9] || 0; return { a, o, liq, off, tot: liq + off }; };
  const myEmail = () => (S.acc ? String(S.acc.e).toLowerCase() : '');

  const KIND = {
    charge: ['شحن عضو', 'out', 'user'],
    transfer_in: ['تحويل وارد', 'in', 'user'],
    admin_liq: ['سيولة من الإدارة', 'in', 'sys'],
    admin_adj: ['تعديل من الإدارة', 'sign', 'sys'],
    addoff: ['من حسابي إلى السيولة', 'in', 'me'],
  };
  const GROUP = { all: null, sold: ['charge'], admin: ['admin_liq', 'admin_adj'], inc: ['transfer_in', 'addoff'] };

  /* ---------------- الأجزاء ---------------- */
  function spark() {
    const days = [], now = new Date(Date.now() + 3 * 3600 * 1000); // توقيت بغداد
    for (let i = 6; i >= 0; i--) { const d = new Date(now.getTime() - i * 86400000); days.push(d.toISOString().slice(0, 10)); }
    const m = {}; (AP.chart || []).forEach((r) => { m[r.d] = r.p; });
    const v = days.map((d) => m[d] || 0), mx = Math.max(1, ...v), w = 112, h = 46, bw = 11, gap = (w - bw * 7) / 6;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="مبيعات آخر 7 أيام">${v.map((x, i) => {
      const bh = Math.max(3, Math.round((x / mx) * (h - 6))); const last = i === 6;
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${h - bh}" width="${bw}" height="${bh}" rx="3.5" fill="${last ? '#2bcfe2' : '#2bcfe255'}"><title>${days[i]}: ${nf(x)}</title></rect>`;
    }).join('')}</svg>`;
  }
  function kpis() {
    const s = AP.sum || {}, v = vals();
    return `<div class="kpis">
      <div class="kpi g"><i>${I('send')}</i><small>إجمالي ما شحنته للأعضاء</small><b>${nf(s.sold || 0)}</b><em>${nf(s.soldN || 0)} عملية</em></div>
      <div class="kpi"><i>${I('users')}</i><small>أعضاء تم شحنهم</small><b>${nf(s.members || 0)}</b><em>عضو مختلف</em></div>
      <div class="kpi p"><i>${I('shield')}</i><small>وصلك من الإدارة</small><b>${nf(s.admin || 0)}</b><em>${nf(s.adminN || 0)} دفعة سيولة</em></div>
      <div class="kpi a"><i>${I('down')}</i><small>تحويلات واردة + من حسابك</small><b>${nf((s.recv || 0) + (s.own || 0))}</b><em>${nf((s.recvN || 0) + (s.ownN || 0))} عملية</em></div>
    </div>`;
  }
  function heroHtml() {
    const v = vals(), o = v.o, code = (typeof AGC === 'function' && AGC()[o[0]]) || '—';
    const first = String(o[0] || S.name || '?').trim().charAt(0).toUpperCase();
    const av = S.av && /^data:image\//.test(S.av) ? `style="background-image:url('${SAFE_SRC(S.av)}')"` : '';
    return `<div class="hero"><div class="hrow">
      <div class="av" ${av}>${av ? '' : E(first)}</div>
      <div class="hn"><b>${E(o[0] || S.name || 'الوكيل')}</b>
        <div class="chips"><span class="chip ok">✓ وكيل معتمد</span><button type="button" class="chip" data-ap="copy" data-v="${E(code)}" aria-label="نسخ رمز الوكيل">رمز الوكيل <span dir="ltr">${E(code)}</span> ${I('copy', 13)}</button></div>
      </div></div>
      <div class="big"><div><small>رصيد الوكالة المتاح للشحن</small><div><span class="num" id="apliq">${nf(v.tot)}</span><span class="unit">نقطة</span></div>
        ${v.off > 0 ? `<small style="margin-top:4px">منها ${nf(v.off)} رصيد رسمي سابق</small>` : ''}</div>${spark()}</div>
      <div class="live" style="margin-top:12px;position:relative"><span class="dot ${AP.live ? 'on' : ''}" id="apdot"></span><span id="aplivetx">${liveText()}</span></div>
    </div>`;
  }
  function liveText() {
    if (!AP.loaded) return 'جارٍ المزامنة مع الخادم…';
    const t = new Date(AP.at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return (AP.live ? 'مزامنة فورية مع الخادم' : 'مزامنة دورية') + ' · آخر تحديث ' + t;
  }
  const tabsHtml = () => `<div class="tabs" role="tablist">
    ${[['ops', 'العمليات', 'bolt'], ['log', 'سجل العمليات', 'list'], ['info', 'الوكالة', 'info']].map(([k, t, ic]) => `<button type="button" role="tab" class="tab ${AP.tab === k ? 'on' : ''}" data-ap="tab" data-v="${k}" aria-selected="${AP.tab === k}">${I(ic, 15)}<span>${t}</span>${k === 'log' && AP.log.length ? `<u>${AP.log.length > 99 ? '99+' : AP.log.length}</u>` : ''}</button>`).join('')}</div>`;

  /* --- تبويب العمليات --- */
  function reqList() {
    const L = (window.MX && MX.abuys) || [];
    if (!L.length) return '';
    const st = { pending: ['بانتظار الموافقة', 'wt'], approved: ['تمت الموافقة', 'ok'], rejected: ['مرفوض', 'no'] };
    return `<div class="reqs" style="margin-top:12px"><b style="font-size:.9rem">طلباتي إلى الإدارة</b>${L.map((r) => `<div class="rq"><div><b>${nf(r.pts)} نقطة</b><small>${nf(r.iqd)} دينار · ${E(new Date(r.t).toLocaleString('ar-IQ'))}${r.note ? ' · ' + E(r.note) : ''}</small></div><span class="tag ${(st[r.st] || ['', 'no'])[1]}">${(st[r.st] || [r.st])[0]}</span></div>`).join('')}</div>`;
  }
  function opsHtml() {
    const acc = Math.floor(+S.pts || 0);
    return `
    <div class="pan"><h3><i>${I('send')}</i>شحن رصيد عضو</h3><div class="sub">يُخصم من رصيد وكالتك ويُضاف لرصيد العضو فوراً.</div>
      <input id="agm" dir="ltr" name="agm-find" placeholder="رمز إحالة العضو (أو بريده / اسمه)" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
      <div id="agres"></div>
      <input id="agn" type="number" inputmode="numeric" min="1" placeholder="عدد النقاط">
      <button class="btn" data-ag="chg">شحن الرصيد</button></div>

    <div class="pan"><h3><i>${I('wallet')}</i>تحويل نقاط من حسابي إلى الوكالة</h3>
      <div class="sub">حوّل ما تريد من نقاط حسابك (أو كلها) إلى رصيد وكالتك لتشحن به الأعضاء. سيولة الإدارة تبقى كما هي وتُضاف إليها.</div>
      <div class="accbox"><div><small>النقاط الموجودة في حسابك</small><b id="apacc">${nf(acc)}<span>نقطة</span></b></div><button type="button" class="mini g" data-ap="topall" ${acc > 0 ? '' : 'disabled style="opacity:.5"'}>تحويل الكل</button></div>
      <div class="pcts">${[25, 50, 75, 100].map((p) => `<button type="button" class="pc" data-ap="pct" data-v="${p}">${p === 100 ? 'الكل' : p + '٪'}</button>`).join('')}</div>
      <input id="apt" type="number" inputmode="numeric" min="1" placeholder="عدد النقاط المراد تحويلها من حسابك">
      <div class="pv" id="aptv"></div>
      <button class="btn" data-ap="topup" id="aptb">تحويل إلى رصيد الوكالة</button></div>

    <div class="pan"><h3><i>${I('cart')}</i>شراء نقاط بالسعر الرسمي</h3>
      <div class="sub">السعر الرسمي: <b class="cy">${nf(agOff())} دينار / 1000 نقطة</b> (المليون = ${nf(agOff() * 1000)} دينار = ${(() => { try { return iq2usd(agOff() * 1000); } catch (e) { return ''; } })()}) · بدون سقف للشراء</div>
      <input id="agb" type="number" inputmode="numeric" min="1" placeholder="عدد النقاط المطلوبة"><div id="agbm" class="pv"></div>
      <button class="btn" data-a="mxagbuy">تقديم طلب للإدارة</button>
      <div class="sub" style="margin:8px 0 0">يصل طلبك إلى الإدارة، وعند الموافقة تُشحن سيولتك بالنقاط المطلوبة فوراً.</div>${reqList()}</div>`;
  }

  /* --- تبويب السجل --- */
  const faceHtml = (it) => {
    const m = KIND[it.k] || ['', 'in', 'user'];
    if (m[2] === 'sys') return `<span class="av sys">${I('shield', 20)}</span>`;
    if (m[2] === 'me') return S.av && /^data:image\//.test(S.av) ? `<span class="av me" style="background-image:url('${SAFE_SRC(S.av)}')"></span>` : `<span class="av me">${I('wallet', 20)}</span>`;
    const nm = (it.name || it.email || '?').trim().charAt(0).toUpperCase();
    if (it.uid && it.av) return `<span class="av" style="background-image:url('/api/soc/avatar/${E(it.uid)}?v=${it.av}');color:transparent">${E(nm)}</span>`;
    if (it.email && window.MX && MX.av && MX.av[String(it.email).toLowerCase()]) return `<span class="av" style="background-image:url('/api/m/avatar?e=${encodeURIComponent(String(it.email).toLowerCase())}&v=${MX.av[String(it.email).toLowerCase()]}');color:transparent">${E(nm)}</span>`;
    return `<span class="av">${E(nm)}</span>`;
  };
  const dayKey = (t) => { const d = new Date(t), n = new Date(), y = new Date(Date.now() - 86400000); const s = (x) => x.toDateString(); return s(d) === s(n) ? 'اليوم' : s(d) === s(y) ? 'أمس' : d.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }); };
  function logItems() {
    const g = GROUP[AP.flt]; return AP.log.filter((x) => !g || g.includes(x.k));
  }
  function logHtml() {
    if (!AP.loaded) return '<div class="sk"></div><div class="sk"></div><div class="sk"></div>';
    const L = logItems();
    if (!L.length) return `<div class="empty">${AP.log.length ? 'لا توجد عمليات في هذا التصنيف' : 'لا توجد عمليات بعد.<br>ستظهر هنا فوراً كل عملية شحن وكل نقاط تصلك من الإدارة.'}</div>`;
    let last = '', out = '';
    L.slice(0, AP.shown).forEach((it) => {
      const m = KIND[it.k] || [it.k, 'in', 'user'], k = dayKey(it.ts);
      if (k !== last) { out += `<div class="day">${E(k)}</div>`; last = k; }
      const dirIn = m[1] === 'in' || (m[1] === 'sign' && it.pts > 0), sign = dirIn ? '+' : '−', amt = Math.abs(it.pts);
      const who = m[2] === 'sys' ? 'الإدارة' : m[2] === 'me' ? 'من حسابي' : (it.name || it.email || 'مستخدم');
      const sub = m[2] === 'user' && it.code ? `<button type="button" class="cd" data-ap="copy" data-v="${E(it.code)}" aria-label="نسخ رمز الإحالة">${E(it.code)} ${I('copy', 11)}</button>` : '';
      const note = m[2] === 'user' ? (it.email ? `<small dir="ltr" style="text-align:start">${E(it.email)}</small>` : '') : (it.note ? `<small>${E(it.note)}</small>` : '');
      out += `<div class="lg">${faceHtml(it)}<div class="mid"><b>${E(who)}</b>${sub ? `<div style="margin:2px 0">${sub}</div>` : ''}${note}<small>${E(new Date(it.ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }))}</small></div><div class="amt"><b class="${dirIn ? 'in' : 'out'}">${sign}${nf(amt)}</b><span>${m[0]}</span></div></div>`;
    });
    if (L.length > AP.shown) out += `<button type="button" class="mini more" data-ap="more">عرض المزيد (${nf(L.length - AP.shown)})</button>`;
    return out;
  }
  function logTab() {
    const cnt = (k) => (GROUP[k] ? AP.log.filter((x) => GROUP[k].includes(x.k)).length : AP.log.length);
    return `<div class="pan"><div class="hd2"><h3 style="margin:0"><i>${I('list')}</i>سجل العمليات</h3><span class="live"><span class="dot ${AP.live ? 'on' : ''}"></span>مباشر</span></div>
      <div class="sub">كل التحويلات والنقاط التي تصلك من الإدارة، مع اسم المستخدم ورمز إحالته وصورته.</div>
      <div class="flt">${[['all', 'الكل'], ['sold', 'شحن الأعضاء'], ['admin', 'من الإدارة'], ['inc', 'واردة']].map(([k, t]) => `<button type="button" class="fb ${AP.flt === k ? 'on' : ''}" data-ap="flt" data-v="${k}">${t} · ${cnt(k)}</button>`).join('')}</div>
      <div id="aplog">${logHtml()}</div></div>`;
  }

  /* --- تبويب معلومات الوكالة --- */
  const methodsOf = () => {
    const saved = ((window.MX && MX.agents && MX.agents[myEmail()]) || {}).m || [];
    return agPayList().map((x) => { const s = saved.find((y) => y.n === x.n); return { n: x.n, on: s ? !!s.on : false, v: s ? s.v : '' }; });
  };
  const descOf = () => (((window.MX && MX.agents && MX.agents[myEmail()]) || {}).d || '');
  function infoTab() {
    if (AP.edit) {
      const d = AP.draft || { d: descOf(), m: methodsOf() };
      return `<div class="pan"><h3><i>${I('edit')}</i>تعديل معلومات الوكالة</h3><div class="sub">فعّل طرق الدفع التي تستلم عليها واكتب رقمك. تظهر للمشترين عند فتح معلومات وكالتك.</div>
        <span class="mu" style="font-size:.85rem">وصف الوكالة (اكتب ما تحب)</span>
        <textarea id="apd" rows="5" maxlength="1500" placeholder="ساعات العمل، الشروط، طريقة التعامل...">${E(d.d)}</textarea>
        ${d.m.map((x, i) => `<div class="sw"><label><input type="checkbox" id="apon_${i}" ${x.on ? 'checked' : ''}><span>${E(x.n)}</span></label><input type="text" id="apv_${i}" dir="ltr" placeholder="رقم الحساب / المحفظة" value="${E(x.v)}" maxlength="60"></div>`).join('')}
        <div class="acts"><button class="btn" data-ap="save">حفظ</button><button class="btn o" data-ap="cancel">إلغاء</button></div></div>`;
    }
    const d = descOf(), on = methodsOf().filter((x) => x.on);
    return `<div class="pan"><div class="hd2"><h3 style="margin:0"><i>${I('store')}</i>معلومات الوكالة</h3><button type="button" class="mini" data-ap="edit">${I('edit', 14)} تعديل</button></div>
      <div class="sub">هكذا تظهر معلومات وكالتك للمشترين عند فتح ملفك في قائمة الوكلاء.</div>
      <b style="font-size:.9rem">وصف الوكالة</b>
      ${d ? `<div class="desc">${E(d)}</div>` : `<div class="empty" style="padding:14px 6px">لم تضف وصفاً بعد — اضغط «تعديل» لإضافته.</div>`}
      <b style="font-size:.9rem">طرق الدفع</b>
      ${on.length ? on.map((x) => `<div class="meth"><span class="ok">${I('check', 14)}</span><b>${E(x.n)}</b><span class="nm">${E(x.v)}</span><button type="button" class="chip" data-ap="copy" data-v="${E(x.v)}" aria-label="نسخ">${I('copy', 13)}</button></div>`).join('') : `<div class="empty" style="padding:14px 6px">لم تفعّل أي طريقة دفع بعد — اضغط «تعديل» لتفعيلها.</div>`}
    </div>`;
  }

  /* ---------------- الصفحة ---------------- */
  V.agdash = function () {
    const a = myAg(); if (!a) return V.home();
    const body = AP.tab === 'log' ? logTab() : AP.tab === 'info' ? infoTab() : opsHtml();
    return hd('لوحة الوكيل', 'store', { back: 'home' }) +
      `<div class="agp" id="mxag"><div id="aphero">${heroHtml()}</div><div id="apkpi">${kpis()}</div>${tabsHtml()}<div id="apbody">${body}</div>
      <a class="sup" href="https://wa.me/${typeof AGWA !== 'undefined' ? AGWA : '9647764100065'}?text=${encodeURIComponent('دعم الوكلاء — ' + (a.o[0] || ''))}" target="_blank" rel="noopener">${I('chat', 18)} الدعم المباشر للوكلاء</a></div>`;
  };

  /* تحديث الأجزاء الحيّة بدون إعادة رسم الصفحة (حتى لا يضيع ما يكتبه الوكيل) */
  function patch() {
    if (S.r !== 'agdash') return;
    const h = document.querySelector('#aphero'); if (h) h.innerHTML = heroHtml();
    const k = document.querySelector('#apkpi'); if (k) k.innerHTML = kpis();
    const l = document.querySelector('#aplog'); if (l) l.innerHTML = logHtml();
    const t = document.querySelector('.agp .tabs'); if (t) t.outerHTML = tabsHtml();
    const ac = document.querySelector('#apacc'); if (ac) ac.innerHTML = nf(Math.floor(+S.pts || 0)) + '<span>نقطة</span>';
  }
  function liveUi() {
    const d = document.querySelector('#apdot'), t = document.querySelector('#aplivetx');
    if (d) d.className = 'dot ' + (AP.live ? 'on' : ''); if (t) t.textContent = liveText();
    document.querySelectorAll('.agp .live .dot').forEach((x) => { x.className = 'dot ' + (AP.live ? 'on' : ''); });
  }

  /* ---------------- المزامنة مع الخادم ---------------- */
  async function pull(force) {
    const me = id(); if (S.r !== 'agdash' || !me || !myAg()) return;
    if (AP.busy || (!force && Date.now() - AP.at < 1200)) return;
    AP.busy = true;
    try {
      const j = await post('/api/m/agent/log', { ...me, limit: 300 });
      AP.at = Date.now();
      // الخادم هو المصدر: تثبيت السيولة محلياً
      let ch = false; const a = myAg();
      if (a && j.agent && (AG[a.i][4] !== j.agent.liq || (+AG[a.i][9] || 0) !== j.agent.off)) { AG[a.i][4] = j.agent.liq; AG[a.i][9] = j.agent.off; try { LSset('agents', AG); } catch (e) {} ch = true; }
      const sig = JSON.stringify([(j.items || []).length, (j.items[0] || {}).id, j.sum, j.agent]);
      if (sig !== AP.sig || !AP.loaded || ch) { AP.sig = sig; AP.log = j.items || []; AP.sum = j.sum || {}; AP.chart = j.chart || []; AP.loaded = true; patch(); }
      else liveUi();
      AP.loaded = true;
    } catch (e) { if (!AP.loaded) { AP.loaded = true; AP.log = []; patch(); } }
    AP.busy = false;
  }
  let es = null, esFor = '', poll = 0;
  function startLive() {
    const e = myEmail(); if (!e || !('EventSource' in window)) return;
    if (es && esFor === e) return; stopLive();
    try {
      es = new EventSource('/api/m/agent/stream?e=' + encodeURIComponent(e)); esFor = e;
      es.onopen = () => { AP.live = true; liveUi(); pull(true); };
      es.onerror = () => { AP.live = false; liveUi(); };
      es.addEventListener('ping', () => pull(true));
    } catch (x) {}
  }
  function stopLive() { if (es) { try { es.close(); } catch (e) {} } es = null; esFor = ''; AP.live = false; }
  setInterval(() => {
    if (S.r !== 'agdash') { if (es) stopLive(); return; }
    if (document.hidden) return;
    poll++; if (!AP.live || poll % 3 === 0) pull(true);
  }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.r === 'agdash') { startLive(); pull(true); } });

  const _draw = window.draw;
  window.draw = function () {
    const r = _draw.apply(this, arguments);
    try { if (S.r === 'agdash') { startLive(); pull(false); } else if (es) stopLive(); } catch (e) {}
    return r;
  };

  /* ---------------- الإجراءات ---------------- */
  const copy = (t) => { t = String(t || ''); if (!t) return; const ok = () => say('تم النسخ'); try { navigator.clipboard.writeText(t).then(ok, () => { fb(t); ok(); }); } catch (e) { fb(t); ok(); } };
  const fb = (t) => { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); } catch (e) {} x.remove(); };

  function grabDraft() {
    const g = (s) => document.querySelector(s); if (!AP.edit || !g('#apd')) return;
    AP.draft = { d: g('#apd').value, m: methodsOf().map((x, i) => ({ n: x.n, on: !!(g('#apon_' + i) || {}).checked, v: ((g('#apv_' + i) || {}).value || '').trim() })) };
  }
  async function saveInfo() {
    const me = id(); if (!me) return say('سجّل الدخول أولاً');
    grabDraft(); const d = AP.draft; if (!d) return;
    if (d.m.some((x) => x.on && !x.v)) return say('اكتب الرقم أمام كل طريقة مفعّلة');
    try {
      await post('/api/m/agent/save', { ...me, description: d.d, methods: d.m.map((x) => ({ n: x.n, on: x.on ? 1 : 0, v: x.v })) });
      if (window.MX) { MX.agents = MX.agents || {}; MX.agents[myEmail()] = { d: d.d.trim().slice(0, 1500), m: d.m.map((x) => ({ n: x.n, on: x.on ? 1 : 0, v: x.v })) }; }
      AP.edit = false; AP.draft = null; say('تم حفظ معلومات الوكالة'); draw();
      try { window.mxPoll && window.mxPoll(true); } catch (e) {}
    } catch (e) { say(e.message); }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function topup(all) {
    if (AP.topBusy) return; const me = id(), a = myAg(); if (!me || !a) return;
    const have = Math.floor(+S.pts || 0);
    const n = all ? have : Math.floor(+((document.querySelector('#apt') || {}).value || 0));
    if (!(n > 0)) return say(all ? 'لا توجد نقاط في حسابك' : 'أدخل عدد النقاط');
    if (n > have) return say('رصيد حسابك لا يكفي، المتاح ' + nf(have));
    if (!confirm('تحويل ' + nf(n) + ' نقطة من حسابك إلى رصيد الوكالة؟\nتُستخدم لشحن الأعضاء ولا تعود إلى حسابك.')) return;
    AP.topBusy = true; const btn = document.querySelector('#aptb'); if (btn) btn.disabled = true;
    try {
      let j;
      try { j = await post('/api/m/agent/topup', { ...me, pts: n }); }
      catch (e) { // الرصيد على الخادم متأخر قليلاً: نزامنه ونعيد المحاولة مرة واحدة
        if (e.status !== 409) throw e;
        try { syncReport(); } catch (x) {} await sleep(2200);
        j = await post('/api/m/agent/topup', { ...me, pts: n });
      }
      S.pts -= n;
      try { lrs('تحويل إلى رصيد الوكالة', 'الوكيل: ' + a.o[0] + ' · ' + nf(n) + ' نقطة'); txlog('تحويل إلى رصيد الوكالة', n, 'out'); save(); } catch (e) {}
      const k = myAg(); if (k) { AG[k.i][4] = j.liq; AG[k.i][9] = j.off; try { LSset('agents', AG); } catch (e) {} }
      say('تم تحويل ' + nf(n) + ' نقطة إلى رصيد الوكالة'); AP.sig = ''; draw(); pull(true);
    } catch (e) { say(e.message); }
    AP.topBusy = false; const b2 = document.querySelector('#aptb'); if (b2) b2.disabled = false;
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-ap]'); if (!t || S.r !== 'agdash') return;
    ev.preventDefault(); ev.stopPropagation();
    const k = t.dataset.ap, v = t.dataset.v;
    if (k === 'tab') { grabDraft(); AP.tab = v; draw(); }
    else if (k === 'flt') { AP.flt = v; AP.shown = 40; const l = document.querySelector('#aplog'); if (l) { l.innerHTML = logHtml(); document.querySelectorAll('.agp .fb').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); } }
    else if (k === 'more') { AP.shown += 40; const l = document.querySelector('#aplog'); if (l) l.innerHTML = logHtml(); }
    else if (k === 'copy') copy(v);
    else if (k === 'edit') { AP.edit = true; AP.draft = null; draw(); }
    else if (k === 'cancel') { AP.edit = false; AP.draft = null; draw(); }
    else if (k === 'save') saveInfo();
    else if (k === 'pct') { const i = document.querySelector('#apt'); if (i) { i.value = Math.floor((+S.pts || 0) * (+v) / 100) || ''; i.dispatchEvent(new Event('input', { bubbles: true })); } }
    else if (k === 'topall') topup(true);
    else if (k === 'topup') topup(false);
  }, true);

  document.addEventListener('input', (ev) => {
    const t = ev.target; if (!t || S.r !== 'agdash') return;
    if (t.id === 'apt') {
      const n = Math.floor(+t.value || 0), pv = document.querySelector('#aptv'), v = vals(); if (!pv) return;
      pv.innerHTML = n > 0 ? (n > (+S.pts || 0) ? '<span style="color:var(--r)">رصيد حسابك لا يكفي</span>' : 'رصيد حسابك بعد التحويل: <b>' + nf((+S.pts || 0) - n) + '</b> · رصيد الوكالة: <b>' + nf(v.tot + n) + '</b>') : '';
    } else if (t.id === 'apd' || /^ap(on|v)_/.test(t.id)) grabDraft();
  }, true);
  document.addEventListener('change', (ev) => { const t = ev.target; if (t && /^apon_/.test(t.id)) grabDraft(); }, true);

  // سبق أن رُسمت الصفحة بالتصميم القديم قبل تحميل هذا الملف
  try { if (S.r === 'agdash') draw(); } catch (e) {}
})();

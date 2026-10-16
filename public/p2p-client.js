/* واجهة شراء النقاط P2P — طبقة مستقلة بالكامل تُفتح عند الضغط على «شراء نقاط P2P» (لا تغيّر أي كود آخر في التطبيق) */
(function () {
  'use strict';
  const NF = (n) => Math.floor(Number(n) || 0).toLocaleString('en');
  const N2 = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString('en', { maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (e) { return null; } };
  const dtf = (t) => new Date(t).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' });

  async function api(path, body) {
    const m = me(); if (!m) throw new Error('سجّل الدخول أولاً');
    const r = await fetch('/api/p2p/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, m, { cl: (function () { try { return (S.cl || []).map((x) => ({ i: x.i, e: x.e })); } catch (e) { return undefined; } })() }, body || {})) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال بالخادم');
    return j;
  }
  const shrink = (file, max = 1400) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      let m = max, q = 0.78, out = '';
      for (let i = 0; i < 5; i++) {
        const k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q); if (out.length < 1.5e6) break; m = Math.round(m * 0.75); q = Math.max(0.5, q - 0.08);
      }
      ok(out);
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  /* ---------------- التنسيق ---------------- */
  const css = document.createElement('style');
  css.textContent = `
#ppo{position:fixed;inset:0;z-index:10000;display:none;flex-direction:column;background:#0E1621;color:#e8f1f6;font-family:Cairo,Tahoma,sans-serif;direction:rtl;--ac:#2bcfe2;--bd:#27566b;--cd:#1F2A37;--mu:#8aa3b3}
#ppo.on{display:flex}#ppo *{box-sizing:border-box}
#ppo .hd{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;border-bottom:1px solid #ffffff10;background:#0E1621f2}
#ppo .hd h1{margin:0;font-size:1.15rem;flex:1;font-weight:700}
#ppo .ib{width:40px;height:40px;border-radius:12px;border:1.5px solid var(--bd);background:hsl(193 58% 18%);color:var(--ac);display:grid;place-items:center;cursor:pointer;padding:0;font:inherit}
#ppo svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ppb{flex:1;overflow:auto;padding:14px 14px 24px;max-width:760px;width:100%;margin:0 auto}
#ppo .tabs{display:flex;border-top:1px solid #ffffff12;background:#101c28;padding-bottom:env(safe-area-inset-bottom,0px)}
#ppo .tabs button{flex:1;border:0;background:none;color:var(--mu);font:inherit;font-size:.74rem;padding:9px 2px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;position:relative}
#ppo .tabs button.on{color:var(--ac)}#ppo .tabs i{position:absolute;top:4px;inset-inline-start:calc(50% + 6px);background:#ef5350;color:#fff;border-radius:99px;font-style:normal;font-size:.62rem;min-width:16px;padding:0 4px;text-align:center}
#ppo .c{background:var(--cd);border:1.5px solid var(--bd);border-radius:20px;padding:14px;margin-bottom:12px}
#ppo .c.tap{cursor:pointer}
#ppo .rw{display:flex;align-items:center;gap:10px}#ppo .sp{flex:1;min-width:0}#ppo .wr{flex-wrap:wrap}
#ppo .mu{color:var(--mu);font-size:.8rem}#ppo .ac{color:var(--ac)}#ppo b{font-weight:700}
#ppo .btn{border:0;border-radius:14px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer;background:linear-gradient(90deg,#00b6d4,#2bcfe2);color:#04222a;width:100%}
#ppo .btn.s{padding:8px 14px;width:auto;font-size:.85rem}#ppo .btn.o{background:none;border:1.5px solid var(--bd);color:var(--ac)}
#ppo .btn.r{background:#ef5350;color:#fff}#ppo .btn.g{background:#22b573;color:#fff}#ppo .btn[disabled]{opacity:.5;pointer-events:none}
#ppo input,#ppo select,#ppo textarea{width:100%;background:#0E1621;border:1.5px solid var(--bd);border-radius:12px;color:#fff;font:inherit;padding:11px 12px;margin-top:5px}
#ppo textarea{resize:none}#ppo label{display:block;font-size:.82rem;color:var(--mu);margin-top:10px}
#ppo .av{width:44px;height:44px;border-radius:50%;background:hsl(193 55% 20%);color:var(--ac);display:grid;place-items:center;font-weight:800;overflow:hidden;flex:none;background-size:cover;background-position:center}
#ppo .av.l{width:64px;height:64px;font-size:1.5rem}
#ppo .lv{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:700;padding:2px 9px 2px 8px;border-radius:99px;border:1px solid currentColor}
#ppo .lv svg{width:13px;height:13px;stroke-width:2.4}
#ppo .lv.bronze{color:#e0925a;background:#cd7f3220}#ppo .lv.silver{color:#d5dde5;background:#c0c8d020}#ppo .lv.gold{color:#ffd34d;background:#ffd34d1f}#ppo .lv.trusted{color:#2bcfe2;background:#2bcfe21f}
#ppo .chip{display:inline-block;font-size:.72rem;padding:3px 10px;border-radius:99px;background:#ffffff0f;border:1px solid #ffffff14;color:#cfe3ee}
#ppo .fl{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}#ppo .fl::-webkit-scrollbar{display:none}
#ppo .fl button{flex:none;border:1.5px solid var(--bd);background:none;color:var(--ac);border-radius:99px;padding:6px 14px;font:inherit;font-size:.8rem;cursor:pointer}
#ppo .fl button.on{background:var(--ac);color:#04222a}
#ppo .pr{font-size:1.35rem;font-weight:800;color:var(--ac)}
#ppo .st{display:inline-block;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:99px}
#ppo .st.awaiting_payment{background:#ffb30026;color:#ffb300}#ppo .st.proof_submitted{background:#2bcfe226;color:#2bcfe2}#ppo .st.completed{background:#22b57326;color:#3ad98f}
#ppo .st.rejected,#ppo .st.expired,#ppo .st.cancelled{background:#ef535026;color:#ff7a77}#ppo .st.disputed{background:#b57bff26;color:#c79bff}
#ppo .gd{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#ppo .kp{background:#0E1621;border-radius:14px;padding:10px 6px;text-align:center}
#ppo .kp b{display:block;font-size:1.05rem}#ppo .kp span{font-size:.7rem;color:var(--mu)}
#ppo .hero{background:linear-gradient(135deg,hsl(187 67% 30%),hsl(200 70% 18%));border-color:hsl(187 63% 45%)}
#ppo .note{display:flex;gap:9px;align-items:flex-start;background:#0f2a33;border:1px solid var(--bd);border-radius:14px;padding:10px 12px;font-size:.8rem;color:#a8e6ef;margin-bottom:12px}
#ppo .note svg{flex:none;margin-top:2px}#ppo .warn{background:#3a2a0b;border-color:#6b4d12;color:#ffd27a}
#ppo .stp{display:flex;align-items:center;margin:4px 0 14px}#ppo .stp div{flex:1;text-align:center;font-size:.7rem;color:var(--mu);position:relative}
#ppo .stp div i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;margin:0 auto 4px;background:#0E1621;border:2px solid var(--bd);font-style:normal;font-size:.75rem}
#ppo .stp div.on{color:var(--ac)}#ppo .stp div.on i{background:var(--ac);color:#04222a;border-color:var(--ac)}#ppo .stp div.bad i{background:#ef5350;border-color:#ef5350;color:#fff}
#ppo .stp div:not(:last-child)::after{content:'';position:absolute;top:13px;inset-inline-end:-50%;width:100%;height:2px;background:var(--bd);z-index:0}#ppo .stp div i{position:relative;z-index:1}
#ppo .bx{background:#0E1621;border:1px dashed var(--bd);border-radius:14px;padding:10px 12px;margin-top:8px}
#ppo .cp{border:0;background:#2bcfe220;color:var(--ac);border-radius:9px;padding:4px 10px;font:inherit;font-size:.74rem;cursor:pointer}
#ppo .stars{display:flex;gap:4px;direction:ltr;justify-content:center;margin:8px 0}#ppo .stars button{border:0;background:none;font-size:2rem;color:#4a5a68;cursor:pointer;padding:0}#ppo .stars button.on{color:#ffc107}
#ppo .sg{color:#ffc107;letter-spacing:1px}
#ppo .ch{display:flex;flex-direction:column;height:100%}#ppo .ms{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;padding:4px 2px}
#ppo .mb{max-width:80%;padding:8px 12px;border-radius:16px;font-size:.88rem;word-break:break-word;white-space:pre-wrap}
#ppo .mb.m{align-self:flex-start;background:linear-gradient(90deg,#00a6c4,#1fb8cf);color:#04222a;border-end-start-radius:4px}
#ppo .mb.o{align-self:flex-end;background:#243445;border-end-end-radius:4px}#ppo .mb.s{align-self:center;background:#ffffff0d;color:var(--mu);font-size:.74rem;text-align:center;max-width:92%;border-radius:12px}
#ppo .mb img{max-width:200px;border-radius:10px;display:block;margin-top:4px}#ppo .mb small{display:block;opacity:.6;font-size:.62rem;margin-top:3px}
#ppo .ci{display:flex;gap:6px;padding-top:8px;align-items:flex-end}#ppo .ci textarea{margin:0;flex:1;max-height:100px}
#ppo .ov{position:fixed;inset:0;background:#000a;z-index:10001;display:flex;align-items:flex-end;justify-content:center}
#ppo .sh{background:#162230;border-radius:24px 24px 0 0;width:100%;max-width:560px;max-height:92%;overflow:auto;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));border:1.5px solid var(--bd);border-bottom:0}
#ppo .em{text-align:center;color:var(--mu);padding:30px 10px}
#ppo .mrow{border:1px solid var(--bd);border-radius:14px;padding:10px;margin-top:8px;background:#0E1621}
#ppo .ck{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1.5px solid var(--bd);border-radius:12px;margin-top:6px;cursor:pointer}
#ppo .ck.on{border-color:var(--ac);background:#2bcfe214}#ppo .ck input{width:auto;margin:0}
#ppo img.pf{width:100%;border-radius:12px;margin-top:8px;max-height:340px;object-fit:contain;background:#000}
`;
  document.head.appendChild(css);

  const ICON = {
    back: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>', store: '<path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>', send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24">${ICON[n] || ''}</svg>`;
  const LV = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', trusted: 'موثوق' };
  const lv = (k) => k ? `<span class="lv ${k}">${ic('shield')}${LV[k] || k}</span>` : '';
  const stars = (a) => a == null ? '<span class="mu">بلا تقييم</span>' : `<span class="sg">★</span> <b>${N2(a)}</b>`;
  const avatar = (u, big) => u && u.av ? `<div class="av ${big ? 'l' : ''}" style="background-image:url('/api/soc/avatar/${esc(u.uid)}?v=${u.av}')"></div>` : `<div class="av ${big ? 'l' : ''}">${esc((u && u.name || '؟').trim().charAt(0))}</div>`;
  const ST = { awaiting_payment: 'بانتظار الدفع', proof_submitted: 'قيد تدقيق الإدارة', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي', disputed: 'قيد التحقيق' };
  const pct = (r) => r == null ? '—' : Math.round(r * 100) + '٪';

  /* ---------------- الحالة ---------------- */
  const P = { on: false, tab: 'market', nav: [], view: 'market', arg: null, home: null, filt: 'all', skew: 0, busy: false, chatUid: '', chatLast: 0, chatMsgs: [], sig: '' };
  let root, body, title, tabsEl, timers = [];
  const clearT = () => { timers.forEach(clearInterval); timers = []; };
  const every = (fn, ms) => { timers.push(setInterval(() => { if (P.on && !document.hidden) fn().catch(() => {}); }, ms)); };

  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'ppo';
    root.innerHTML = `<div class="hd"><button class="ib" id="ppback" aria-label="رجوع" style="display:none">${ic('back')}</button><h1 id="ppt">شراء نقاط P2P</h1><button class="ib" id="ppx" aria-label="إغلاق">${ic('x')}</button></div>
<div id="ppb"></div>
<div class="tabs" id="ppt2"><button data-t="market">${ic('store')}السوق</button><button data-t="orders">${ic('list')}طلباتي</button><button data-t="seller">${ic('shield')}بائع</button><button data-t="chat">${ic('chat')}الدردشة</button></div>`;
    document.body.appendChild(root);
    body = $('#ppb', root); title = $('#ppt', root); tabsEl = $('#ppt2', root);
    $('#ppx', root).onclick = close;
    $('#ppback', root).onclick = back;
    tabsEl.onclick = (e) => { const b = e.target.closest('button[data-t]'); if (b) { P.nav = []; go(b.dataset.t, null, false); } };
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', (e) => { if (e.target.id === 'ppci' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); act('csend'); } });
  }

  function open() {
    if (typeof CFG !== 'undefined' && CFG.hp2p) return say('هذا القسم غير متاح حالياً');
    if (!me()) return say('سجّل الدخول أولاً');
    try { const d = $('#d'); if (d && d.open) d.close(); } catch (e) {}
    build(); P.on = true; root.classList.add('on'); document.documentElement.style.overflow = 'hidden';
    P.nav = []; go('market', null, false);
  }
  function close() { P.on = false; clearT(); if (root) root.classList.remove('on'); document.documentElement.style.overflow = ''; }
  function back() { const p = P.nav.pop(); if (!p) return go(P.tab, null, false); go(p.v, p.a, false); }
  const ROOT = { market: 'السوق', orders: 'طلباتي', seller: 'لوحة البائع', chat: 'الدردشة' };

  function go(v, arg, push) {
    if (push !== false) P.nav.push({ v: P.view, a: P.arg });
    P.view = v; P.arg = arg; P.sig = '';
    if (ROOT[v]) P.tab = v;
    clearT(); closeSheet();
    const isRoot = !!ROOT[v];
    $('#ppback', root).style.display = isRoot ? 'none' : '';
    tabsEl.style.display = v === 'chatroom' ? 'none' : '';
    [...tabsEl.children].forEach((b) => b.classList.toggle('on', b.dataset.t === P.tab));
    title.textContent = { market: 'شراء نقاط P2P', orders: 'طلباتي', seller: 'لوحة البائع', chat: 'الدردشة', profile: 'ملف البائع', order: 'تفاصيل الطلب #' + (arg || ''), chatroom: 'محادثة', adform: arg && arg.id ? 'تعديل الإعلان' : 'إعلان جديد', apply: 'التسجيل كبائع', methods: 'طرق الدفع' }[v] || 'P2P';
    body.scrollTop = 0; body.innerHTML = '<div class="em">جارٍ التحميل...</div>';
    VIEWS[v]().catch((e) => { body.innerHTML = `<div class="em">${esc(e.message)}<br><br><button class="btn s o" data-p="retry">إعادة المحاولة</button></div>`; });
  }

  /* ---------------- الشاشات ---------------- */
  const VIEWS = {
    async market() {
      const draw = async () => {
        const j = await api('home'); P.home = j; P.skew = (j.now || Date.now()) - Date.now();
        setBadge(j.me && j.me.unread);
        if (P.view !== 'market') return;
        if (!j.enabled) { body.innerHTML = '<div class="em">نظام P2P متوقف حالياً</div>'; return; }
        const c = j.cfg, ty = {};
        j.ads.forEach((a) => a.methods.forEach((m) => { ty[m.type] = m.label; }));
        let ads = j.ads.filter((a) => P.filt === 'all' || a.methods.some((m) => m.type === P.filt));
        const sig = JSON.stringify([ads.map((a) => [a.id, a.avail, a.price]), P.filt]);
        if (sig === P.sig) return; P.sig = sig;
        body.innerHTML = `<div class="c hero"><div class="rw"><div class="sp"><div class="mu" style="color:#bfeaf2">السعر الرسمي لكل 1000 نقطة</div><div class="pr" style="color:#fff">${N2(c.official)} <small style="font-size:.8rem">د.ع</small></div></div>
<div style="text-align:left"><div class="mu" style="color:#bfeaf2">نطاق الإعلانات المسموح</div><b>${N2(c.min)} – ${N2(c.max)}</b></div></div></div>
<div class="note">${ic('shield')}<span>نقاط البائع محجوزة في ضمان التطبيق. ادفع للبائع، ثم أرفق صورة التحويل، وتُضاف النقاط لرصيدك بعد تدقيق الإدارة.</span></div>
<div class="fl"><button data-p="filt" data-v="all" class="${P.filt === 'all' ? 'on' : ''}">الكل</button>${Object.keys(ty).map((k) => `<button data-p="filt" data-v="${k}" class="${P.filt === k ? 'on' : ''}">${esc(ty[k])}</button>`).join('')}</div>
${ads.map(adCard).join('') || '<div class="em">لا توجد إعلانات متاحة حالياً</div>'}`;
      };
      await draw(); every(draw, 12000);
    },

    async profile() {
      const j = await api('seller/profile', { uid: P.arg }); const s = j.seller, st = s.stats, tot = j.dist.reduce((t, d) => t + d.n, 0);
      body.innerHTML = `<div class="c"><div class="rw">${avatar(s, 1)}<div class="sp"><div style="font-size:1.1rem;font-weight:800">${esc(s.name)}</div><div style="margin-top:4px">${lv(s.level)}</div><div class="mu" style="margin-top:4px">بائع منذ ${dtf(s.since).split(',')[0]}</div></div></div>
${s.bio ? `<p class="mu" style="margin:10px 0 0">${esc(s.bio)}</p>` : ''}
<div class="gd" style="margin-top:12px"><div class="kp"><b>${NF(st.done)}</b><span>صفقة ناجحة</span></div><div class="kp"><b>${pct(st.rate)}</b><span>نسبة الإتمام</span></div><div class="kp"><b>${st.avg == null ? '—' : N2(st.avg)} <span class="sg">★</span></b><span>${NF(st.n)} تقييم</span></div></div>
<div style="margin-top:12px" class="mu">طرق الدفع المقبولة</div><div style="margin-top:6px">${s.methods.map((m) => `<span class="chip">${esc(m.label)}</span>`).join(' ')}</div>
<button class="btn o" style="margin-top:14px" data-p="chat" data-v="${esc(s.uid)}">${ic('chat')} فتح دردشة مع البائع</button></div>
${tot ? `<div class="c"><b>توزيع التقييمات</b>${[5, 4, 3, 2, 1].map((k) => { const n = (j.dist.find((d) => d.stars === k) || {}).n || 0; return `<div class="rw" style="margin-top:7px"><span style="width:26px">${k}★</span><div style="flex:1;height:7px;background:#0E1621;border-radius:9px;overflow:hidden"><div style="width:${Math.round(n / tot * 100)}%;height:100%;background:#ffc107"></div></div><span class="mu" style="width:28px;text-align:left">${n}</span></div>`; }).join('')}</div>` : ''}
<div class="c"><b>تعليقات المشترين</b>${j.reviews.map((r) => `<div style="border-top:1px solid #ffffff10;margin-top:10px;padding-top:10px"><div class="rw"><span class="sg">${'★'.repeat(r.stars)}${'<span style="color:#4a5a68">' + '★'.repeat(5 - r.stars) + '</span>'}</span><span class="mu sp" style="text-align:left">${esc(r.name)} · ${dtf(r.t).split(',')[0]}</span></div>${r.comment ? `<div style="margin-top:4px;font-size:.88rem">${esc(r.comment)}</div>` : ''}</div>`).join('') || '<div class="mu" style="margin-top:8px">لا توجد تعليقات بعد</div>'}</div>`;
    },

    async orders() {
      const draw = async () => {
        const j = await api('orders'); if (P.view !== 'orders') return;
        const sig = JSON.stringify(j.orders.map((o) => [o.id, o.status, o.flag])); if (sig === P.sig) return; P.sig = sig;
        body.innerHTML = j.orders.map((o) => `<div class="c tap" data-p="order" data-v="${o.id}"><div class="rw"><b class="sp">${o.role === 'buyer' ? 'شراء من' : 'بيع إلى'} ${esc(o.other)}</b><span class="st ${o.status}">${ST[o.status]}</span></div>
<div class="rw" style="margin-top:8px"><div class="sp"><b class="ac">${NF(o.pts)}</b> <span class="mu">نقطة</span></div><b>${NF(o.iqd)} <span class="mu">د.ع</span></b></div><div class="mu" style="margin-top:4px;font-size:.74rem">#${o.id} · ${dtf(o.t)}</div></div>`).join('') || '<div class="em">لا توجد طلبات بعد</div>';
      };
      await draw(); every(draw, 8000);
    },

    async order() {
      const draw = async () => {
        const j = await api('order/get', { id: P.arg }); if (P.view !== 'order') return;
        P.skew = j.now - Date.now(); const o = j.order, ot = j.other;
        const sig = JSON.stringify([o.status, o.flag, o.rated, o.hasProof, o.note]); if (sig === P.sig) return; P.sig = sig;
        const buyer = o.role === 'buyer', m = o.method || {};
        const step = o.status === 'awaiting_payment' ? 1 : o.status === 'proof_submitted' || o.status === 'disputed' ? 2 : o.status === 'completed' ? 3 : 0;
        const bad = ['rejected', 'cancelled', 'expired'].includes(o.status);
        let h = `<div class="c"><div class="stp"><div class="on"><i>1</i>طلب</div><div class="${step >= 1 ? 'on' : ''}"><i>2</i>دفع</div><div class="${step >= 2 ? 'on' : ''}"><i>3</i>تدقيق</div><div class="${step >= 3 ? 'on' : bad ? 'bad' : ''}"><i>${bad ? '✕' : '✓'}</i>${bad ? ST[o.status] : 'اكتمل'}</div></div>
<div class="rw"><span class="st ${o.status}">${ST[o.status]}</span><span class="sp"></span>${o.status === 'awaiting_payment' ? `<span class="ac" style="font-weight:700">${ic('clock').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"')} <span data-exp="${o.exp}">--:--</span></span>` : ''}</div>
<div class="gd" style="margin-top:12px;grid-template-columns:1fr 1fr"><div class="kp"><b class="ac">${NF(o.pts)}</b><span>نقطة</span></div><div class="kp"><b>${NF(o.iqd)}</b><span>دينار عراقي (${N2(o.price)} / 1000 نقطة)</span></div></div>
${o.fee ? `<div class="mu" style="margin-top:6px">عمولة المنصة: ${NF(o.fee)} نقطة تُخصم من المستلَم</div>` : ''}</div>
<div class="c"><div class="rw">${avatar(ot, 0)}<div class="sp"><div class="mu">${buyer ? 'البائع' : 'المشتري'}</div><b>${esc(ot.name)}</b> ${buyer ? lv(ot.level) : ''}</div><button class="btn s o" data-p="chat" data-v="${esc(ot.uid)}" data-o="${o.id}">${ic('chat')} دردشة</button></div></div>`;
        if (o.note && (bad || o.status === 'completed' || o.status === 'disputed')) h += `<div class="note ${bad ? 'warn' : ''}">${ic('shield')}<span><b>ملاحظة الإدارة:</b> ${esc(o.note)}</span></div>`;
        if (buyer && o.status === 'awaiting_payment') {
          h += `<div class="c"><b>١. ادفع للبائع عبر ${esc(m.label || '')}</b>
<div class="bx"><div class="mu">المبلغ المطلوب</div><div class="rw"><b class="pr sp">${NF(o.iqd)} د.ع</b><button class="cp" data-p="copy" data-v="${o.iqd}">نسخ</button></div></div>
${m.holder ? `<div class="bx"><div class="mu">اسم صاحب الحساب</div><div class="rw"><b class="sp">${esc(m.holder)}</b><button class="cp" data-p="copy" data-v="${esc(m.holder)}">نسخ</button></div></div>` : ''}
${m.number ? `<div class="bx"><div class="mu">رقم الحساب / الهاتف${m.bank ? ' — ' + esc(m.bank) : ''}</div><div class="rw"><b class="sp" dir="ltr" style="text-align:right;letter-spacing:.5px">${esc(m.number)}</b><button class="cp" data-p="copy" data-v="${esc(m.number)}">نسخ</button></div></div>` : ''}
<div class="note warn" style="margin:12px 0 0">${ic('shield')}<span>حوّل المبلغ بالضبط، ولا تكتب أي شيء يخص التطبيق أو النقاط في ملاحظة التحويل.</span></div></div>
<div class="c"><b>٢. أرفق صورة التحويل</b><input type="file" id="ppf" accept="image/*" style="margin-top:8px"><img id="ppfv" class="pf" style="display:none"><button class="btn" style="margin-top:10px" data-p="proof" data-v="${o.id}">تأكيد الدفع وإرسال الصورة</button>
<button class="btn o" style="margin-top:8px" data-p="cancel" data-v="${o.id}">إلغاء الطلب</button></div>`;
        } else if (buyer && o.status === 'proof_submitted') {
          h += `<div class="note">${ic('clock')}<span>أُرسلت صورة التحويل للإدارة وهي قيد التدقيق. ستصلك النقاط فور الموافقة.</span></div><div class="c"><button class="btn o" data-p="seeproof" data-v="${o.id}">عرض صورة التحويل المرفقة</button><div id="ppim"></div><div class="mu" style="margin-top:10px">أخطأت بالصورة؟ يمكنك استبدالها:</div><input type="file" id="ppf" accept="image/*"><img id="ppfv" class="pf" style="display:none"><button class="btn s o" style="margin-top:8px" data-p="proof" data-v="${o.id}">استبدال الصورة</button></div>`;
        } else if (buyer && o.status === 'completed' && !o.rated) {
          h += `<div class="c"><b>قيّم تجربتك مع ${esc(ot.name)}</b><div class="stars" id="ppst">${[1, 2, 3, 4, 5].map((k) => `<button data-p="star" data-v="${k}">★</button>`).join('')}</div><textarea id="ppcm" rows="3" maxlength="300" placeholder="اكتب تعليقاً (اختياري)"></textarea><button class="btn" style="margin-top:10px" data-p="rate" data-v="${o.id}">إرسال التقييم</button></div>`;
        } else if (!buyer && ['awaiting_payment', 'proof_submitted'].includes(o.status)) {
          h += `<div class="c"><b>حسابك المختار للدفع</b><div class="bx"><div class="mu">${esc(m.label || '')}</div><b dir="ltr">${esc(m.number || '')}</b></div>
<div class="note" style="margin-top:12px">${ic('shield')}<span>تحقق من وصول المبلغ إلى حسابك. القرار النهائي بيد الإدارة ولن تُحرَّر النقاط قبل تدقيقها.</span></div>
${o.flag === 'received' ? '<div class="st completed">أكدت استلام المبلغ ✓</div>' : o.flag === 'dispute' ? '<div class="st disputed">اعترضت على الطلب</div>' : `<div class="rw"><button class="btn g s" style="flex:1" data-p="flag" data-v="${o.id}" data-f="received">استلمت المبلغ</button><button class="btn r s" style="flex:1" data-p="flag" data-v="${o.id}" data-f="dispute">لم يصل المبلغ</button></div>`}
${o.hasProof ? `<button class="btn o s" style="margin-top:8px;width:100%" data-p="seeproof" data-v="${o.id}">عرض صورة التحويل</button><div id="ppim"></div>` : ''}</div>`;
        } else if (o.status === 'completed') h += `<div class="note" style="color:#3ad98f">${ic('shield')}<span>اكتملت الصفقة بنجاح ✓</span></div>`;
        body.innerHTML = h; tick();
      };
      await draw(); every(draw, 5000); timers.push(setInterval(tick, 1000));
    },

    async seller() {
      const j = await api('seller/me'); P.sm = j; const s = j.seller;
      if (!s) {
        body.innerHTML = `<div class="c hero"><b style="font-size:1.1rem">اربح من بيع نقاطك</b><p style="margin:8px 0 0;color:#d6f3f8;font-size:.88rem">انضم كبائع P2P واعرض نقاطك بسعر لا يقل عن الرسمي ولا يزيد عنه أكثر من ${j.cfg.pct}٪.</p></div>
<div class="c"><b>الشروط</b>
<div class="rw" style="margin-top:10px"><span>${j.canSell ? '✅' : '❌'}</span><span class="sp">امتلاك عداد «عشرة آلاف» فعّال</span></div>
<div class="rw" style="margin-top:8px"><span>⭕</span><span class="sp">إضافة طرق دفعك وأرقام حساباتك (تظهر للمشتري عند الطلب فقط)</span></div>
<div class="rw" style="margin-top:8px"><span>⭕</span><span class="sp">موافقة الإدارة — تمنحك المستوى حسب تعاملاتك وتقييمك</span></div>
<button class="btn" style="margin-top:14px" data-p="apply" ${j.canSell ? '' : 'disabled'}>التسجيل كبائع</button>${j.canSell ? '' : '<div class="mu" style="margin-top:8px;text-align:center">اشترِ عداد «عشرة آلاف» أولاً لتفعيل التسجيل</div>'}</div>`;
        return;
      }
      if (s.status !== 'approved') {
        const m = { pending: ['⏳', 'طلبك قيد المراجعة', 'ستصلك رسالة عند اعتماد حسابك كبائع.'], rejected: ['❌', 'تم رفض طلبك', s.admin_note || 'يمكنك تعديل بياناتك وإعادة التقديم.'], suspended: ['⛔', 'حساب البائع موقوف', s.admin_note || 'تواصل مع الدعم.'] }[s.status];
        body.innerHTML = `<div class="c" style="text-align:center"><div style="font-size:2.4rem">${m[0]}</div><b>${m[1]}</b><p class="mu">${esc(m[2])}</p>${s.status === 'rejected' ? '<button class="btn" data-p="apply">إعادة التقديم</button>' : ''}</div>`;
        return;
      }
      const st = j.stats || {};
      body.innerHTML = `<div class="c hero"><div class="rw"><div class="sp"><div style="color:#bfeaf2" class="mu">حسابك كبائع</div><div style="margin-top:4px">${lv(s.level)}</div></div><div style="text-align:left"><div class="mu" style="color:#bfeaf2">رصيدك</div><b style="font-size:1.2rem">${NF(j.pts)}</b></div></div>
<div class="gd" style="margin-top:12px"><div class="kp"><b>${NF(st.done)}</b><span>صفقة</span></div><div class="kp"><b>${pct(st.rate)}</b><span>إتمام</span></div><div class="kp"><b>${st.avg == null ? '—' : N2(st.avg)} ★</b><span>${NF(st.n)} تقييم</span></div></div>
<div class="mu" style="margin-top:10px;color:#bfeaf2;font-size:.76rem">المستوى تمنحه الإدارة حسب تعاملاتك وتقييماتك وتعليقات المشترين.</div></div>
${j.incoming.length ? `<div class="c"><b>طلبات واردة (${j.incoming.length})</b>${j.incoming.map((o) => `<div class="rw tap" data-p="order" data-v="${o.id}" style="margin-top:10px;cursor:pointer"><div class="sp"><b>${esc(o.buyer)}</b><div class="mu" style="font-size:.76rem">${NF(o.pts)} نقطة · ${NF(o.iqd)} د.ع</div></div><span class="st ${o.status}">${ST[o.status]}</span></div>`).join('')}</div>` : ''}
<div class="rw" style="margin-bottom:10px"><b class="sp">إعلاناتي</b><button class="btn s" data-p="adnew">${ic('plus')} إعلان</button></div>
${j.ads.map((a) => `<div class="c" ${a.status === 'paused' ? 'style="opacity:.75"' : ''}><div class="rw"><div class="sp"><div class="pr">${N2(a.price)} <small style="font-size:.74rem">د.ع / 1000</small></div><div class="mu">المتاح ${NF(a.avail)} من ${NF(a.total)} نقطة</div></div><span class="st ${a.status === 'active' ? 'completed' : 'awaiting_payment'}">${a.status === 'active' ? 'نشط' : 'متوقف'}</span></div>
${a.out ? `<div class="note warn" style="margin:10px 0 0">${ic('shield')}<span>سعرك خارج النطاق الرسمي حالياً والإعلان مخفي. عدّل السعر.</span></div>` : ''}
<div class="rw" style="margin-top:10px;gap:6px"><button class="btn s o" style="flex:1" data-p="adedit" data-v="${a.id}">تعديل</button><button class="btn s o" style="flex:1" data-p="adact" data-v="${a.id}" data-f="${a.status === 'active' ? 'pause' : 'resume'}">${a.status === 'active' ? 'إيقاف' : 'تشغيل'}</button><button class="btn s r" style="flex:1" data-p="adact" data-v="${a.id}" data-f="close">إغلاق</button></div></div>`).join('') || '<div class="em">لا توجد إعلانات — أنشئ إعلانك الأول</div>'}
<button class="btn o" data-p="methods">تعديل طرق الدفع والنبذة</button>`;
    },

    async apply() { const j = P.sm || await api('seller/me'); P.mm = (j.seller && j.seller.methods && j.seller.methods.length ? j.seller.methods : [{ type: 'zaincash', label: '', holder: '', number: '', bank: '' }]).map((x) => Object.assign({}, x)); body.innerHTML = methodsForm(j, true); },
    async methods() { const j = P.sm || await api('seller/me'); P.mm = (j.seller.methods || []).map((x) => Object.assign({}, x)); body.innerHTML = methodsForm(j, false); },

    async adform() {
      const j = P.sm || await api('seller/me'), a = P.arg && P.arg.id ? j.ads.find((x) => x.id === P.arg.id) : null, c = j.cfg, ms = j.seller.methods;
      const sel = a ? a.methods : ms.map((_, i) => i);
      body.innerHTML = `<div class="note">${ic('shield')}<span>السعر الرسمي <b>${N2(c.official)}</b> — يُسمح من <b>${N2(c.min)}</b> إلى <b>${N2(c.max)}</b> د.ع لكل 1000 نقطة. النقاط تُحجز من رصيدك (${NF(j.pts)}) حتى تُباع أو تغلق الإعلان.</span></div>
<div class="c"><label style="margin-top:0">${a ? 'إضافة نقاط للإعلان (اختياري)' : 'عدد النقاط المعروضة (الحد الأدنى ' + NF(c.minAd) + ')'}<input id="adp" type="number" inputmode="numeric" min="0" placeholder="${a ? '0' : NF(c.minAd)}"></label>
<label>سعرك لكل 1000 نقطة (د.ع)<input id="adr" type="number" inputmode="decimal" step="0.01" value="${a ? a.price : c.official}"></label><div id="adh" class="mu" style="margin-top:4px;font-size:.76rem"></div>
<div class="rw" style="gap:8px"><label class="sp">أقل طلب (نقطة)<input id="adm" type="number" inputmode="numeric" value="${a ? a.min : c.minOrder}"></label><label class="sp">أكبر طلب (0 = بلا حد)<input id="adx" type="number" inputmode="numeric" value="${a ? a.max : 0}"></label></div>
<label>طرق الدفع لهذا الإعلان</label>${ms.map((m, i) => `<label class="ck ${sel.includes(i) ? 'on' : ''}"><input type="checkbox" class="adc" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span class="sp"><b>${esc(m.label)}</b> <span class="mu" dir="ltr">${esc((m.number || '').slice(-4).padStart((m.number || '').length, '•'))}</span></span></label>`).join('')}
<label>شروط البائع (اختياري)<textarea id="adt" rows="2" maxlength="300" placeholder="مثال: الدفع خلال 15 دقيقة، التحويل من حساب باسم المشتري فقط">${esc(a ? a.terms : '')}</textarea></label>
<button class="btn" style="margin-top:14px" data-p="adsave" data-v="${a ? a.id : 0}">${a ? 'حفظ التعديلات' : 'نشر الإعلان وحجز النقاط'}</button></div>`;
      priceHint();
    },

    async chat() {
      const draw = async () => {
        const j = await api('chat/inbox'); if (P.view !== 'chat') return;
        const sig = JSON.stringify(j.list); if (sig === P.sig) return; P.sig = sig;
        setBadge(j.list.reduce((t, x) => t + x.unread, 0));
        body.innerHTML = j.list.map((x) => `<div class="c tap" data-p="chat" data-v="${esc(x.uid)}"><div class="rw">${avatar(x, 0)}<div class="sp"><b>${esc(x.name)}</b><div class="mu" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.last)}</div></div>${x.unread ? `<span class="st proof_submitted">${x.unread}</span>` : ''}</div></div>`).join('') || '<div class="em">لا توجد محادثات — افتح دردشة من ملف أي بائع</div>';
      };
      await draw(); every(draw, 6000);
    },

    async chatroom() {
      P.chatUid = P.arg.uid; P.chatLast = 0; P.chatMsgs = [];
      const j = await api('chat/msgs', { uid: P.chatUid, after: 0 }); title.textContent = j.peer.name;
      body.innerHTML = `<div class="ch" style="height:calc(100vh - 150px)"><div class="ms" id="ppms"></div><div class="ci"><button class="ib" data-p="cimg" aria-label="صورة">${ic('img')}</button><input type="file" id="ppci2" accept="image/*" style="display:none"><textarea id="ppci" rows="1" maxlength="600" placeholder="اكتب رسالة..."></textarea><button class="ib" data-p="csend" style="background:var(--ac);color:#04222a">${ic('send')}</button></div></div>`;
      addMsgs(j.msgs);
      every(async () => { if (P.view !== 'chatroom') return; const r = await api('chat/msgs', { uid: P.chatUid, after: P.chatLast }); if (r.msgs.length) addMsgs(r.msgs); }, 3000);
    },
  };

  function adCard(a) {
    const s = a.seller;
    return `<div class="c"><div class="rw tap" data-p="profile" data-v="${esc(s.uid)}" style="cursor:pointer">${avatar(s, 0)}<div class="sp"><div class="rw wr" style="gap:6px"><b>${esc(s.name)}</b>${lv(s.level)}</div>
<div class="mu" style="font-size:.76rem;margin-top:3px">${NF(s.stats.done)} صفقة · إتمام ${pct(s.stats.rate)} · ${stars(s.stats.avg)}${s.stats.n ? ` (${NF(s.stats.n)})` : ''}</div></div></div>
<div class="rw" style="margin-top:12px"><div class="sp"><div class="pr">${N2(a.price)} <small style="font-size:.74rem;font-weight:600">د.ع / 1000 نقطة</small></div><div class="mu" style="margin-top:2px">المتاح <b style="color:#fff">${NF(a.avail)}</b> نقطة · الحد ${NF(a.min)} – ${NF(a.max)}</div></div><button class="btn s" data-p="buy" data-v="${a.id}">شراء</button></div>
<div style="margin-top:10px">${a.methods.map((m) => `<span class="chip">${esc(m.label)}</span>`).join(' ')}</div>${a.terms ? `<div class="mu" style="margin-top:8px;font-size:.76rem">📝 ${esc(a.terms)}</div>` : ''}</div>`;
  }

  function methodsForm(j, isApply) {
    const mt = j.mtypes, s = j.seller || {};
    return `${isApply ? `<div class="note">${ic('shield')}<span>أرقام حساباتك تظهر للمشتري عند إنشاء الطلب وللإدارة للمطابقة فقط. اكتب الاسم كما هو مسجّل في حسابك.</span></div>
<div class="c"><label style="margin-top:0">الاسم الثلاثي<input id="apn" value="${esc(s.full_name || '')}" maxlength="80"></label><label>رقم الهاتف<input id="app" value="${esc(s.phone || '')}" inputmode="tel" dir="ltr" maxlength="20"></label></div>` : ''}
<div class="c"><b>طرق الدفع التي تقبلها</b><div id="mmw">${mmHtml(mt)}</div><button class="btn s o" style="margin-top:10px" data-p="mmadd">${ic('plus')} إضافة طريقة</button>
<label>نبذة قصيرة عنك (اختياري)<textarea id="apb" rows="2" maxlength="200">${esc(s.bio || '')}</textarea></label></div>
<button class="btn" data-p="${isApply ? 'applysend' : 'methodssave'}">${isApply ? 'إرسال الطلب للإدارة' : 'حفظ'}</button>`;
  }
  const mmHtml = (mt) => P.mm.map((m, i) => `<div class="mrow" data-i="${i}"><div class="rw"><select class="mmt">${Object.keys(mt).map((k) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${esc(mt[k])}</option>`).join('')}</select>${P.mm.length > 1 ? `<button class="ib" data-p="mmdel" data-v="${i}" style="flex:none;color:#ff7a77">${ic('x')}</button>` : ''}</div>
<input class="mmh" placeholder="اسم صاحب الحساب" value="${esc(m.holder)}" maxlength="80"><input class="mmn" placeholder="رقم الحساب / الهاتف / البطاقة" dir="ltr" value="${esc(m.number)}" maxlength="64"><input class="mmb" placeholder="اسم المصرف / ملاحظة (اختياري)" value="${esc(m.bank || '')}" maxlength="60"></div>`).join('');
  const readMM = () => [...document.querySelectorAll('#mmw .mrow')].map((r) => ({ type: $('.mmt', r).value, label: '', holder: $('.mmh', r).value.trim(), number: $('.mmn', r).value.trim(), bank: $('.mmb', r).value.trim() }));
  function priceHint() {
    const c = (P.sm && P.sm.cfg) || {}, i = $('#adr'), h = $('#adh'); if (!i || !h) return;
    const v = Number(i.value), ok = v >= c.min - 1e-9 && v <= c.max + 1e-9;
    h.style.color = ok ? '#3ad98f' : '#ff7a77'; h.textContent = ok ? '✓ السعر ضمن النطاق المسموح' : `✕ يجب أن يكون السعر بين ${N2(c.min)} و ${N2(c.max)}`;
  }

  /* ---------------- مساعدات ---------------- */
  function setBadge(n) {
    const b = $('button[data-t="chat"]', root); if (!b) return; let i = $('i', b);
    if (n > 0) { if (!i) { i = document.createElement('i'); b.appendChild(i); } i.textContent = n > 9 ? '9+' : n; } else if (i) i.remove();
  }
  function tick() {
    document.querySelectorAll('[data-exp]').forEach((e) => {
      const ms = Number(e.dataset.exp) - (Date.now() + P.skew); if (ms <= 0) { e.textContent = 'انتهت المهلة'; return; }
      const s = Math.floor(ms / 1000); e.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    });
  }
  function addMsgs(arr) {
    const box = $('#ppms'); if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || !P.chatLast;
    arr.forEach((m) => { if (P.chatMsgs.some((x) => x.id === m.id)) return; P.chatMsgs.push(m); P.chatLast = Math.max(P.chatLast, m.id);
      const d = document.createElement('div'); d.className = 'mb ' + (m.sys ? 's' : m.mine ? 'm' : 'o');
      d.innerHTML = esc(m.x) + (m.img ? `<img src="${m.img}" data-p="zoom">` : '') + (m.sys ? '' : `<small>${new Date(m.t).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</small>`); box.appendChild(d); });
    if (near) box.scrollTop = box.scrollHeight;
  }
  function sheet(html) { closeSheet(); const o = document.createElement('div'); o.className = 'ov'; o.id = 'ppsh'; o.innerHTML = `<div class="sh">${html}</div>`; o.addEventListener('click', (e) => { if (e.target === o) closeSheet(); }); root.appendChild(o); }
  const closeSheet = () => { const o = $('#ppsh'); if (o) o.remove(); };
  const busy = async (btn, fn) => { if (P.busy) return; P.busy = true; if (btn) btn.disabled = true; try { await fn(); } catch (e) { say(e.message); } finally { P.busy = false; if (btn) btn.disabled = false; } };
  const copy = (t) => { try { navigator.clipboard.writeText(String(t)); say('تم النسخ'); } catch (e) { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); say('تم النسخ'); } catch (_) {} x.remove(); } };

  function buySheet(id) {
    const a = P.home.ads.find((x) => x.id === +id); if (!a) return say('الإعلان لم يعد متاحاً');
    P.buy = { a, pts: a.min, m: a.methods.length === 1 ? 0 : -1 }; const mi = (a.methods.map((m, i) => i));
    sheet(`<div class="rw"><b class="sp" style="font-size:1.05rem">شراء من ${esc(a.seller.name)}</b>${lv(a.seller.level)}</div>
<div class="mu" style="margin-top:4px">السعر ${N2(a.price)} د.ع لكل 1000 نقطة · المتاح ${NF(a.avail)}</div>
<label>الكمية بالنقاط<input id="bpts" type="number" inputmode="numeric" value="${a.min}" min="${a.min}" max="${a.max}"></label>
<div class="rw wr" style="gap:6px;margin-top:8px">${[a.min, Math.round((a.min + a.max) / 2), a.max].filter((v, i, r) => r.indexOf(v) === i).map((v) => `<button class="chip" style="cursor:pointer;color:var(--ac)" data-p="bset" data-v="${v}">${NF(v)}</button>`).join('')}</div>
<label>طريقة الدفع</label>${a.methods.map((m, i) => `<label class="ck ${P.buy.m === i ? 'on' : ''}" style="color:#fff"><input type="radio" name="bm" value="${i}" ${P.buy.m === i ? 'checked' : ''}><span class="sp"><b>${esc(m.label)}</b></span></label>`).join('')}
<div class="c" style="margin:14px 0 0;background:#0E1621"><div class="rw"><span class="sp mu">ستدفع</span><b class="pr" id="btot">0 د.ع</b></div><div class="rw" style="margin-top:4px"><span class="sp mu">ستستلم</span><b id="brec">0 نقطة</b></div></div>
<div class="mu" style="margin-top:8px;font-size:.76rem">⏱ لديك ${P.home.cfg.payMin} دقيقة للدفع بعد تأكيد الطلب، وإلا يُلغى تلقائياً.</div>
<button class="btn" style="margin-top:12px" data-p="bgo">تأكيد الطلب</button>`);
    buyCalc();
  }
  function buyCalc() {
    const b = P.buy; if (!b) return; const v = Math.floor(Number($('#bpts').value) || 0); b.pts = v;
    $('#btot').textContent = NF(Math.round(v / 1000 * b.a.price)) + ' د.ع'; $('#brec').textContent = NF(v) + ' نقطة';
  }

  /* ---------------- الأحداث ---------------- */
  function onInput(e) {
    if (e.target.id === 'bpts') buyCalc();
    else if (e.target.id === 'adr') priceHint();
  }
  function onChange(e) {
    const t = e.target;
    if (t.name === 'bm') { P.buy.m = +t.value; document.querySelectorAll('#ppsh .ck').forEach((x) => x.classList.toggle('on', x.contains(t))); }
    else if (t.classList.contains('adc')) t.closest('.ck').classList.toggle('on', t.checked);
    else if (t.id === 'ppf') { const f = t.files[0]; const v = $('#ppfv'); if (f && v) { v.src = URL.createObjectURL(f); v.style.display = 'block'; } }
    else if (t.id === 'ppci2') { const f = t.files[0]; t.value = ''; if (f) busy(null, async () => { const img = await shrink(f, 1100); await sendMsg('', img); }); }
  }
  async function sendMsg(txt, img) {
    const j = await api('chat/send', { uid: P.chatUid, body: txt, img: img || undefined, order: P.arg && P.arg.order || undefined }); addMsgs([j.msg]);
  }

  function onClick(e) {
    const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p, v = b.dataset.v; e.stopPropagation();
    if (a === 'zoom') return sheet(`<img src="${b.src}" style="width:100%;border-radius:12px"><button class="btn o" style="margin-top:10px" onclick="document.getElementById('ppsh').remove()">إغلاق</button>`);
    if (a === 'copy') return copy(v);
    if (a === 'retry') return go(P.view, P.arg, false);
    if (a === 'filt') { P.filt = v; P.sig = ''; return VIEWS.market(); }
    if (a === 'profile') return go('profile', v);
    if (a === 'order') return go('order', +v);
    if (a === 'chat') return go('chatroom', { uid: v, order: +b.dataset.o || 0 });
    if (a === 'buy') return buySheet(v);
    if (a === 'bset') { $('#bpts').value = v; return buyCalc(); }
    if (a === 'apply') return go('apply');
    if (a === 'methods') return go('methods');
    if (a === 'adnew') return go('adform', {});
    if (a === 'adedit') return go('adform', { id: +v });
    if (a === 'mmadd') { P.mm = readMM(); if (P.mm.length >= 8) return say('الحد الأقصى 8 طرق'); P.mm.push({ type: 'zaincash', holder: '', number: '', bank: '' }); $('#mmw').innerHTML = mmHtml(P.sm ? P.sm.mtypes : P.home.mtypes); return; }
    if (a === 'mmdel') { P.mm = readMM(); P.mm.splice(+v, 1); $('#mmw').innerHTML = mmHtml(P.sm ? P.sm.mtypes : P.home.mtypes); return; }
    if (a === 'star') { P.star = +v; document.querySelectorAll('#ppst button').forEach((x, i) => x.classList.toggle('on', i < P.star)); return; }
    act(a, v, b);
  }

  function act(a, v, b) {
    if (a === 'bgo') return busy(b, async () => {
      const x = P.buy; if (x.m < 0) return say('اختر طريقة الدفع');
      const j = await api('order/create', { ad: x.a.id, pts: x.pts, method: x.m }); closeSheet(); say('تم إنشاء الطلب — ادفع وأرفق الصورة'); go('order', j.id);
    });
    if (a === 'proof') return busy(b, async () => {
      const f = $('#ppf') && $('#ppf').files[0]; if (!f) return say('اختر صورة التحويل أولاً');
      const img = await shrink(f); await api('order/proof', { id: +v, img }); say('تم إرسال الصورة للإدارة ✅'); P.sig = ''; go('order', +v, false);
    });
    if (a === 'seeproof') return busy(b, async () => { const j = await api('order/proofimg', { id: +v }); const h = $('#ppim'); if (h) h.innerHTML = j.img ? `<img class="pf" src="${j.img}" data-p="zoom">` : '<div class="mu">لا توجد صورة</div>'; });
    if (a === 'cancel') { if (!confirm('إلغاء هذا الطلب؟')) return; return busy(b, async () => { await api('order/cancel', { id: +v }); say('تم إلغاء الطلب'); go('orders', null, false); }); }
    if (a === 'flag') {
      let note = ''; if (b.dataset.f === 'dispute') { note = prompt('اكتب سبب الاعتراض (لم يصل المبلغ / المبلغ ناقص ...)'); if (!note) return; }
      return busy(b, async () => { await api('order/flag', { id: +v, flag: b.dataset.f, note }); say('تم إبلاغ الإدارة'); P.sig = ''; go('order', +v, false); });
    }
    if (a === 'rate') return busy(b, async () => { if (!P.star) return say('اختر عدد النجوم'); await api('order/rate', { id: +v, stars: P.star, comment: ($('#ppcm') || {}).value || '' }); P.star = 0; say('شكراً لتقييمك ⭐'); P.sig = ''; go('order', +v, false); });
    if (a === 'applysend') return busy(b, async () => { await api('seller/apply', { full_name: ($('#apn') || {}).value, phone: ($('#app') || {}).value, bio: ($('#apb') || {}).value, methods: readMM() }); say('أُرسل طلبك للإدارة'); P.sm = null; P.nav = []; go('seller', null, false); });
    if (a === 'methodssave') return busy(b, async () => { await api('seller/update', { bio: ($('#apb') || {}).value, methods: readMM() }); say('تم الحفظ'); P.sm = null; P.nav = []; go('seller', null, false); });
    if (a === 'adsave') return busy(b, async () => {
      const methods = [...document.querySelectorAll('.adc:checked')].map((x) => +x.value);
      await api('ad/save', { id: +v || 0, pts: +$('#adp').value || 0, price: +$('#adr').value, min: +$('#adm').value, max: +$('#adx').value, methods, terms: $('#adt').value });
      say(+v ? 'تم حفظ الإعلان' : 'تم نشر إعلانك ✅'); P.sm = null; P.nav = []; go('seller', null, false);
    });
    if (a === 'adact') { const f = b.dataset.f; if (f === 'close' && !confirm('إغلاق الإعلان واسترجاع النقاط غير المباعة؟')) return; return busy(b, async () => { await api('ad/act', { id: +v, act: f }); say('تم'); P.sm = null; go('seller', null, false); }); }
    if (a === 'csend') { const x = $('#ppci'); const t = x && x.value.trim(); if (!t) return; x.value = ''; return busy(null, async () => { try { await sendMsg(t); } catch (er) { x.value = t; throw er; } }); }
    if (a === 'cimg') { const f = $('#ppci2'); if (f) f.click(); }
  }

  /* ---------------- الاعتراض على «شراء نقاط P2P» ---------------- */
  window.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-r="p2p"],[data-a="go"][data-v="p2p"],[data-a="p2p"]'); if (!b) return;
    try { if (typeof CFG !== 'undefined' && CFG.hp2p) return; } catch (e) {}
    try { const dd = document.getElementById('d'); if (dd && dd.open) dd.close(); } catch (e) {}
    ev.stopImmediatePropagation(); ev.preventDefault(); open();
  }, true);
  window.P2P_OPEN = open;
  /* مزامنة عدادات المستخدم إلى السيرفر تلقائياً (لتظهر في لوحة التحكم ويتحقق منها نظام P2P) */
  let lastCl = '';
  async function pushCl() {
    try {
      const m = me(); if (!m || (S.acc && S.acc.demo)) return;
      const cl = (S.cl || []).filter((x) => x && Number(x.e) > Date.now()).map((x) => ({ i: x.i, e: x.e }));
      if (!cl.length) return;
      const sig = m.e + JSON.stringify(cl) + Math.floor(Date.now() / 36e5); /* يُعاد الإرسال كل ساعة على الأقل */
      if (sig === lastCl) return;
      const r = await fetch('/api/p2p/cl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, m, { cl })) });
      if (r.ok) lastCl = sig;
    } catch (e) {}
  }
  setTimeout(pushCl, 2500); setInterval(pushCl, 15000);
  /* احتياط: إذا ظهرت الصفحة القديمة (route=p2p) افتح النظام الجديد تلقائياً */
  setInterval(() => { try { if (typeof S !== 'undefined' && S.r === 'p2p' && !(typeof CFG !== 'undefined' && CFG.hp2p) && !document.getElementById('ppo')?.classList.contains('on')) { S.r = 'home'; try { draw(); } catch (e) {} open(); } } catch (e) {} }, 400);
})();

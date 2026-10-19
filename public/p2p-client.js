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
#ppo .pmi{border-radius:6px;vertical-align:middle;margin-inline-end:5px;object-fit:cover}#ppo .fl .pmi{margin-inline-end:6px}#ppo .chip{display:inline-block;font-size:.72rem;padding:3px 10px;border-radius:99px;background:#ffffff0f;border:1px solid #ffffff14;color:#cfe3ee}
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
#ppb.room{padding:0;overflow:hidden;display:flex;flex-direction:column;max-width:760px}
#ppo .ch{flex:1;min-height:0;display:flex;flex-direction:column;background:radial-gradient(120% 60% at 50% 0,#12202e 0,#0E1621 70%)}
#ppo .cx{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#101c28;border-bottom:1px solid #ffffff10;font-size:.8rem;color:var(--mu)}
#ppo .cx b{color:var(--ac)}#ppo .cx button{margin-inline-start:auto;border:1px solid var(--bd);background:none;color:var(--ac);border-radius:99px;padding:4px 12px;font:inherit;font-size:.76rem;cursor:pointer}
#ppo .ms{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding:14px 12px 10px;scroll-behavior:smooth;overscroll-behavior:contain}
#ppo .dy{align-self:center;margin:8px 0 4px;font-size:.7rem;color:var(--mu);background:#ffffff0d;border-radius:99px;padding:3px 12px}
#ppo .mb{max-width:82%;padding:8px 12px 6px;border-radius:18px;font-size:.9rem;line-height:1.55;word-break:break-word;white-space:pre-wrap;box-shadow:0 1px 0 #0003}
#ppo .mb.m{align-self:flex-start;background:linear-gradient(135deg,#00a6c4,#1fb8cf);color:#031c22;border-end-start-radius:5px}
#ppo .mb.o{align-self:flex-end;background:#243445;border-end-end-radius:5px}
#ppo .mb.s{align-self:center;background:#ffffff0d;color:var(--mu);font-size:.74rem;text-align:center;max-width:92%;border-radius:12px;box-shadow:none}
#ppo .mb img{max-width:min(230px,100%);max-height:260px;object-fit:cover;border-radius:12px;display:block;margin:2px 0 5px;cursor:zoom-in}
#ppo .mb small{display:block;opacity:.6;font-size:.62rem;margin-top:2px;text-align:end}
#ppo .cmp{display:flex;align-items:flex-end;gap:8px;padding:9px 10px calc(9px + env(safe-area-inset-bottom,0px));background:#101c28;border-top:1px solid #ffffff12}
#ppo .cmp textarea{flex:1;min-width:0;margin:0;max-height:120px;min-height:44px;border-radius:22px;padding:11px 16px;line-height:1.4;background:#0E1621;overflow-y:auto}
#ppo .cmp .cb{flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--bd);background:#16283a;color:var(--ac);display:grid;place-items:center;cursor:pointer;padding:0}
#ppo .cmp .cb.snd{background:linear-gradient(135deg,#00b6d4,#2bcfe2);border:0;color:#04222a;box-shadow:0 4px 14px #00b6d455;transition:opacity .15s,transform .1s}
#ppo .cmp .cb.snd:active{transform:scale(.92)}#ppo .cmp .cb.snd.off{opacity:.45}
#ppo .cmp .cb svg{width:21px;height:21px}#ppo .cmp .cb.snd svg{transform:scaleX(-1)}
#ppo .pvw{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#101c28;border-top:1px solid #ffffff12}
#ppo .pvw img{width:54px;height:54px;object-fit:cover;border-radius:10px}#ppo .pvw span{flex:1;font-size:.8rem;color:var(--mu)}
#ppo .pvw button{border:0;background:#ef535033;color:#ff8a87;width:32px;height:32px;border-radius:50%;cursor:pointer;padding:0;display:grid;place-items:center}
#ppo .mrow select.mmb{margin-top:6px}
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
  const PMI = {"superqi": "data:image/png;base64,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", "zaincash": "data:image/png;base64,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", "asiahawala": "data:image/png;base64,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", "bank": "data:image/png;base64,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"};
  const pmi = (t, z) => PMI[t] ? `<img src="${PMI[t]}" alt="" class="pmi" style="width:${z || 22}px;height:${z || 22}px">` : '';
  const lv = (k) => k ? `<span class="lv ${k}">${ic('shield')}${LV[k] || k}</span>` : '';
  const stars = (a) => a == null ? '<span class="mu">بلا تقييم</span>' : `<span class="sg">★</span> <b>${N2(a)}</b>`;
  const avatar = (u, big) => u && u.av ? `<div class="av ${big ? 'l' : ''}" style="background-image:url('/api/soc/avatar/${esc(u.uid)}?v=${u.av}')"></div>` : `<div class="av ${big ? 'l' : ''}">${esc((u && u.name || '؟').trim().charAt(0))}</div>`;
  const ST = { awaiting_payment: 'بانتظار الدفع', proof_submitted: 'بانتظار تحرير البائع', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي', disputed: 'قيد التحقيق' };
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
    body.classList.remove('room'); P.pimg = ''; body.scrollTop = 0; body.innerHTML = '<div class="em">جارٍ التحميل...</div>';
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
        j.ads.forEach((a) => a.methods.forEach((m) => { ty[m.type] = (j.mtypes && j.mtypes[m.type]) || m.label; }));
        P.banks = j.banks || P.banks;
        let ads = j.ads.filter((a) => P.filt === 'all' || a.methods.some((m) => m.type === P.filt));
        const sig = JSON.stringify([ads.map((a) => [a.id, a.avail, a.price]), P.filt]);
        if (sig === P.sig) return; P.sig = sig;
        body.innerHTML = `<div class="c hero"><div class="rw"><div class="sp"><div class="mu" style="color:#bfeaf2">السعر الرسمي لكل 1000 نقطة</div><div class="pr" style="color:#fff">${N2(c.official)} <small style="font-size:.8rem">د.ع</small></div></div>
<div style="text-align:left"><div class="mu" style="color:#bfeaf2">نطاق الإعلانات المسموح</div><b>${N2(c.min)} – ${N2(c.max)}</b></div></div></div>
<div class="note">${ic('shield')}<span>نقاط البائع محجوزة في ضمان التطبيق. ادفع للبائع، أرفق صورة التحويل، ثم يحرّر البائع النقاط لك. الإدارة تتدخل فقط عند النزاع.</span></div>
<div class="fl"><button data-p="filt" data-v="all" class="${P.filt === 'all' ? 'on' : ''}">الكل</button>${Object.keys(ty).map((k) => `<button data-p="filt" data-v="${k}" class="${P.filt === k ? 'on' : ''}">${pmi(k, 18)}${esc(ty[k])}</button>`).join('')}</div>
${ads.map(adCard).join('') || '<div class="em">لا توجد إعلانات متاحة حالياً</div>'}`;
      };
      await draw(); every(draw, 12000);
    },

    async profile() {
      const j = await api('seller/profile', { uid: P.arg }); const s = j.seller, st = s.stats, tot = j.dist.reduce((t, d) => t + d.n, 0);
      body.innerHTML = `<div class="c"><div class="rw">${avatar(s, 1)}<div class="sp"><div style="font-size:1.1rem;font-weight:800">${esc(s.name)}</div><div style="margin-top:4px">${lv(s.level)}</div><div class="mu" style="margin-top:4px">بائع منذ ${dtf(s.since).split(',')[0]}</div></div></div>
${s.bio ? `<p class="mu" style="margin:10px 0 0">${esc(s.bio)}</p>` : ''}
<div class="gd" style="margin-top:12px"><div class="kp"><b>${NF(st.done)}</b><span>صفقة ناجحة</span></div><div class="kp"><b>${pct(st.rate)}</b><span>نسبة الإتمام</span></div><div class="kp"><b>${st.avg == null ? '—' : N2(st.avg)} <span class="sg">★</span></b><span>${NF(st.n)} تقييم</span></div></div>
<div style="margin-top:12px" class="mu">طرق الدفع المقبولة</div><div style="margin-top:6px">${s.methods.map((m) => `<span class="chip">${pmi(m.type, 14)}${esc(m.label)}</span>`).join(' ')}</div>
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
        const sig = JSON.stringify([o.status, o.flag, o.rated, o.hasProof, o.note, P.dwhy]); if (sig === P.sig) return; P.sig = sig;
        const buyer = o.role === 'buyer', m = o.method || {};
        const step = o.status === 'awaiting_payment' ? 1 : o.status === 'proof_submitted' || o.status === 'disputed' ? 2 : o.status === 'completed' ? 3 : 0;
        const bad = ['rejected', 'cancelled', 'expired'].includes(o.status);
        let h = `<div class="c"><div class="stp"><div class="on"><i>1</i>طلب</div><div class="${step >= 1 ? 'on' : ''}"><i>2</i>دفع</div><div class="${step >= 2 ? 'on' : ''}"><i>3</i>تحرير</div><div class="${step >= 3 ? 'on' : bad ? 'bad' : ''}"><i>${bad ? '✕' : '✓'}</i>${bad ? ST[o.status] : 'اكتمل'}</div></div>
<div class="rw"><span class="st ${o.status}">${ST[o.status]}</span><span class="sp"></span>${o.status === 'awaiting_payment' ? `<span class="ac" style="font-weight:700">${ic('clock').replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"')} <span data-exp="${o.exp}">--:--</span></span>` : ''}</div>
<div class="gd" style="margin-top:12px;grid-template-columns:1fr 1fr"><div class="kp"><b class="ac">${NF(o.pts)}</b><span>نقطة</span></div><div class="kp"><b>${NF(o.iqd)}</b><span>دينار عراقي (${N2(o.price)} / 1000 نقطة)</span></div></div>
${o.fee ? `<div class="mu" style="margin-top:6px">عمولة المنصة: ${NF(o.fee)} نقطة تُخصم من المستلَم</div>` : ''}</div>
<div class="c"><div class="rw">${avatar(ot, 0)}<div class="sp"><div class="mu">${buyer ? 'البائع' : 'المشتري'}</div><b>${esc(ot.name)}</b> ${buyer ? lv(ot.level) : ''}</div><button class="btn s o" data-p="chat" data-v="${esc(ot.uid)}" data-o="${o.id}">${ic('chat')} دردشة</button></div></div>`;
        if (o.note && (bad || o.status === 'completed' || o.status === 'disputed')) h += `<div class="note ${bad ? 'warn' : ''}">${ic('shield')}<span><b>ملاحظة الإدارة:</b> ${esc(o.note)}</span></div>`;
        const payCard = (title) => `<div class="c"><b>${title}</b>
<div class="bx"><div class="mu">الطريقة</div><div class="rw"><b class="sp">${esc(m.label || '')}</b>${pmi(m.type, 30)}</div></div>
${m.holder ? `<div class="bx"><div class="mu">اسم المستلم</div><div class="rw"><b class="sp">${esc(m.holder)}</b><button class="cp" data-p="copy" data-v="${esc(m.holder)}">نسخ</button></div></div>` : ''}
${m.number ? `<div class="bx"><div class="mu">رقم الحساب${m.bank ? ' — ' + esc(m.bank) : ''}</div><div class="rw"><b class="sp" dir="ltr" style="text-align:right;letter-spacing:.5px">${esc(m.number)}</b><button class="cp" data-p="copy" data-v="${esc(m.number)}">نسخ</button></div></div>` : ''}
<div class="bx"><div class="mu">المبلغ</div><div class="rw"><b class="pr sp">${NF(o.iqd)} د.ع</b><button class="cp" data-p="copy" data-v="${o.iqd}">نسخ</button></div></div>
${buyer ? `<div class="note warn" style="margin:12px 0 0">${ic('shield')}<span>حوّل المبلغ المطابق فقط ولا تكتب «نقاط» أو «سنتات» في ملاحظة التحويل.</span></div>` : ''}</div>`;
        const proofCard = `<div class="c"><b>إثبات الدفع</b><div id="ppim" style="margin-top:8px"><div class="mu">جارٍ تحميل الصورة...</div></div></div>`;
        P.needProof = false;
        if (buyer && o.status === 'awaiting_payment') {
          h += payCard('حوّل المبلغ إلى') + `<div class="c"><b>إثبات الدفع (إلزامي)</b><div class="mu" style="margin:4px 0 8px">صورة إيصال التحويل. تُحفظ بشكل خاص ولا يراها إلا طرفا الطلب والإدارة عند النزاع.</div><input type="file" id="ppf" accept="image/*"><img id="ppfv" class="pf" style="display:none"><button class="btn" style="margin-top:10px;background:#ff9500;color:#1b1200" data-p="proof" data-v="${o.id}">تم الدفع</button></div>
<button class="btn o" data-p="cancel" data-v="${o.id}">إلغاء الطلب</button>`;
        } else if (buyer && o.status === 'proof_submitted') {
          h += `<div class="note" style="background:#e8f8ee;color:#12703a">${ic('shield')}<span><b>تم تأكيد الدفع.</b> بانتظار تحرير البائع.</span></div>` + payCard('حوّل المبلغ إلى') + proofCard + `<div class="c" style="border-color:#f3b5b5"><b style="color:#d33">⚖️ النزاع</b><div class="mu" style="margin:4px 0 10px">بعد الدفع لا يمكن الإلغاء. إذا تعذر الاتفاق افتح نزاعاً وستقرر الإدارة يدوياً.</div>
<div class="fl" style="flex-wrap:wrap;overflow:visible">${[['paid_not_released', 'دفعت ولم يتم التحرير'], ['not_received', 'لم يصلني المبلغ'], ['wrong_amount', 'المبلغ المستلم غير صحيح'], ['other', 'سبب آخر']].map(([k, l]) => `<button data-p="dwhy" data-v="${k}" class="${P.dwhy === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<textarea id="ppdn" rows="2" maxlength="300" placeholder="اكتب التفاصيل (إلزامي عند «سبب آخر»)" style="margin-top:8px">${esc(P.dnote || '')}</textarea><button class="btn r" style="margin-top:10px" data-p="dsend" data-v="${o.id}">فتح نزاع</button></div>`;
        } else if (buyer && o.status === 'completed' && !o.rated) {
          h += proofCard + `<div class="c"><b>قيّم تجربتك مع ${esc(ot.name)}</b><div class="stars" id="ppst">${[1, 2, 3, 4, 5].map((k) => `<button data-p="star" data-v="${k}">★</button>`).join('')}</div><textarea id="ppcm" rows="3" maxlength="300" placeholder="اكتب تعليقاً (اختياري)"></textarea><button class="btn" style="margin-top:10px" data-p="rate" data-v="${o.id}">إرسال التقييم</button></div>`;
        } else if (!buyer && o.status === 'awaiting_payment') {
          h += `<div class="note">${ic('clock')}<span>بانتظار قيام المشتري بالتحويل وإرفاق الإثبات. النقاط محجوزة بأمان.</span></div>` + payCard('حسابك المختار للدفع');
        } else if (!buyer && o.status === 'proof_submitted') {
          h += `<div class="note">${ic('shield')}<span><b>أكّد المشتري الدفع.</b> تحقق من وصول المبلغ إلى حسابك ثم حرّر النقاط. القرار بيدك ولا حاجة لموافقة الإدارة.</span></div>` + payCard('الحساب الذي طُلب التحويل إليه') + proofCard +
`<div class="c"><button class="btn g" data-p="release" data-v="${o.id}">استلمت المبلغ — تحرير النقاط للمشتري</button><button class="btn r o" style="margin-top:8px" data-p="flag" data-v="${o.id}" data-f="dispute">لم يصل المبلغ / نزاع</button></div>`;
        } else if (o.status === 'disputed') {
          h += `<div class="note warn">${ic('shield')}<span><b>النزاع قيد مراجعة الإدارة.</b> ${o.dReason ? esc(({ paid_not_released: 'دفعت ولم يتم التحرير', not_received: 'لم يصلني المبلغ', wrong_amount: 'المبلغ المستلم غير صحيح', other: 'سبب آخر', seller_not_received: 'البائع: لم يصل المبلغ' })[o.dReason] || '') : ''}${o.dNote ? ' — ' + esc(o.dNote) : ''}</span></div>` + payCard('بيانات التحويل') + proofCard;
        } else if (o.status === 'completed') h += `<div class="note" style="color:#3ad98f">${ic('shield')}<span>اكتملت الصفقة بنجاح ✓</span></div>` + (buyer ? '' : proofCard);
        body.innerHTML = h; tick();
        if (o.hasProof && $('#ppim')) api('order/proofimg', { id: o.id }).then((r) => { const e = $('#ppim'); if (e) e.innerHTML = r.img ? `<img class="pf" src="${SAFE_SRC(r.img)}" data-p="zoom">` : '<div class="mu">لا توجد صورة</div>'; }).catch(() => {});
      };
      await draw(); every(draw, 5000); timers.push(setInterval(tick, 1000));
    },

    async seller() {
      const j = await api('seller/me'); P.sm = j; const s = j.seller;
      if (!s) {
        body.innerHTML = `<div class="c hero"><b style="font-size:1.1rem">اربح من بيع نقاطك</b><p style="margin:8px 0 0;color:#d6f3f8;font-size:.88rem">البيع والشراء متاحان للجميع. اعرض نقاطك بسعر لا يقل عن الرسمي ولا يزيد عنه أكثر من ${j.cfg.pct}٪.</p></div>
<div class="c"><b>كيف تبدأ؟</b>
<div class="rw" style="margin-top:10px"><span>1️⃣</span><span class="sp">أضف طرق استلام المبلغ: سوبر كي · آسيا حوالة · زين كاش · المصارف العراقية</span></div>
<div class="rw" style="margin-top:8px"><span>2️⃣</span><span class="sp">انشر إعلانك بالكمية والسعر (تُحجز نقاطك في ضمان التطبيق)</span></div>
<div class="rw" style="margin-top:8px"><span>3️⃣</span><span class="sp">تظهر بياناتك للمشتري عند الطلب فقط، والإدارة تدقّق التحويل قبل تحرير النقاط</span></div>
<div class="rw" style="margin-top:8px"><span>4️⃣</span><span class="sp">موافقة الإدارة — تمنحك المستوى حسب تعاملاتك وتقييمك</span></div>
<button class="btn" style="margin-top:14px" data-p="apply">التسجيل كبائع</button></div>`;
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

    async apply() { const j = P.sm || await api('seller/me'); P.mm = (j.seller && j.seller.methods && j.seller.methods.length ? j.seller.methods : [{ type: 'superqi', label: '', holder: '', number: '', bank: '' }]).map((x) => Object.assign({}, x)); P.banks = j.banks || P.banks; body.innerHTML = methodsForm(j, true); },
    async methods() { const j = P.sm || await api('seller/me'); P.mm = (j.seller.methods || []).map((x) => Object.assign({}, x)); P.banks = j.banks || P.banks; body.innerHTML = methodsForm(j, false); },

    async adform() {
      const j = P.sm || await api('seller/me'), a = P.arg && P.arg.id ? j.ads.find((x) => x.id === P.arg.id) : null, c = j.cfg, ms = j.seller.methods;
      const sel = a ? a.methods : ms.map((_, i) => i);
      body.innerHTML = `<div class="note">${ic('shield')}<span>السعر الرسمي <b>${N2(c.official)}</b> — يُسمح من <b>${N2(c.min)}</b> إلى <b>${N2(c.max)}</b> د.ع لكل 1000 نقطة. النقاط تُحجز من رصيدك (${NF(j.pts)}) حتى تُباع أو تغلق الإعلان.</span></div>
<div class="c"><label style="margin-top:0">${a ? 'إضافة نقاط للإعلان (اختياري)' : 'عدد النقاط المعروضة (الحد الأدنى ' + NF(c.minAd) + ')'}<input id="adp" type="number" inputmode="numeric" min="0" placeholder="${a ? '0' : NF(c.minAd)}"></label>
<label>سعرك لكل 1000 نقطة (د.ع)<input id="adr" type="number" inputmode="decimal" step="0.01" value="${a ? a.price : c.official}"></label><div id="adh" class="mu" style="margin-top:4px;font-size:.76rem"></div>
<div class="rw" style="gap:8px"><label class="sp">أقل طلب (نقطة)<input id="adm" type="number" inputmode="numeric" value="${a ? a.min : c.minOrder}"></label><label class="sp">أكبر طلب (0 = بلا حد)<input id="adx" type="number" inputmode="numeric" value="${a ? a.max : 0}"></label></div>
<label>طرق الدفع لهذا الإعلان</label>${ms.map((m, i) => `<label class="ck ${sel.includes(i) ? 'on' : ''}"><input type="checkbox" class="adc" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span class="sp">${pmi(m.type, 22)} <b>${esc(m.label)}</b> <span class="mu" dir="ltr">${esc((m.number || '').slice(-4).padStart((m.number || '').length, '•'))}</span></span></label>`).join('')}
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
      P.chatUid = P.arg.uid; P.chatLast = 0; P.chatMsgs = []; P.chatDay = ''; P.pimg = '';
      const j = await api('chat/msgs', { uid: P.chatUid, after: 0 }); title.textContent = j.peer.name;
      body.classList.add('room');
      body.innerHTML = `<div class="ch">${P.arg.order ? `<div class="cx"><span>محادثة بخصوص الطلب <b>#${P.arg.order}</b></span><button data-p="order" data-v="${P.arg.order}">عرض الطلب</button></div>` : ''}<div class="ms" id="ppms"></div><div id="pppv"></div>
<div class="cmp"><input type="file" id="ppci2" accept="image/*" hidden><button class="cb" data-p="cimg" aria-label="إرفاق صورة">${ic('img')}</button><textarea id="ppci" rows="1" maxlength="600" placeholder="اكتب رسالة..." enterkeyhint="send"></textarea><button class="cb snd off" id="ppsn" data-p="csend" aria-label="إرسال">${ic('send')}</button></div></div>`;
      addMsgs(j.msgs);
      every(async () => { if (P.view !== 'chatroom') return; const r = await api('chat/msgs', { uid: P.chatUid, after: P.chatLast }); if (r.msgs.length) addMsgs(r.msgs); }, 3000);
    },
  };

  function adCard(a) {
    const s = a.seller;
    return `<div class="c"><div class="rw tap" data-p="profile" data-v="${esc(s.uid)}" style="cursor:pointer">${avatar(s, 0)}<div class="sp"><div class="rw wr" style="gap:6px"><b>${esc(s.name)}</b>${lv(s.level)}</div>
<div class="mu" style="font-size:.76rem;margin-top:3px">${NF(s.stats.done)} صفقة · إتمام ${pct(s.stats.rate)} · ${stars(s.stats.avg)}${s.stats.n ? ` (${NF(s.stats.n)})` : ''}</div></div></div>
<div class="rw" style="margin-top:12px"><div class="sp"><div class="pr">${N2(a.price)} <small style="font-size:.74rem;font-weight:600">د.ع / 1000 نقطة</small></div><div class="mu" style="margin-top:2px">المتاح <b style="color:#fff">${NF(a.avail)}</b> نقطة · الحد ${NF(a.min)} – ${NF(a.max)}</div></div><button class="btn s" data-p="buy" data-v="${a.id}">شراء</button></div>
<div style="margin-top:10px">${a.methods.map((m) => `<span class="chip">${pmi(m.type, 14)}${esc(m.label)}</span>`).join(' ')}</div>${a.terms ? `<div class="mu" style="margin-top:8px;font-size:.76rem">📝 ${esc(a.terms)}</div>` : ''}</div>`;
  }

  function methodsForm(j, isApply) {
    const mt = j.mtypes, s = j.seller || {};
    return `${isApply ? `<div class="note">${ic('shield')}<span>أرقام حساباتك تظهر للمشتري عند إنشاء الطلب وللإدارة للمطابقة فقط. اكتب الاسم كما هو مسجّل في حسابك.</span></div>
<div class="c"><label style="margin-top:0">الاسم الثلاثي<input id="apn" value="${esc(s.full_name || '')}" maxlength="80"></label><label>رقم الهاتف<input id="apph" value="${esc(s.phone || '')}" inputmode="tel" dir="ltr" maxlength="20"></label></div>` : ''}
<div class="c"><b>طرق الدفع التي تقبلها</b><div id="mmw">${mmHtml(mt)}</div><button class="btn s o" style="margin-top:10px" data-p="mmadd">${ic('plus')} إضافة طريقة</button>
<label>نبذة قصيرة عنك (اختياري)<textarea id="apb" rows="2" maxlength="200">${esc(s.bio || '')}</textarea></label></div>
<button class="btn" data-p="${isApply ? 'applysend' : 'methodssave'}">${isApply ? 'إرسال الطلب للإدارة' : 'حفظ'}</button>`;
  }
  const PH = { superqi: 'رقم حساب سوبر كي / الهاتف', asiahawala: 'رقم هاتف آسيا حوالة', zaincash: 'رقم محفظة زين كاش', bank: 'رقم الحساب / IBAN' };
  const mmHtml = (mt) => P.mm.map((m, i) => `<div class="mrow" data-i="${i}"><div class="rw">${pmi(m.type, 30)}<select class="mmt">${Object.keys(mt).map((k) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${esc(mt[k])}</option>`).join('')}${mt[m.type] ? '' : `<option value="${esc(m.type)}" selected>${esc(m.label || m.type)} (قديمة)</option>`}</select>${P.mm.length > 1 ? `<button class="ib" data-p="mmdel" data-v="${i}" style="flex:none;color:#ff7a77">${ic('x')}</button>` : ''}</div>
${m.type === 'bank' ? `<select class="mmb"><option value="">— اختر المصرف —</option>${(P.banks || []).map((b) => `<option ${m.bank === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>` : ''}
<input class="mmh" placeholder="اسم صاحب الحساب" value="${esc(m.holder)}" maxlength="80"><input class="mmn" placeholder="${PH[m.type] || 'رقم الحساب / الهاتف'}" dir="ltr" inputmode="${m.type === 'bank' ? 'text' : 'tel'}" value="${esc(m.number)}" maxlength="64"></div>`).join('');
  const readMM = () => [...document.querySelectorAll('#mmw .mrow')].map((r) => ({ type: $('.mmt', r).value, label: '', holder: $('.mmh', r).value.trim(), number: $('.mmn', r).value.trim(), bank: $('.mmb', r) && $('.mmt', r).value === 'bank' ? $('.mmb', r).value : '' }));
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
  const dayLbl = (t) => { const d = new Date(t), n = new Date(), k = (x) => x.toDateString(); if (k(d) === k(n)) return 'اليوم'; if (k(d) === k(new Date(n - 864e5))) return 'أمس'; return d.toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' }); };
  function addMsgs(arr) {
    const box = $('#ppms'); if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 90 || !P.chatLast;
    arr.forEach((m) => { if (P.chatMsgs.some((x) => x.id === m.id)) return; P.chatMsgs.push(m); P.chatLast = Math.max(P.chatLast, m.id);
      const dl = dayLbl(m.t); if (dl !== P.chatDay) { P.chatDay = dl; const sp = document.createElement('div'); sp.className = 'dy'; sp.textContent = dl; box.appendChild(sp); }
      const d = document.createElement('div'); d.className = 'mb ' + (m.sys ? 's' : m.mine ? 'm' : 'o');
      d.innerHTML = (m.img ? `<img src="${SAFE_SRC(m.img)}" data-p="zoom" alt="">` : '') + (m.x ? esc(m.x) : '') + (m.sys ? '' : `<small>${new Date(m.t).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</small>`); box.appendChild(d); });
    if (near) box.scrollTop = box.scrollHeight;
  }
  function chatState() { const x = $('#ppci'), b = $('#ppsn'); if (!x || !b) return; x.style.height = 'auto'; x.style.height = Math.min(120, x.scrollHeight) + 'px'; b.classList.toggle('off', !x.value.trim() && !P.pimg); }
  function pvPaint() { const h = $('#pppv'); if (!h) return; h.innerHTML = P.pimg ? `<div class="pvw"><img src="${SAFE_SRC(P.pimg)}" alt=""><span>الصورة جاهزة للإرسال — أضف تعليقاً إن أردت</span><button data-p="cimgx" aria-label="إزالة">${ic('x')}</button></div>` : ''; chatState(); }
  function sheet(html) { closeSheet(); const o = document.createElement('div'); o.className = 'ov'; o.id = 'ppsh'; o.innerHTML = `<div class="sh">${html}</div>`; o.addEventListener('click', (e) => { if (e.target === o) closeSheet(); }); root.appendChild(o); }
  const closeSheet = () => { const o = $('#ppsh'); if (o) o.remove(); };
  const busy = async (btn, fn) => { if (P.busy) return; P.busy = true; if (btn) btn.disabled = true; try { await fn(); } catch (e) { say(e.message); } finally { P.busy = false; if (btn) btn.disabled = false; } };
  const copy = (t) => { try { navigator.clipboard.writeText(String(t)); say('تم النسخ'); } catch (e) { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); say('تم النسخ'); } catch (_) {} x.remove(); } };

  function buySheet(id) {
    const a = P.home.ads.find((x) => x.id === +id); if (!a) return say('الإعلان لم يعد متاحاً');
    P.buy = { a, pts: a.min, m: a.methods.length === 1 ? a.methods[0].i : -1 }; const mi = (a.methods.map((m, i) => i));
    sheet(`<div class="rw"><b class="sp" style="font-size:1.05rem">شراء من ${esc(a.seller.name)}</b>${lv(a.seller.level)}</div>
<div class="mu" style="margin-top:4px">السعر ${N2(a.price)} د.ع لكل 1000 نقطة · المتاح ${NF(a.avail)}</div>
<label>الكمية بالنقاط<input id="bpts" type="number" inputmode="numeric" value="${a.min}" min="${a.min}" max="${a.max}"></label>
<div class="rw wr" style="gap:6px;margin-top:8px">${[a.min, Math.round((a.min + a.max) / 2), a.max].filter((v, i, r) => r.indexOf(v) === i).map((v) => `<button class="chip" style="cursor:pointer;color:var(--ac)" data-p="bset" data-v="${v}">${NF(v)}</button>`).join('')}</div>
<label>طريقة الدفع</label>${a.methods.map((m) => `<label class="ck ${P.buy.m === m.i ? 'on' : ''}" style="color:#fff"><input type="radio" name="bm" value="${m.i}" ${P.buy.m === m.i ? 'checked' : ''}><span class="sp">${pmi(m.type, 22)} <b>${esc(m.label)}</b></span></label>`).join('')}
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
    if (e.target.id === 'ppci') chatState();
    else if (e.target.id === 'bpts') buyCalc();
    else if (e.target.id === 'adr') priceHint();
  }
  function onChange(e) {
    const t = e.target;
    if (t.classList.contains('mmt')) { P.mm = readMM(); $('#mmw').innerHTML = mmHtml(P.sm ? P.sm.mtypes : P.home.mtypes); return; }
    if (t.name === 'bm') { P.buy.m = +t.value; document.querySelectorAll('#ppsh .ck').forEach((x) => x.classList.toggle('on', x.contains(t))); }
    else if (t.classList.contains('adc')) t.closest('.ck').classList.toggle('on', t.checked);
    else if (t.id === 'ppf') { const f = t.files[0]; const v = $('#ppfv'); if (f && v) { v.src = URL.createObjectURL(f); v.style.display = 'block'; } }
    else if (t.id === 'ppci2') { const f = t.files[0]; t.value = ''; if (f) busy(null, async () => { P.pimg = await shrink(f, 1100); pvPaint(); const x = $('#ppci'); if (x) x.focus(); }); }
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
    if (a === 'mmadd') { P.mm = readMM(); if (P.mm.length >= 8) return say('الحد الأقصى 8 طرق'); P.mm.push({ type: 'superqi', holder: '', number: '', bank: '' }); $('#mmw').innerHTML = mmHtml(P.sm ? P.sm.mtypes : P.home.mtypes); return; }
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
      const img = await shrink(f); await api('order/proof', { id: +v, img }); say('تم تأكيد الدفع — بانتظار تحرير البائع ✅'); P.sig = ''; go('order', +v, false);
    });
    if (a === 'seeproof') return busy(b, async () => { const j = await api('order/proofimg', { id: +v }); const h = $('#ppim'); if (h) h.innerHTML = j.img ? `<img class="pf" src="${SAFE_SRC(j.img)}" data-p="zoom">` : '<div class="mu">لا توجد صورة</div>'; });
    if (a === 'cancel') { if (!confirm('إلغاء هذا الطلب؟')) return; return busy(b, async () => { await api('order/cancel', { id: +v }); say('تم إلغاء الطلب'); go('orders', null, false); }); }
    if (a === 'dwhy') { P.dnote = ($('#ppdn') || {}).value || ''; P.dwhy = v; P.sig = ''; return go('order', P.arg, false); }
    if (a === 'dsend') { const note = ($('#ppdn') || {}).value || ''; if (!P.dwhy) return say('اختر سبب النزاع'); if (P.dwhy === 'other' && note.trim().length < 5) return say('اكتب السبب'); if (!confirm('فتح نزاع على هذا الطلب؟ ستراجعه الإدارة.')) return;
      return busy(b, async () => { await api('order/dispute', { id: +v, reason: P.dwhy, note }); P.dwhy = ''; P.dnote = ''; say('تم فتح النزاع — الإدارة ستراجعه'); P.sig = ''; go('order', +v, false); }); }
    if (a === 'release') { if (!confirm('هل وصلك المبلغ فعلاً؟ سيتم تحويل النقاط للمشتري ولا يمكن التراجع.')) return;
      return busy(b, async () => { await api('order/release', { id: +v }); say('تم تحرير النقاط ✅'); P.sig = ''; go('order', +v, false); }); }
    if (a === 'flag') {
      let note = ''; if (b.dataset.f === 'dispute') { note = prompt('اكتب سبب النزاع (لم يصل المبلغ / المبلغ ناقص ...)'); if (!note) return; if (note.trim().length < 5) return say('اكتب سبباً أوضح'); }
      return busy(b, async () => { await api('order/flag', { id: +v, flag: b.dataset.f, note }); say('تم فتح النزاع — الإدارة ستراجعه'); P.sig = ''; go('order', +v, false); });
    }
    if (a === 'rate') return busy(b, async () => { if (!P.star) return say('اختر عدد النجوم'); await api('order/rate', { id: +v, stars: P.star, comment: ($('#ppcm') || {}).value || '' }); P.star = 0; say('شكراً لتقييمك ⭐'); P.sig = ''; go('order', +v, false); });
    if (a === 'applysend') return busy(b, async () => { const ar = await api('seller/apply', { full_name: ($('#apn') || {}).value, phone: ($('#apph') || {}).value, bio: ($('#apb') || {}).value, methods: readMM() }); say(ar && ar.approved === false ? 'أُرسل طلبك للإدارة' : 'تم تفعيل حسابك كبائع ✅'); P.sm = null; P.nav = []; go('seller', null, false); });
    if (a === 'methodssave') return busy(b, async () => { await api('seller/update', { bio: ($('#apb') || {}).value, methods: readMM() }); say('تم الحفظ'); P.sm = null; P.nav = []; go('seller', null, false); });
    if (a === 'adsave') return busy(b, async () => {
      const methods = [...document.querySelectorAll('.adc:checked')].map((x) => +x.value);
      await api('ad/save', { id: +v || 0, pts: +$('#adp').value || 0, price: +$('#adr').value, min: +$('#adm').value, max: +$('#adx').value, methods, terms: $('#adt').value });
      say(+v ? 'تم حفظ الإعلان' : 'تم نشر إعلانك ✅'); P.sm = null; P.nav = []; go('seller', null, false);
    });
    if (a === 'adact') { const f = b.dataset.f; if (f === 'close' && !confirm('إغلاق الإعلان واسترجاع النقاط غير المباعة؟')) return; return busy(b, async () => { await api('ad/act', { id: +v, act: f }); say('تم'); P.sm = null; go('seller', null, false); }); }
    if (a === 'csend') { const x = $('#ppci'); const t = x && x.value.trim(), im = P.pimg; if (!t && !im) return; x.value = ''; P.pimg = ''; pvPaint(); return busy(null, async () => { try { await sendMsg(t || '', im); x.focus(); } catch (er) { x.value = t || ''; P.pimg = im; pvPaint(); throw er; } }); }
    if (a === 'cimgx') { P.pimg = ''; return pvPaint(); }
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
  /* لوحة المفاتيح: يتبع الواجهة حجم الشاشة المرئية لتبقى خانة الكتابة فوق الكيبورد */
  (function () { const vv = window.visualViewport; if (!vv) return; const fit = () => { if (!root || !P.on) return; root.style.top = vv.offsetTop + 'px'; root.style.bottom = 'auto'; root.style.height = vv.height + 'px'; const m = $('#ppms'); if (m && document.activeElement && document.activeElement.id === 'ppci') m.scrollTop = m.scrollHeight; }; vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); })();
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

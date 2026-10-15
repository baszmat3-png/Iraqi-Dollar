/* لوحة الإدارة المتقدمة: المستخدمون · البلاغات · الدعم · الأسئلة الشائعة (تعمل على السيرفر) */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const dt = (t) => new Date(t).toLocaleString('ar-IQ');
  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'X-Admin-Key': key(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
    return j;
  }
  const shrink = (file, max = 1000) => new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  const css = document.createElement('style');
  css.textContent = `
#axb{position:fixed;bottom:18px;inset-inline-start:16px;z-index:9998;display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#00b6d4,#2bcfe2);color:#04222a;border:0;border-radius:99px;padding:12px 20px;font:700 15px Cairo,Tahoma,sans-serif;box-shadow:0 8px 26px #2bcfe255,0 2px 8px #000a;cursor:pointer}
#axb i{background:#ef5350;color:#fff;border-radius:99px;padding:1px 8px;font-style:normal;font-size:12px}#axb svg{width:20px;height:20px}
#axo{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#fff;background:radial-gradient(circle at 1px 1px,#ffffff10 1px,transparent 0) 0 0/28px 28px,#0E1621;font-size:15px;line-height:1.6}
#axo.on{display:flex}#axo *{box-sizing:border-box}
#axo .axh{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 10px;border-bottom:1px solid #ffffff0d;background:#0E1621ee}
#axo .axh h1{margin:0;font-size:1.35rem;flex:1;font-weight:700}#axo .axh .ci{width:42px;height:42px;border-radius:50%;background:hsl(193 55% 17%);color:#2bcfe2;display:grid;place-items:center}
#axo .axx{width:42px;height:42px;border-radius:13px;border:1.5px solid #27566b;background:hsl(193 58% 20%);color:#2bcfe2;display:grid;place-items:center;cursor:pointer;padding:0}
#axo svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#axo .axn{display:flex;gap:8px;padding:10px 12px;overflow-x:auto;border-bottom:1px solid #ffffff0d;scrollbar-width:none}#axo .axn::-webkit-scrollbar{display:none}
#axo .axn button{flex:none;display:flex;align-items:center;gap:7px;font:inherit;font-weight:600;border:1.5px solid #27566b;background:hsl(193 58% 17%);color:#2bcfe2;border-radius:99px;padding:7px 16px;cursor:pointer;white-space:nowrap}
#axo .axn button.on{background:#2bcfe2;color:#04222a;border-color:#2bcfe2}#axo .axn button svg{width:17px;height:17px}
#axo .axn button i{font-style:normal;background:#ef5350;color:#fff;border-radius:99px;font-size:.72rem;padding:0 7px;min-width:19px;text-align:center}
#axm{flex:1;overflow:auto;padding:14px 14px calc(30px + env(safe-area-inset-bottom,0px));max-width:880px;width:100%;margin:0 auto}
#axo .c{background:#1F2A37;border:1.5px solid #27566b;border-radius:22px;padding:14px;margin-bottom:12px}
#axo .c.hero{background:linear-gradient(135deg,hsl(187 67% 38%),hsl(187 74% 25%));border-color:hsl(187 63% 50%)}
#axo .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#axo .g{flex:1;min-width:0}
#axo .mu{color:#9AA9B5;font-size:.85rem}
#axo .b,#axo header button{font:inherit;font-weight:700;border:1.5px solid #2c4658;background:#1c2a36;color:#e8eef5;border-radius:14px;padding:9px 15px;cursor:pointer;white-space:nowrap}
#axo .b.p{background:linear-gradient(90deg,#00b6d4,#2bcfe2);color:#04222a;border-color:transparent;box-shadow:0 6px 18px #2bcfe233}
#axo .b.ok{background:linear-gradient(90deg,#1f9d55,#3ddc68);color:#06210f;border-color:transparent}
#axo .b.d{color:#ff7a75;background:#3a2025;border-color:#7a3a3a}#axo .b.s{padding:6px 12px;font-size:.85rem;border-radius:11px}
#axo .b:active{transform:scale(.97)}
#axo input,#axo textarea,#axo select{width:100%;background:#0b141c;color:#fff;border:1.5px solid #27566b;border-radius:16px;padding:12px 14px;margin:5px 0;font:inherit}
#axo input:focus,#axo textarea:focus,#axo select:focus{outline:0;border-color:#2bcfe2;box-shadow:0 0 0 3px #2bcfe229}
#axo input[type=checkbox]{width:22px;height:22px;margin:0;accent-color:#2bcfe2;flex:none}
#axo .kg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
@media(min-width:640px){#axo .kg{grid-template-columns:repeat(3,1fr)}}
#axo .k{background:linear-gradient(160deg,hsl(193 50% 21%),hsl(193 45% 15%));border:1.5px solid #27566b;border-radius:20px;padding:12px 14px}
#axo .k small{display:flex;align-items:center;gap:6px;color:#9AA9B5;font-size:.8rem}#axo .k small svg{width:16px;height:16px;color:#2bcfe2}
#axo .k b{display:block;font-size:1.45rem;line-height:1.3;margin-top:2px}#axo .k em{font-style:normal;font-size:.75rem;color:#6fd3a0}
#axo .sh{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 8px;font-weight:700;font-size:1.1rem}#axo .sh:before{content:"";width:5px;height:20px;border-radius:3px;background:#2bcfe2;margin-inline-end:10px}
#axo .sh span{flex:1}
#axo .av{position:relative;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;overflow:hidden;box-shadow:inset 0 0 0 2px #ffffff30;background:linear-gradient(135deg,hsl(var(--hu) 65% 48%),hsl(calc(var(--hu) + 40) 70% 32%))}
#axo .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#axo .uc{display:flex;gap:12px;align-items:flex-start}#axo .uc .g b{font-size:1.05rem}
#axo .bal{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
#axo .bal span{display:flex;align-items:center;gap:6px;background:#0b141c;border:1px solid #27566b;border-radius:12px;padding:4px 11px;font-size:.88rem}#axo .bal span svg{width:15px;height:15px;color:#2bcfe2}
#axo .tg{display:inline-block;font-size:.72rem;font-weight:700;border-radius:99px;padding:1px 10px;margin-inline-start:6px;vertical-align:middle}
#axo .tg.d{background:#ef535033;color:#ff7a75}#axo .tg.w{background:#f1c40f26;color:#f1c40f}#axo .tg.o{background:#1f9d5540;color:#5fe58b}#axo .tg.i{background:#2bcfe226;color:#2bcfe2}
#axo .bb{max-width:85%;padding:9px 14px;border-radius:18px;margin:6px 0;overflow-wrap:anywhere}#axo .u{background:#1f2a37;border:1px solid #27566b}#axo .a{background:hsl(187 67% 33%);margin-inline-start:auto}
#axo img.s{max-width:100%;border-radius:12px;margin-top:6px}
#axo .lst{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d}#axo .lst:last-child{border:0}
#axo .pg{height:8px;border-radius:99px;background:#0b141c;overflow:hidden}#axo .pg i{display:block;height:100%;background:linear-gradient(90deg,#00b6d4,#2bcfe2)}
#axmod{position:absolute;inset:0;background:#000b;display:none;align-items:flex-end;justify-content:center;z-index:5}#axmod.on{display:flex}
#axmod .sheet{width:min(520px,100%);max-height:92vh;overflow:auto;background:#212c39;border:1.5px solid #27566b;border-radius:28px 28px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));animation:axup .25s ease}
@media(min-width:640px){#axmod{align-items:center}#axmod .sheet{border-radius:28px}}
@keyframes axup{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#axmod h2{margin:0 0 12px;font-size:1.25rem}
#axo .seg{display:flex;border:1.5px solid #27566b;border-radius:16px;padding:4px;background:#0b141c;margin:6px 0 10px}#axo .seg button{flex:1;border:0;background:none;color:#9AA9B5;border-radius:12px;padding:8px;font:inherit;font-weight:700;cursor:pointer}#axo .seg button.on{background:#2bcfe2;color:#04222a}
#axo .fl{display:flex;align-items:center;gap:10px;background:#0b141c;border:1.5px solid #27566b;border-radius:16px;padding:2px 12px;margin:8px 0}#axo .fl svg{color:#2bcfe2;flex:none}#axo .fl input{border:0;background:none;margin:0;padding:10px 0;box-shadow:none!important}#axo .fl label{min-width:62px;color:#9AA9B5;font-size:.9rem}
#axt{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);z-index:9;background:#2bcfe2;color:#04222a;font-weight:700;border-radius:99px;padding:10px 22px;box-shadow:0 8px 26px #000a;max-width:92vw;text-align:center;display:none}#axt.on{display:block}#axt.bad{background:#ef5350;color:#fff}
`;
  document.head.appendChild(css);

  const I = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', head: '<path d="M4 14v-2a8 8 0 0116 0v2M4 14h3v5H4zM17 14h3v5h-3zM20 19a4 4 0 01-4 3h-3"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-5h4v5"/>', coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 00-2.5-1.5c-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.8 2.2 0 01-2.7-1.6M12 6v2M12 16v2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l-2 6 5 12M15 3l2 6-5 12"/>', dollar: '<path d="M12 2v20M17 6.5C16 5 14.3 4.5 12 4.5c-2.8 0-4.5 1.1-4.5 3 0 4.5 9 2.2 9 7 0 1.900-1.800 3-4.500 3-2.300 0-4.100-.7-5-2.500"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', chat: '<path d="M21 12a8 8 0 01-11.700 7L4 20l1.200-4.200A8 8 0 1121 12z"/>', shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  I.heart = '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z"/>';
  const ico = (n) => `<svg viewBox="0 0 24 24">${I[n] || ''}</svg>`;
  const TABS = [['overview', 'نظرة عامة', 'home'], ['users', 'المستخدمون', 'users'], ['reports', 'البلاغات', 'flag'], ['support', 'الدعم', 'head'], ['merchants', 'التجار', 'store'], ['fin', 'المالية', 'coin'], ['ledger', 'سجل العمليات', 'list'], ['faq', 'الأسئلة الشائعة', 'help'], ['campaigns', 'حملات التبرع', 'heart'], ['agents', 'مراقبة الوكلاء', 'users']];
  const btn = document.createElement('button');
  btn.id = 'axb'; btn.innerHTML = ico('shield') + 'إدارة متقدمة<i hidden></i>';
  const ov = document.createElement('div');
  ov.id = 'axo';
  ov.innerHTML = `<div class="axh"><div class="ci">${ico('shield')}</div><h1>الإدارة المتقدمة</h1><button class="axx" data-x="1" aria-label="إغلاق">${ico('x')}</button></div>
<div class="axn">${TABS.map((t) => `<button data-t="${t[0]}">${ico(t[2])}<span>${t[1]}</span><i hidden data-bd="${t[0]}"></i></button>`).join('')}</div><div id="axm"></div><div id="axmod"></div><div id="axt"></div>`;
  document.body.append(btn, ov);
  const M = ov.querySelector('#axm');

  const cpImg = {};
  let agSel = '';
  let lf = { kind: '', cat: '', q: '' }, tab = 'overview', thread = null, rep = 'open', busy = false, shot = null, uq = '';

  const err = (e) => { M.insertAdjacentHTML('afterbegin', `<div class="c" style="color:#ef5350">${esc(e.message)}</div>`); };

  const hue = (x) => { let h = 7; for (const c of String(x || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const av = (u, z) => `<span class="av" style="width:${z}px;height:${z}px;font-size:${Math.round(z * 0.42)}px;--hu:${hue(u.email)}">${esc(String(u.name || u.email || '?').trim().charAt(0).toUpperCase() || '?')}${u.av ? `<img loading="lazy" alt="" src="/api/m/avatar?e=${encodeURIComponent(String(u.email).toLowerCase())}&v=${u.av}" onerror="this.remove()">` : ''}</span>`;
  const flash = (m, bad) => { const t = ov.querySelector('#axt'); t.textContent = m; t.className = 'on' + (bad ? ' bad' : ''); clearTimeout(flash.k); flash.k = setTimeout(() => (t.className = ''), 3200); };
  const modal = (html) => { const m = ov.querySelector('#axmod'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.add('on'); };
  const closeModal = () => ov.querySelector('#axmod').classList.remove('on');
  let chMode = 'add';
  function chargeModal(email, name, mode) {
    chMode = mode || 'add';
    const T = { add: ['شحن رصيد', 'تنفيذ الشحن فوراً'], sub: ['خصم من الرصيد', 'تنفيذ الخصم فوراً'], set: ['تعيين الرصيد', 'تعيين الرصيد فوراً'] };
    modal(`<h2>${T[chMode][0]}: ${esc(name)}</h2><div class="mu" dir="ltr" style="text-align:start;margin-bottom:6px">${esc(email)}</div>
<div class="seg"><button data-m="add" class="${chMode === 'add' ? 'on' : ''}">شحن +</button><button data-m="sub" class="${chMode === 'sub' ? 'on' : ''}">خصم −</button><button data-m="set" class="${chMode === 'set' ? 'on' : ''}">تعيين =</button></div>
<div class="fl">${ico('coin')}<label>النقاط</label><input id="cp" type="number" inputmode="numeric" min="0" placeholder="0"></div>
<div class="fl">${ico('gem')}<label>الجواهر</label><input id="cg" type="number" inputmode="numeric" min="0" placeholder="0"></div>
<div class="fl">${ico('dollar')}<label>الدولار</label><input id="cu" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div>
<input id="cn" placeholder="ملاحظة (اختياري)">
<div class="mu" style="margin:6px 0 10px">${chMode === 'set' ? 'اترك الحقل فارغاً لعدم تغيير ذلك الرصيد.' : 'يُنفَّذ فوراً ويصل إلى جهاز المستخدم خلال ثوانٍ.'}</div>
<div class="r"><button class="b p g" data-a="cgo" data-e="${esc(email)}" data-n="${esc(name)}">${T[chMode][1]}</button><button class="b" data-mc="1">إلغاء</button></div>`);
    const sg = ov.querySelector('#axmod .seg'); sg.onclick = (ev) => { const b = ev.target.closest('[data-m]'); if (b) chargeModal(email, name, b.dataset.m); };
  }
  function zeroModal(email, name) {
    modal(`<h2>تصفير رصيد: ${esc(name)}</h2><div class="mu" dir="ltr" style="text-align:start;margin-bottom:10px">${esc(email)}</div>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zp" checked>${ico('coin')}<span class="g">النقاط</span></label>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zg" checked>${ico('gem')}<span class="g">الجواهر</span></label>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zd" checked>${ico('dollar')}<span class="g">الدولار</span></label>
<div class="mu" style="margin:8px 0 10px">يُنفَّذ فوراً ولا يمكن التراجع عنه.</div>
<div class="r"><button class="b d g" data-a="zgo" data-e="${esc(email)}" data-n="${esc(name)}">تصفير فوري</button><button class="b" data-mc="1">إلغاء</button></div>`);
  }
  const fmtAfter = (a) => `الرصيد الآن: ${nf(a.pts)} نقطة · ${nf(a.gems)} جوهرة · $${nf(a.usd)}`;

  const V = {
    async overview() {
      const j = await api('/api/ctl/overview'), u = j.users || {}, rp = j.reports || {}, sp = j.support || {}, mc = j.merchants || {}, fr = j.friends || {}, ms = j.msgs || {}, wd = j.withdrawals || {};
      const k = (ic, l, v, em) => `<div class="k"><small>${ico(ic)}${l}</small><b>${v}</b>${em ? `<em>${em}</em>` : ''}</div>`;
      const att = (n, l, t, ic) => `<div class="lst"><span class="av" style="width:38px;height:38px;--hu:187">${ico(ic)}</span><div class="g"><b>${l}</b><div class="mu">${n ? 'يحتاج إلى معالجة' : 'لا يوجد شيء معلّق'}</div></div><span class="tg ${n ? 'd' : 'o'}">${nf(n)}</span>${t ? `<button class="b s" data-t="${t}">فتح</button>` : ''}</div>`;
      return `<div class="c hero"><div class="r"><div class="g"><div style="font-size:1.25rem;font-weight:700">نظرة عامة على المنصة</div><div class="mu" style="color:#d7f6fb">${new Date().toLocaleString('ar-IQ')}</div></div><span class="av" style="width:50px;height:50px;--hu:187">${ico('shield')}</span></div></div>
<div class="kg">${k('users', 'المستخدمون الحقيقيون', nf(u.real), 'جدد اليوم: ' + nf(u.new_day) + ' · الأسبوع: ' + nf(u.new_week))}${k('bolt', 'متصلون الآن', nf(u.online), 'نشطون خلال 24 ساعة: ' + nf(u.day))}${k('shield', 'حسابات موثقة', nf(u.kyc), 'محظورة: ' + nf(u.blk) + ' · تجريبية: ' + nf(u.demo))}
${k('coin', 'إجمالي النقاط', nf(u.pts))}${k('gem', 'إجمالي الجواهر', nf(u.gems))}${k('dollar', 'إجمالي الدولار', '$' + nf(u.usd))}</div>
<div class="sh"><span>يحتاج إلى إجراء</span></div><div class="c">${att(rp.open, 'بلاغات مفتوحة', 'reports', 'flag')}${att(sp.unread, 'رسائل دعم غير مقروءة', 'support', 'head')}${att(mc.pending, 'طلبات تجار بانتظار الموافقة', 'merchants', 'store')}${att(wd.pending, 'طلبات سحب معلقة', '', 'coin')}</div>
<div class="sh"><span>النشاط الاجتماعي</span></div><div class="kg">${k('users', 'صداقات مقبولة', nf(fr.accepted), 'طلبات معلقة: ' + nf(fr.pending))}${k('chat', 'رسائل المستخدمين', nf(ms.total), 'آخر 24 ساعة: ' + nf(ms.day))}${k('store', 'التجار', nf(mc.active), 'مستلم: ' + nf(mc.received) + ' نقطة')}</div>
<div class="sh"><span>أعلى الأرصدة</span><button class="b s" data-t="users">كل المستخدمين</button></div><div class="c">${(j.top || []).map((x) => `<div class="lst">${av(x, 40)}<div class="g"><b>${esc(x.name || x.email)}</b><div class="mu" dir="ltr" style="text-align:start">${esc(x.email)}</div></div><div style="text-align:end"><b>${nf(x.pts)}</b><div class="mu">${nf(x.gems)} جوهرة · $${nf(x.usd)}</div></div></div>`).join('') || '<div class="mu">لا بيانات</div>'}</div>
<div class="sh"><span>أحدث المنضمين</span></div><div class="c">${(j.joined || []).map((x) => `<div class="lst">${av(x, 38)}<div class="g"><b>${esc(x.name || x.email)}</b><div class="mu" dir="ltr" style="text-align:start">${esc(x.email)}</div></div><span class="mu">${dt(x.created_at)}</span></div>`).join('') || '<div class="mu">لا بيانات</div>'}</div>
<div class="sh"><span>آخر عمليات الشحن والتصفير</span></div><div class="c">${(j.recent || []).map((x) => `<div class="lst"><span class="tg ${x.op === 'add' ? 'o' : x.op === 'sub' || x.op === 'zero' ? 'd' : 'i'}">${{ add: 'شحن', sub: 'خصم', zero: 'تصفير', set: 'تعيين' }[x.op] || x.op}</span><div class="g" dir="ltr" style="text-align:start">${esc(x.email)}</div><div class="mu" style="text-align:end">${x.pts ? nf(x.pts) + ' نقطة ' : ''}${x.gems ? nf(x.gems) + ' جوهرة ' : ''}${x.usd ? '$' + nf(x.usd) : ''}<div>${dt(x.created_at)}</div></div></div>`).join('') || '<div class="mu">لا عمليات بعد</div>'}</div>`;
    },
    async users() {
      const j = await api('/api/ctl/users?q=' + encodeURIComponent(uq));
      return `<div class="c"><div class="r"><input id="uq" class="g" placeholder="بحث بالبريد أو الاسم أو الرقم أو الكود" value="${esc(uq)}"><button class="b p" data-a="usearch">بحث</button></div>
<div class="mu" style="margin-top:6px">كل الحسابات: ${j.total.n} · تجريبية: ${j.total.demo} · محظورة: ${j.total.blk}</div>
<button class="b d s" data-a="purge" style="margin-top:8px">حذف الحسابات التجريبية فقط</button></div>` +
        j.users.map((u) => `<div class="c"><div class="uc">${av(u, 56)}<div class="g"><b>${esc(u.name || '—')}</b>${u.kyc ? '<span class="tg o">موثق</span>' : ''}${u.demo ? '<span class="tg i">تجريبي</span>' : ''}${u.blk ? '<span class="tg d">محظور</span>' : ''}
<div class="mu" dir="ltr" style="text-align:start">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</div><div class="mu">${u.rcode ? 'الكود: <b dir="ltr">' + esc(u.rcode) + '</b> · ' : ''}آخر ظهور: ${u.last_seen ? dt(u.last_seen) : '—'}</div></div></div>
<div class="bal"><span>${ico('coin')}${nf(u.pts)} نقطة</span><span>${ico('gem')}${nf(u.gems)} جوهرة</span><span>${ico('dollar')}$${nf(u.usd)}</span></div>
<div class="r"><button class="b p s" data-a="uch" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">شحن</button><button class="b s" data-a="udd" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">خصم</button><button class="b s" data-a="uzero" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">تصفير</button>
<button class="b s" data-a="${u.blk ? 'unban' : 'ban'}" data-e="${esc(u.email)}">${u.blk ? 'فك الحظر' : 'حظر'}</button><button class="b s" data-a="chat" data-e="${esc(u.email)}">مراسلة</button><button class="b d s" data-a="del" data-e="${esc(u.email)}">حذف</button></div></div>`).join('');
    },
    async merchants() {
      const j = await api('/api/ctl/merchants'), B = { pending: ['بانتظار الموافقة', 'w'], active: ['معتمد', 'o'], suspended: ['موقوف', 'd'], rejected: ['مرفوض', 'd'] };
      const row = (l, v) => (v ? `<div class="r" style="margin-top:4px"><span class="mu" style="min-width:92px">${l}</span><b class="g">${esc(v)}</b></div>` : '');
      const card = (m) => `<div class="c" data-m="${m.id}"><div class="r"><b style="font-size:1.1rem" class="g">${esc(m.name)}</b><span class="tg ${(B[m.status] || ['', 'i'])[1]}">${(B[m.status] || [m.status])[0]}</span></div>
${row('صاحب الحساب', (m.owner_name ? m.owner_name + ' — ' : '') + m.owner)}${row('الهاتف', m.phone)}${row('المحافظة', m.province)}${row('المنطقة', m.area)}${row('أقرب دالة', m.landmark)}${row('رمز الإحالة', m.ref_code)}${m.fee ? row('الرسوم المدفوعة', nf(m.fee) + ' نقطة') : ''}
<div class="mu" style="margin-top:6px">خصم ${m.discount}% · السقف اليومي: ${m.cap ? nf(m.cap) : 'غير محدد'} · اليوم: ${nf(m.today)} · الإجمالي: ${nf(m.total)}</div>
${m.status === 'pending' ? `<div class="r" style="margin-top:8px"><input class="mcap g" type="number" placeholder="السقف اليومي (نقاط)" value="${m.cap || ''}"><input class="mdis" type="number" placeholder="الخصم %" value="${m.discount}" style="max-width:100px"></div><input class="mnote" placeholder="سبب الرفض (اختياري)">
<div class="r" style="margin-top:6px"><button class="b ok" data-a="msave" data-st="active">موافقة وتفعيل</button><button class="b d" data-a="mreject">رفض وإعادة الرسوم</button></div>`
          : `<div class="r" style="margin-top:8px"><input class="mcap g" type="number" placeholder="السقف اليومي (نقاط)" value="${m.cap || ''}"><input class="mdis" type="number" placeholder="الخصم %" value="${m.discount}" style="max-width:100px"></div>
<div class="r" style="margin-top:6px"><button class="b p" data-a="msave" data-st="${m.status === 'rejected' ? 'pending' : 'active'}">${m.status === 'active' ? 'حفظ' : m.status === 'rejected' ? 'إعادة للمراجعة' : 'تفعيل'}</button>${m.status === 'active' ? '<button class="b" data-a="msave" data-st="suspended">إيقاف</button>' : ''}<button class="b d" data-a="mdel">حذف</button></div>`}</div>`;
      const pend = j.merchants.filter((m) => m.status === 'pending'), rest = j.merchants.filter((m) => m.status !== 'pending');
      return `<div class="c"><button class="b p" data-a="madd">${ico('plus')} إضافة تاجر معتمد</button><div class="mu" style="margin-top:6px">طلبات التجار تصل هنا بعد استقطاع الرسوم من المستخدم. عند الرفض تُعاد الرسوم تلقائياً.</div></div>` +
        (pend.length ? `<div class="sh"><span>طلبات بانتظار الموافقة</span><span class="tg d">${pend.length}</span></div>` + pend.map(card).join('') : '') +
        `<div class="sh"><span>المتاجر</span></div>` + (rest.length ? rest.map(card).join('') : '<div class="c mu">لا توجد متاجر بعد</div>');
    },
    async reports() {
      const j = await api('/api/ctl/reports?status=' + rep);
      return `<div class="r" style="margin-bottom:10px"><button class="b ${rep === 'open' ? 'p' : ''}" data-a="rtab" data-v="open">المفتوحة</button><button class="b ${rep === 'closed' ? 'p' : ''}" data-a="rtab" data-v="closed">المعالجة</button></div>` +
        (j.reports.map((r) => `<div class="c"><div class="r"><b>${esc(r.reason)}</b><span class="g"></span><span class="mu">${dt(r.created_at)}</span></div>
<div class="mu" dir="ltr">المبلِّغ: ${esc(r.reporter)}</div><div dir="ltr">المبلَّغ عنه: <b>${esc(r.target)}</b> ${r.target_blk ? '<span style="color:#ef5350">[محظور]</span>' : ''}</div>
<p>${esc(r.details)}</p>${r.shot ? `<img class="s" src="${r.shot}">` : ''}${r.status !== 'open' ? `<div class="mu">الحالة: ${esc(r.status)} ${esc(r.note || '')}</div>` : `
<textarea id="rn${r.id}" rows="2" placeholder="ملاحظة أو نص التنبيه لصاحب الحساب"></textarea>
<div class="r"><button class="b d" data-a="rban" data-id="${r.id}">حظر الحساب</button><button class="b" data-a="rwarn" data-id="${r.id}">تنبيه صاحب الحساب</button><button class="b" data-a="rclose" data-id="${r.id}">إغلاق</button></div>`}</div>`).join('') || '<div class="c mu">لا توجد بلاغات</div>');
    },
    async support() {
      if (thread) {
        const j = await api('/api/ctl/support/thread?e=' + encodeURIComponent(thread));
        return `<div class="r"><button class="b" data-a="back">← المحادثات</button><b dir="ltr">${esc(thread)}</b></div><div class="c" id="axt">` +
          j.messages.map((m) => `<div class="bb ${m.from_admin ? 'a' : 'u'}">${esc(m.body)}${m.img ? `<img class="s" src="${m.img}">` : ''}<div class="mu">${dt(m.created_at)}</div></div>`).join('') +
          `</div><textarea id="ar" rows="2" placeholder="اكتب الرد..."></textarea><div class="r"><label class="b">صورة<input id="af" type="file" accept="image/*" hidden></label><span id="an" class="mu"></span><span class="g"></span><button class="b p" data-a="areply">إرسال</button></div>`;
      }
      const j = await api('/api/ctl/support/threads');
      return j.threads.map((t) => `<div class="c" data-a="open" data-e="${esc(t.email)}" style="cursor:pointer"><div class="r"><b>${esc(t.name || t.email)}</b>${t.unread ? `<span style="background:#ef5350;border-radius:99px;padding:0 8px">${t.unread}</span>` : ''}<span class="g"></span><span class="mu">${dt(t.created_at)}</span></div>
<div class="mu">${t.from_admin ? 'أنت: ' : ''}${esc(t.has_img && !t.body ? '📷 صورة' : t.body).slice(0, 90)}</div></div>`).join('') || '<div class="c mu">لا توجد محادثات. المحادثات تُحفظ دائماً ولا تُحذف.</div>';
    },
    async fin() {
      const [j, c] = await Promise.all([api('/api/ctl/fin2/summary'), api('/api/ctl/fin2/costs')]);
      const S = j.settings, L = j.liability, row = (a, b, col) => `<div class="r"><span class="g">${a}</span><b${col ? ` style="color:${col}"` : ''}>${b}</b></div>`;
      const names = new Set(c.items.map((x) => x.name)), extra = (typeof PR !== 'undefined' ? PR.map((p) => p[0]) : []).filter((n) => !names.has(n)).map((name) => ({ name, kind: 'product', buy: 0, sell: 0 }));
      const costRow = (x) => `<div class="c" data-cn="${esc(x.name)}" data-ck="${x.kind}"><b>${esc(x.name)}</b><div class="r"><input class="cb" type="number" placeholder="سعر الشراء (د.ع)" value="${x.buy || ''}"><input class="cs" type="number" placeholder="سعر البيع (د.ع)" value="${x.sell || ''}"><button class="b p" data-a="csave">حفظ</button></div></div>`;
      return `<div class="c"><div class="mu">رصيد صاحب التطبيق${j.since ? ' · منذ آخر إعادة تعيين ' + dt(j.since) : ''}</div><div style="font-size:1.6rem;font-weight:700">${nf(j.owner.balance)} د.ع</div>
<div class="mu" style="margin-top:6px">مصدر الرصيد:</div>${j.owner.sources.map((x) => row(esc(x.label), nf(x.iqd), x.iqd < 0 ? '#ef5350' : '')).join('')}</div>
<div class="c"><b>الأرباح: ${nf(j.profit)} د.ع</b>${j.parts.map((x) => row(esc(x.label), nf(x.iqd))).join('')}</div>
<div class="c"><b>المبيعات</b>${row('عدد القطع المباعة', nf(j.sales.units))}${row('إجمالي البيع', nf(j.sales.revenue) + ' د.ع')}${row('هامش الربح', j.sales.margin + '%')}</div>
<div class="c"><b>الأكثر طلباً</b>${j.top.map((t) => `<div style="margin-top:6px">${esc(t.name)} ${t.missing ? '<span style="color:#f0b429" class="mu">(بلا سعر شراء/بيع)</span>' : ''}<div class="mu">العدد ${nf(t.units)} · البيع ${nf(t.revenue)} · الربح ${nf(t.profit)}</div></div>`).join('') || '<div class="mu">لا مبيعات بعد</div>'}</div>
<div class="c"><b>أموال المستخدمين الواجب إرجاعها (${L.months} أشهر)</b>${row('المستلم من العدادات', nf(L.received))}${row('رُدّ كعوائد', nf(L.paid))}${row('المتبقي', nf(L.outstanding))}${row('المطلوب تحويله شهرياً', nf(L.monthly) + ' د.ع', '#2bcfe2')}</div>
<div class="c"><b>الإعدادات</b><div class="mu">إيميل حساب التطبيق (يُخفى من الإحصائيات)</div><input id="fa" dir="ltr" value="${esc(S.app_email)}"><label class="r"><input id="fh" type="checkbox" style="width:auto" ${S.hide_app ? 'checked' : ''}> إخفاء رصيد حساب التطبيق وعدم احتسابه</label>
<div class="r"><input id="fm" type="number" placeholder="أشهر الإرجاع" value="${S.months}"><input id="fd" type="number" placeholder="% ربح الاستدانة من القسط" value="${S.debt_pct}"></div>
<div class="r"><input id="fo" type="number" placeholder="الرصيد الافتتاحي (د.ع)" value="${S.open_bal || ''}"><input id="fs" placeholder="مصدر الرصيد الافتتاحي" value="${esc(S.open_src)}"></div>
<div class="r"><button class="b p" data-a="fset">حفظ</button><button class="b d" data-a="freset">إعادة تعيين الإحصائيات والبدء من جديد</button></div><div class="mu">إعادة التعيين لا تحذف السجل، فقط تبدأ الحساب من الآن.</div></div>
<b>أسعار الشراء والبيع</b><div class="mu" style="margin-bottom:6px">الربح = (البيع − الشراء) × العدد، ويُحسب بعد حفظ السعرين.</div>${c.items.concat(extra).map(costRow).join('')}`;
    },
    async ledger() {
      const j = await api(`/api/ctl/fin2/ledger?kind=${lf.kind}&cat=${lf.cat}&q=${encodeURIComponent(lf.q)}`);
      return `<div class="c"><div class="r"><select id="lk"><option value="">الكل</option><option value="in" ${lf.kind === 'in' ? 'selected' : ''}>إيرادات</option><option value="out" ${lf.kind === 'out' ? 'selected' : ''}>مصروفات</option></select>
<select id="lc"><option value="">كل التصنيفات</option>${Object.entries(j.cats).map(([k, v]) => `<option value="${k}" ${lf.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
<div class="r"><input id="lq" class="g" placeholder="بحث بالبريد أو التفاصيل" value="${esc(lf.q)}"><button class="b p" data-a="lfilter">تطبيق</button></div>
<div class="mu">إيرادات ${nf(j.totals.in)} · مصروفات ${nf(j.totals.out)} · الصافي ${nf(j.totals.in - j.totals.out)} د.ع</div></div>
<div class="c"><b>إضافة قيد يدوي</b><div class="r"><select id="mk"><option value="in">إيراد</option><option value="out">مصروف</option></select><input id="mc" placeholder="التصنيف (مثل: إيجار)"></div><div class="r"><input id="mi" type="number" placeholder="المبلغ (د.ع)"><input id="mn" class="g" placeholder="التفاصيل"></div><button class="b p" data-a="ladd">إضافة</button></div>` +
        (j.rows.map((r) => `<div class="c" style="${r.pre_reset ? 'opacity:.6' : ''}"><div class="r"><b style="color:${r.kind === 'in' ? '#4caf50' : '#ef5350'}">${r.kind === 'in' ? '+' : '−'}${nf(r.iqd)} د.ع</b><span class="mu">${esc(r.cat_label)}</span><span class="g"></span><span class="mu">${dt(r.ts)}</span></div>
<div class="mu" dir="ltr">من: ${esc(r.from)} ← إلى: ${esc(r.to)}${r.app ? ' [حساب التطبيق]' : ''}</div><div>${esc(r.note || '')}</div>${r.src === 'manual' ? `<button class="b d" data-a="ldel" data-id="${esc(r.uid)}">حذف</button>` : ''}</div>`).join('') || '<div class="c mu">لا توجد حركات</div>');
    },
    async agents() {
      if (agSel) {
        const [L, J] = await Promise.all([api('/api/ctl/agents/log?email=' + encodeURIComponent(agSel)), api('/api/ctl/agents')]);
        const a = J.items.find((x) => x.email === agSel) || { name: agSel };
        return `<button class="b s" data-a="agback">← كل الوكلاء</button><div class="sh"><span>${esc(a.name)} · حركات الوكيل</span></div><div class="mu" dir="ltr" style="text-align:start;margin-bottom:8px">${esc(agSel)}</div>` + (L.items.map((r) => `<div class="c"><div class="r"><b>${esc(r.label)}</b><span class="g"></span><b style="color:${r.pts < 0 ? '#ef5350' : '#3ddc68'}">${r.pts ? (r.pts > 0 ? '+' : '') + nf(r.pts) + ' نقطة' : r.usd ? '$' + nf(r.usd) : ''}</b></div>${r.who ? `<div class="mu">${esc(r.who)}</div>` : ''}${r.note ? `<div class="mu">${esc(r.note)}</div>` : ''}<div class="mu" style="font-size:.75rem">${dt(r.t)}</div></div>`).join('') || '<div class="c mu">لا توجد حركات مسجلة لهذا الوكيل بعد</div>');
      }
      const j = await api('/api/ctl/agents');
      const st = (l, v) => `<div style="flex:1;min-width:46%;margin:4px 0"><div class="mu">${l}</div><b>${v}</b></div>`;
      return '<div class="mu" style="margin-bottom:8px">إجمالي كل وكيل: ما باعه، وما حُوّل إليه، وما أضافه لرصيده الرسمي، وسحوباته. الحركات تُسجَّل منذ تحديث هذه النسخة.</div>' + (j.items.map((a) => `<div class="c"><div class="r"><b>${esc(a.name)}</b><span class="g"></span><span class="mu">${a.last ? 'آخر حركة ' + dt(a.last) : 'لا حركات'}</span></div><div class="mu" dir="ltr" style="text-align:start">${esc(a.email)}</div><div class="r" style="flex-wrap:wrap;margin-top:6px">${st('رصيد حسابه', nf(a.balance) + ' نقطة')}${st('السيولة', nf(a.liq))}${st('الرصيد الرسمي', nf(a.off))}${st('باع (شحن أعضاء)', nf(a.sold.pts) + ' نقطة · ' + a.sold.n + ' عملية · ' + a.sold.members + ' عضو')}${st('حُوّل إليه من مستخدمين', nf(a.recv.pts) + ' نقطة · ' + a.recv.n + ' عملية')}${st('أضاف للرصيد الرسمي', nf(a.addoff.pts) + ' نقطة · ' + a.addoff.n)}${st('طلبات شراء بالسعر الرسمي', nf(a.buy.pts) + ' نقطة · ' + a.buy.n)}${st('شحن/خصم الإدارة', '+' + nf(a.admin.plus) + ' / −' + nf(a.admin.minus))}${st('طلبات سحب الرصيد', '$' + nf(a.wd.usd) + ' · ' + a.wd.n + (a.wd.pending ? ' (' + a.wd.pending + ' قيد المراجعة)' : ''))}</div><div class="r" style="margin-top:8px"><span class="g"></span><button class="b p" data-a="aglog" data-e="${esc(a.email)}">كل حركاته</button></div></div>`).join('') || '<div class="c mu">لا يوجد وكلاء معتمدون في الإعدادات المنشورة</div>');
    },
    async campaigns() {
      const j = await api('/api/ctl/campaigns');
      const row = (c) => { const id = c.id || 0; return `<div class="c" data-cp="${id}"><input class="cpt" placeholder="اسم الحملة (مثال: فشل كلوي)" value="${esc(c.title || '')}"><textarea class="cpd" rows="4" placeholder="وصف الحالة المرضية">${esc(c.descr || '')}</textarea><div class="r"><input class="cpg g" type="number" min="0" placeholder="الهدف بالنقاط (0 = بلا هدف)" value="${c.goal || ''}"><label class="mu" style="display:flex;align-items:center;gap:6px;white-space:nowrap"><input type="checkbox" class="cpa" style="width:auto" ${c.active === false ? '' : 'checked'}> تظهر للجميع</label></div>${c.img ? `<img src="${esc(c.img)}" alt="" style="max-width:100%;max-height:220px;border-radius:12px;margin:8px 0;object-fit:cover">` : ''}<input type="file" accept="image/*" class="cpf" style="margin-top:8px"><div class="mu cpn">${cpImg[id] ? 'تم اختيار صورة جديدة' : (id ? 'اختر صورة لتغيير الحالية' : 'اختر صورة الحالة (مطلوبة)')}</div>${id ? `<div class="mu" style="margin-top:6px">تم جمع <b>${(c.raised || 0).toLocaleString('en')}</b> نقطة · ${c.donors || 0} متبرع</div>` : ''}<div class="r" style="margin-top:8px"><span class="g"></span><button class="b p" data-a="cpsave">${id ? 'حفظ' : 'إضافة الحملة'}</button>${id ? '<button class="b d" data-a="cpdel">حذف</button>' : ''}</div></div>`; };
      return '<div class="mu" style="margin-bottom:8px">كل حملة تظهر لجميع المستخدمين داخل نافذة «التبرع للجمعيات الخيرية» بصورتها ووصفها ومجموع ما جُمع لها.</div>' + row({}) + j.items.map(row).join('');
    },
    async faq() {
      const j = await (await fetch('/api/faq')).json();
      const row = (f) => `<div class="c" data-f="${f.id || 0}"><input class="fc" placeholder="القسم" value="${esc(f.cat || '')}"><input class="fq" placeholder="السؤال" value="${esc(f.q || '')}"><textarea class="fa" rows="3" placeholder="الجواب">${esc(f.a || '')}</textarea>
<div class="r"><input class="fs" type="number" style="width:90px" placeholder="الترتيب" value="${f.sort || 0}"><span class="g"></span><button class="b p" data-a="fsave">حفظ</button>${f.id ? '<button class="b d" data-a="fdel">حذف</button>' : ''}</div></div>`;
      return '<div class="mu" style="margin-bottom:8px">تظهر هذه الأسئلة للمستخدمين في قسم المساعدة. إن كانت القائمة فارغة تُستخدم الأسئلة الافتراضية.</div>' + row({}) + j.items.map(row).join('');
    },
  };

  async function draw(keep) {
    if (busy) return; busy = true;
    ov.querySelectorAll('.axn [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    try {
      const y = M.scrollTop, html = await V[tab]();
      // لا نعيد الرسم أثناء الكتابة حتى لا يضيع النص
      const typing = M.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!(keep && typing)) { M.innerHTML = html; M.scrollTop = keep ? y : 0; if (tab === 'support' && thread) { const t = M.querySelector('#axt'); t && (t.parentElement.scrollTop = 1e9); } }
    } catch (e) { err(e); }
    busy = false;
  }

  async function act(el) {
    const a = el.dataset.a, e = el.dataset.e, id = el.dataset.id;
    const post = async (p, b) => { try { await api(p, b); } catch (x) { return alert(x.message); } draw(); };
    if (a === 'usearch') { uq = M.querySelector('#uq').value.trim(); return draw(); }
    if (a === 'purge') return confirm('حذف كل الحسابات التجريبية؟ الحسابات الحقيقية لن تُمس.') && post('/api/ctl/users/purge-demo', { confirm: true });
    if (a === 'del') return confirm('حذف الحساب ' + e + ' نهائياً؟') && post('/api/ctl/users/act', { email: e, op: 'delete', confirm: true });
    if (a === 'uch') return chargeModal(e, el.dataset.n, 'add');
    if (a === 'udd') return chargeModal(e, el.dataset.n, 'sub');
    if (a === 'uzero') return zeroModal(e, el.dataset.n);
    if (a === 'cgo') {
      const g = (i) => (ov.querySelector(i) || {}).value || '';
      try {
        const r = await api('/api/ctl/bal', { email: e, op: chMode, pts: g('#cp'), gems: g('#cg'), usd: g('#cu'), note: g('#cn') });
        closeModal(); flash('تم التنفيذ ✓ ' + fmtAfter(r.after)); draw(true);
      } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'zgo') {
      const c = (i) => ov.querySelector(i).checked ? 1 : 0, z = { p: c('#zp'), g: c('#zg'), d: c('#zd') };
      if (!z.p && !z.g && !z.d) return flash('اختر ما تريد تصفيره', 1);
      try { const r = await api('/api/ctl/bal', { email: e, op: 'zero', z }); closeModal(); flash('تم التصفير ✓ ' + fmtAfter(r.after)); draw(true); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'ban' || a === 'unban') return post('/api/ctl/users/act', { email: e, op: a });
    if (a === 'chat') { tab = 'support'; thread = e; return draw(); }
    if (a === 'rtab') { rep = el.dataset.v; return draw(); }
    if (a === 'rban' || a === 'rwarn' || a === 'rclose') { const note = (M.querySelector('#rn' + id) || {}).value || ''; if (a === 'rban' && !confirm('حظر الحساب المبلّغ عنه؟')) return; return post('/api/ctl/reports/act', { id: +id, op: a.slice(1), note }); }
    if (a === 'open') { thread = e; return draw(); }
    if (a === 'back') { thread = null; return draw(); }
    if (a === 'areply') { const body = M.querySelector('#ar').value.trim(); if (!body && !shot) return; const s = shot; shot = null; return post('/api/ctl/support/reply', { e: thread, body, img: s }); }
    if (a === 'fset') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin2/settings', { app_email: g('#fa').value, hide_app: g('#fh').checked, months: +g('#fm').value, debt_pct: +g('#fd').value, open_bal: +g('#fo').value, open_src: g('#fs').value }); }
    if (a === 'freset') return confirm('إعادة تعيين الإحصائيات المالية والبدء من جديد؟ السجل القديم يبقى محفوظاً.') && post('/api/ctl/fin2/reset', { confirm: true });
    if (a === 'csave') { const c = el.closest('[data-cn]'); return post('/api/ctl/fin2/costs', { name: c.dataset.cn, kind: c.dataset.ck, buy: +c.querySelector('.cb').value, sell: +c.querySelector('.cs').value }); }
    if (a === 'lfilter') { lf = { kind: M.querySelector('#lk').value, cat: M.querySelector('#lc').value, q: M.querySelector('#lq').value.trim() }; return draw(); }
    if (a === 'ladd') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin/add', { kind: g('#mk').value, cat: g('#mc').value, iqd: +g('#mi').value, note: g('#mn').value }); }
    if (a === 'ldel') return confirm('حذف هذا القيد اليدوي؟') && post('/api/ctl/fin/del', { uid: id });
    if (a === 'madd') {
      return modal(`<h2>إضافة تاجر معتمد</h2><input id="mo" dir="ltr" placeholder="بريد صاحب المتجر"><input id="mnm" placeholder="اسم المتجر"><input id="mpv" placeholder="المحافظة"><div class="r"><input id="mdc" class="g" type="number" placeholder="الخصم %" value="10"><input id="mcp" class="g" type="number" placeholder="السقف اليومي (0 = بلا سقف)" value="0"></div><div class="r" style="margin-top:8px"><button class="b p g" data-a="maddgo">إضافة</button><button class="b" data-mc="1">إلغاء</button></div>`);
    }
    if (a === 'maddgo') {
      const g = (i) => (ov.querySelector(i) || {}).value || '';
      if (!g('#mo') || !g('#mnm')) return flash('أدخل بريد صاحب المتجر واسم المتجر', 1);
      try { await api('/api/ctl/merchants/add', { owner: g('#mo'), name: g('#mnm'), province: g('#mpv'), discount: +g('#mdc') || 10, daily_cap: +g('#mcp') || 0 }); closeModal(); flash('تمت الإضافة'); draw(true); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'mreject') { const c = el.closest('[data-m]'); if (!confirm('رفض الطلب وإعادة الرسوم للمستخدم؟')) return; return post('/api/ctl/merchants/save', { id: +c.dataset.m, status: 'rejected', note: (c.querySelector('.mnote') || {}).value || '' }); }
    if (a === 'msave') { const c = el.closest('[data-m]'); return post('/api/ctl/merchants/save', { id: +c.dataset.m, status: el.dataset.st, daily_cap: c.querySelector('.mcap').value, discount: c.querySelector('.mdis').value }); }
    if (a === 'mdel') { const c = el.closest('[data-m]'); return confirm('حذف المتجر وسجل عملياته؟') && post('/api/ctl/merchants/del', { id: +c.dataset.m }); }
    if (a === 'aglog') { agSel = e; return draw(); }
    if (a === 'agback') { agSel = ''; return draw(); }
    if (a === 'cpsave' || a === 'cpdel') {
      const c = el.closest('[data-cp]'), id = +c.dataset.cp;
      if (a === 'cpdel') return confirm('حذف الحملة وسجل تبرعاتها؟') && post('/api/ctl/campaigns/del', { id });
      try {
        await api('/api/ctl/campaigns/save', { id, title: c.querySelector('.cpt').value, descr: c.querySelector('.cpd').value, goal: +c.querySelector('.cpg').value || 0, active: c.querySelector('.cpa').checked, img: cpImg[id] || undefined });
        delete cpImg[id]; flash('تم الحفظ'); draw();
      } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'fsave' || a === 'fdel') {
      const c = el.closest('[data-f]'), fid = +c.dataset.f;
      if (a === 'fdel') return confirm('حذف السؤال؟') && post('/api/ctl/faq/del', { id: fid });
      return post('/api/ctl/faq/save', { id: fid, cat: c.querySelector('.fc').value, q: c.querySelector('.fq').value, a: c.querySelector('.fa').value, sort: c.querySelector('.fs').value });
    }
  }

  ov.addEventListener('click', (ev) => {
    if (ev.target.id === 'axmod') return closeModal();
    const t = ev.target.closest('[data-t],[data-x],[data-a],[data-mc]');
    if (!t) return;
    if (t.dataset.mc) return closeModal();
    if (t.dataset.x) return ov.classList.remove('on');
    if (t.dataset.t) { tab = t.dataset.t; thread = null; closeModal(); return draw(); }
    act(t);
  });
  ov.addEventListener('change', async (ev) => {
    if (ev.target.classList.contains('cpf') && ev.target.files[0]) {
      const c = ev.target.closest('[data-cp]');
      try { cpImg[+c.dataset.cp] = await shrink(ev.target.files[0], 1000); c.querySelector('.cpn').textContent = 'تم اختيار صورة جديدة'; } catch (e) { alert('تعذر قراءة الصورة'); }
      return;
    }
    if (ev.target.id !== 'af' || !ev.target.files[0]) return;
    try { shot = await shrink(ev.target.files[0]); M.querySelector('#an').textContent = 'تم اختيار صورة'; } catch (e) { alert('تعذر قراءة الصورة'); }
  });
  btn.onclick = () => { if (!key()) return alert('احفظ مفتاح الإدارة أولاً من قسم النظام والأمان'); ov.classList.add('on'); draw(); };

  // تحديث دوري كل 5 ثوانٍ
  setInterval(async () => {
    if (!key()) return;
    if (ov.classList.contains('on') && !document.hidden && tab !== 'campaigns') draw(true);
    try {
      const c = await api('/api/ctl/counts'), n = c.reports + c.support + (c.merchants || 0), b = btn.querySelector('i'); b.hidden = !n; b.textContent = n;
      [['reports', c.reports], ['support', c.support], ['merchants', c.merchants]].forEach(([t, v]) => { const x = ov.querySelector(`[data-bd="${t}"]`); if (x) { x.hidden = !v; x.textContent = v; } });
    } catch (e) {}
  }, 5000);
})();

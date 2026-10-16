/* قسم المستخدمين الحقيقي — اقتراحات حتى 100 مستخدم · طلبات صداقة فورية · إشعارات · مراسلة أي شخص
   كل البيانات من السيرفر (قاعدة البيانات) فتتزامن بين كل الأجهزة. */
(function () {
  if (typeof S === 'undefined' || typeof V === 'undefined') return;

  const css = document.createElement('style');
  css.textContent = `
  #scbn{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translate(-50%,-140%);width:min(480px,94vw);z-index:100000;
    background:linear-gradient(135deg,hsl(calc(var(--h) + 8) 58% 24%),hsl(calc(var(--h) + 8) 55% 16%));border:1.5px solid var(--cy);border-radius:18px;padding:12px 16px;
    color:#fff;box-shadow:0 10px 34px #000b;transition:transform .35s cubic-bezier(.2,.9,.3,1.2);cursor:pointer;direction:rtl}
  #scbn[popover]{right:auto;bottom:auto;height:auto;margin:0;overflow:visible}#scbn.on{transform:translate(-50%,0)}#scbn b{display:block;color:var(--cy);margin-bottom:2px}#scbn span{font-size:.92rem;opacity:.95}
  .sc-st{display:flex;gap:6px;align-items:center;margin-top:2px}
  .sc-nm{font-weight:700;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sc-bar{display:flex;align-items:center;gap:8px;justify-content:space-between;background:#2c2a18;border:1.5px solid #6f6228;color:#f1c40f;border-radius:14px;padding:8px 12px;margin:8px 0;font-size:.88rem}
  .sc-bar button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:6px 12px;background:#f1c40f;color:#2a2200;cursor:pointer}
  .sc-sec{display:flex;align-items:center;justify-content:space-between;margin:16px 2px 4px;font-weight:700}.sc-sec i{font-style:normal;font-size:.8rem;background:var(--cy);color:#06232a;border-radius:99px;padding:0 9px}

  /* تثبيت الجزء العلوي وخانة الكتابة في الدردشة (fixed لأن #app يمنع sticky بسبب overflow) */
  .u2-hdn.fx{position:fixed;top:var(--vt,0px);left:50%;transform:translateX(-50%);width:min(520px,100%);box-sizing:border-box;margin:0;z-index:30;
    background:var(--bg);padding-top:calc(12px + env(safe-area-inset-top,0px));border-bottom:1px solid #ffffff14;box-shadow:0 6px 18px #0006}
  .dm-st{height:68px}
  .u2-in.fx{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--kb,0px) + 12px + env(safe-area-inset-bottom,0px));width:calc(min(520px,100%) - 24px);box-sizing:border-box;z-index:30}
  .u2-gf{width:46px;height:46px;border-radius:50%;border:0;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none;padding:0;font-size:1.35rem;box-shadow:0 4px 14px #db277755}
  .u2-gb{display:flex;align-items:center;gap:12px;padding:12px 18px 8px;border-radius:20px;max-width:82%;border:1.5px solid #f5a52499;color:#fff;animation:u2in .25s ease both}
  .u2-gb.o{align-self:flex-start;background:linear-gradient(135deg,#6d28d9,#be185d)}.u2-gb.i{align-self:flex-end;background:linear-gradient(135deg,#4c1d95,#9d174d)}
  .u2-gb .em{font-size:2.7rem;line-height:1;filter:drop-shadow(0 4px 10px #0008)}.u2-gb b{display:block;line-height:1.4}.u2-gb span.s{display:block;font-size:.78rem;opacity:.9}
  .u2-gb small{display:block;font-size:.66rem;opacity:.7;margin-top:2px}
  .gf-bal{display:flex;justify-content:space-between;align-items:center;background:#ffffff0d;border-radius:14px;padding:8px 14px;margin:6px 0 10px;font-size:.9rem}.gf-bal b{color:var(--am)}
  .gf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:46vh;overflow-y:auto;padding:2px}
  .gf-it{font:inherit;color:inherit;display:grid;justify-items:center;gap:1px;padding:10px 4px;border-radius:16px;border:1.5px solid var(--line);background:#ffffff0a;cursor:pointer}
  .gf-it .em{font-size:2.1rem;line-height:1.2}.gf-it b{font-size:.84rem;line-height:1.3}.gf-it small{color:var(--am);font-size:.74rem}
  .gf-it.on{border-color:var(--am);background:#f5a52422;box-shadow:0 0 0 2px #f5a52455}.gf-it.no{opacity:.45}
  .gf-ft{display:flex;gap:10px;align-items:center;margin-top:12px}.gf-ft .btn{flex:1;margin:0}
  .gf-q{display:flex;align-items:center;gap:6px;background:#ffffff0d;border-radius:99px;padding:3px}.gf-q button{width:34px;height:34px;border-radius:50%;border:0;background:#25313e;color:#fff;font:700 1.1rem/1 inherit;cursor:pointer;padding:0}.gf-q b{min-width:22px;text-align:center}
  #gfx{position:fixed;inset:0;pointer-events:none;z-index:100001;overflow:hidden}
  #gfx i{position:absolute;bottom:-60px;font-style:normal;animation:gfup 2.4s ease-out forwards;filter:drop-shadow(0 6px 12px #0009)}
  @keyframes gfup{0%{transform:translateY(0) scale(.6) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(-105vh) scale(1.25) rotate(18deg);opacity:0}}
  `;
  document.head.appendChild(css);

  const SO = (window.SOC = { people: [], friends: [], incoming: [], sent: [], convos: [], unread: 0, me: '', peer: null, msgs: [], last: 0,
    uv: 'list', up: '', q: '', dr: '', rr: '', loaded: false, sig: '', who: '' });
  const idn = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const post = async (p, b) => {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال بالخادم');
    return j;
  };
  const X = (d, z) => `<svg class="i" ${z ? `style="width:${z}px;height:${z}px"` : ''} viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const IC = { copy: 'M9 9h11v12H9zM5 15H4V3h11v1', share: 'M12 15V3M7 8l5-5 5 5M5 13v8h14v-8' };
  const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const seen = (p) => (p.on ? 'متصل الآن' : p.ls ? 'آخر ظهور ' + ago(p.ls) : 'غير متصل');
  const tm = (t) => new Date(t).toLocaleTimeString('ar-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const dayL = (t) => { const d = new Date(t), n = new Date(), s = (x) => x.toDateString(); if (s(d) === s(n)) return 'اليوم'; if (s(d) === s(new Date(n - 864e5))) return 'أمس'; return d.toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long' }); };
  const avatar = (p, z) => {
    const img = p.av ? `background:url('/api/soc/avatar/${p.uid}?v=${p.av}') center/cover;color:transparent;` : '';
    const sz = z ? `width:${z}px;height:${z}px;font-size:${Math.round(z * 0.42)}px` : '';
    return `<span class="u2-av" style="--hu:${hue(p.uid)};${img}${sz}">${esc(String(p.name || '?').trim().charAt(0) || '?')}${z && z < 46 ? '' : `<i class="u2-dot ${p.on ? 'on' : ''}"></i>`}</span>`;
  };
  const empty = (i, t, s, b) => `<div class="u2-empty"><div class="ci">${ic(i, 26)}</div><b>${t}</b>${s ? `<small>${s}</small>` : ''}${b || ''}</div>`;
  const head = (t, n) => `<div class="u2-h"><b>${t}</b>${n != null ? `<i>${n}</i>` : ''}</div>`;
  const find = (uid) => [...SO.people, ...SO.friends, ...SO.incoming, ...SO.sent, ...SO.convos].find((p) => p.uid === uid) || (SO.peer && SO.peer.uid === uid ? SO.peer : null);
  const setRel = (uid, rel) => { [SO.people, SO.friends, SO.incoming, SO.sent, SO.convos].forEach((l) => l.forEach((p) => { if (p.uid === uid) p.rel = rel; })); if (SO.peer && SO.peer.uid === uid) SO.peer.rel = rel; };


  /* ---------- الهدايا ---------- */
  const GRE = /^\[\[GIFT\|(.*?)\|(.*?)\|(\d+)\|(\d+)\]\]$/;
  const gparse = (x) => { const m = GRE.exec(String(x || '')); return m ? { em: m[1], nm: m[2], pr: +m[3], q: +m[4] } : null; };
  const gp = (x) => { const g = gparse(x); return g ? '🎁 ' + g.em + ' ' + g.nm + (g.q > 1 ? ' ×' + g.q : '') : x; };
  const fmt = (n) => { try { return typeof f === 'function' ? f(n) : Number(n).toLocaleString('en-US'); } catch (e) { return String(n); } };
  const myPts = () => { try { return +S.pts || 0; } catch (e) { return 0; } };
  SO.g = { list: [], sel: 0, qty: 1, max: 10, busy: false };
  function burst(total, emoji) {
    let l = document.querySelector('#gfx'); if (!l) { l = document.createElement('div'); l.id = 'gfx'; document.body.append(l); }
    const n = total >= 100000 ? 16 : total >= 10000 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const e = document.createElement('i'); e.textContent = emoji || '🎁'; e.style.left = 4 + Math.random() * 88 + '%'; e.style.fontSize = 30 + Math.random() * 46 + 'px'; e.style.animationDelay = Math.random() * 0.7 + 's';
      l.append(e); setTimeout(() => e.remove(), 3300);
    }
    try { navigator.vibrate && navigator.vibrate(total >= 100000 ? [60, 40, 90] : 50); } catch (e) {}
  }
  function gfPaint() {
    const g = SO.g, it = g.list.find((x) => x.id === g.sel), bal = myPts();
    document.querySelectorAll('.gf-it').forEach((b) => b.classList.toggle('on', +b.dataset.v === g.sel));
    const q = document.querySelector('#gfq'); if (q) q.textContent = g.qty;
    const t = it ? it.price * g.qty : 0, btn = document.querySelector('#gfs');
    if (btn) { btn.disabled = !it || g.busy; btn.innerHTML = it ? `🎁 إرسال ${esc(it.emoji)} · ${fmt(t)} نقطة` : 'اختر هدية'; btn.style.opacity = it && t <= bal ? '' : '.55'; }
  }
  async function giftDlg() {
    const me = idn(); if (!me || !SO.up) return; if (demoBlock()) return;
    const p = find(SO.up) || SO.peer || { name: '' };
    let j; try { const r = await fetch('/api/gifts/list', { cache: 'no-store' }); j = await r.json(); } catch (e) { return say('تعذر تحميل الهدايا'); }
    if (!j || !j.enabled) return say('الهدايا متوقفة حالياً');
    SO.g.list = j.gifts || []; SO.g.max = j.maxQty || 10; SO.g.sel = 0; SO.g.qty = 1; SO.g.busy = false;
    if (!SO.g.list.length) return say('لا توجد هدايا متاحة الآن');
    const bal = myPts();
    dlg(`<h2 style="margin-top:0">🎁 أرسل هدية إلى ${esc(p.name || '')}</h2><div class="gf-bal"><span>رصيدك</span><b>${fmt(bal)} نقطة</b></div>
<div class="gf-grid">${SO.g.list.map((g) => `<button type="button" class="gf-it ${g.price > bal ? 'no' : ''}" data-a="scgpick" data-v="${g.id}"><span class="em">${esc(g.emoji)}</span><b>${esc(g.name)}</b><small>${fmt(g.price)}</small></button>`).join('')}</div>
<div class="gf-ft"><div class="gf-q"><button type="button" data-a="scgq" data-v="1" aria-label="زيادة">+</button><b id="gfq">1</b><button type="button" data-a="scgq" data-v="-1" aria-label="إنقاص">−</button></div><button class="btn" id="gfs" data-a="scgsend" disabled>اختر هدية</button></div>
<p class="mu" style="font-size:.78rem;text-align:center;margin:10px 0 0">تُخصم الهدية من نقاطك فوراً.</p>`);
  }
  async function giftSend() {
    const g = SO.g, it = g.list.find((x) => x.id === g.sel), me = idn(); if (!it || !me || g.busy) return;
    const total = it.price * g.qty;
    if (myPts() < total) return say('رصيد النقاط غير كافٍ');
    g.busy = true; gfPaint();
    try {
      const j = await post('/api/gifts/send', { ...me, to: SO.up, gift: it.id, qty: g.qty });
      try { document.querySelector('#d').close(); } catch (e) {}
      if (j.msg && !SO.msgs.some((m) => m.id === j.msg.id)) SO.msgs.push(j.msg); SO.last = Math.max(SO.last, (j.msg || {}).id || 0); SO.msgs.sort((a, b) => a.id - b.id); paintDm(true);
      burst(total, it.emoji); say('تم إرسال ' + it.name + ' ' + it.emoji);
      try { const r = await fetch('/api/sync?since=' + (+LS(SYNK, 0) || 0) + '&nocfg=1', { cache: 'no-store' }); const c = await r.json(); if (Array.isArray(c.cmds) && c.cmds.length) applyCmds(c.cmds); } catch (e) {}
    } catch (e) { say(e.message); }
    g.busy = false; gfPaint();
  }
  // لوحة المفاتيح على الجوال: نرفع خانة الكتابة فوقها ونتتبع إزاحة المتصفح للهيدر
  (function () {
    const vv = window.visualViewport; if (!vv) return; const r = document.documentElement;
    const fix = () => { r.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px'); r.style.setProperty('--vt', Math.max(0, vv.offsetTop) + 'px'); };
    vv.addEventListener('resize', () => { fix(); if (document.activeElement && document.activeElement.id === 'sci') toEnd(); }); vv.addEventListener('scroll', fix); fix();
  })();

  /* ---------- إشعار فوري منبثق ---------- */
  let bnT = 0;
  function banner(title, body, tap) {
    let b = document.querySelector('#scbn');
    if (!b) { b = document.createElement('div'); b.id = 'scbn'; b.setAttribute('popover', 'manual'); document.body.append(b); }
    b.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
    b.onclick = () => { b.classList.remove('on'); try { tap && tap(); } catch (e) {} };
    try { if (b.showPopover) { if (b.matches(':popover-open')) b.hidePopover(); b.showPopover(); } } catch (e) {}
    requestAnimationFrame(() => b.classList.add('on'));
    clearTimeout(bnT); bnT = setTimeout(() => b.classList.remove('on'), 5500);
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
  }
  function handleNotes(notes) {
    if (!notes || !notes.length) return false;
    let fresh = false;
    notes.forEach((n) => {
      // الرسائل لا تدخل لوحة الإشعارات ولا تظهر منبثقة؛ يظهر فقط العداد على أيقونة المستخدمين وصندوق الرسائل
      if (n.kind === 'dm') { fresh = true; return; }
      try { typeof unAddE === 'function' && S.acc && unAddE(S.acc.e, n.title, n.body); } catch (e) {}
      if (n.kind === 'friend_ok') { banner('تمت الموافقة ✅', n.body, () => { SO.uv = 'list'; go('users'); }); say('تمت الموافقة ✅'); }
      else if (n.kind === 'friend_req') banner(n.title, n.body, () => { SO.uv = 'list'; go('users'); });
      else say(n.title);
      fresh = true;
    });
    return fresh;
  }

  /* عداد الرسائل غير المقروءة فوق أيقونة «المستخدمون» في الشريط السفلي */
  window.msgBadgeHTML = () => { const n = SO.unread || 0; return n ? `<b class="cnt" id="nvb">${n > 9 ? '9+' : n}</b>` : ''; };
  window.paintMsgBadge = () => {
    const sp = document.querySelector('nav button[data-r="users"] span'); if (!sp) return;
    const old = sp.querySelector('.cnt'), n = SO.unread || 0;
    if (!n) { old && old.remove(); return; }
    const t = n > 9 ? '9+' : String(n);
    if (old) { if (old.textContent !== t) old.textContent = t; } else sp.insertAdjacentHTML('beforeend', window.msgBadgeHTML());
  };

  /* ---------- التحميل الدوري ---------- */
  let busy = false;
  async function load(mode, force) {
    const me = idn(); if (!me || (busy && !force)) return; busy = true;
    try {
      if (SO.who !== me.e) { Object.assign(SO, { people: [], friends: [], incoming: [], sent: [], convos: [], unread: 0, peer: null, msgs: [], last: 0, uv: 'list', up: '', q: '', dr: '', loaded: false, sig: '', who: me.e }); }
      const dm = S.r === 'users' && SO.uv === 'dm' && SO.up;
      const j = await post('/api/soc/state', { ...me, mode, peer: dm ? SO.up : undefined, after: dm ? SO.last : undefined });
      const fresh = handleNotes(j.notes);
      const prevUnread = SO.unread; SO.unread = j.unread || 0;
      try { window.paintMsgBadge && window.paintMsgBadge(); } catch (e) {}
      if (mode === 'light') { if (prevUnread !== SO.unread && S.r === 'users') render(true); return; }
      SO.people = j.people || []; SO.friends = j.friends || []; SO.incoming = j.incoming || []; SO.sent = j.sent || []; SO.convos = j.convos || []; SO.loaded = true;
      let newMsgs = false;
      if (dm && j.msgs) {
        if (j.peer) SO.peer = j.peer;
        const have = new Set(SO.msgs.map((m) => m.id)), first = !SO.dmInit; SO.dmInit = true;
        j.msgs.forEach((m) => { if (!have.has(m.id)) { SO.msgs.push(m); newMsgs = true; const g = gparse(m.x); if (g && !m.mine && !first) burst(g.pr * g.q, g.em); } SO.last = Math.max(SO.last, m.id); });
        SO.msgs.sort((a, b) => a.id - b.id);
      }
      if (S.r !== 'users') return;
      if (SO.uv === 'dm') { if (newMsgs) paintDm(true); }
      else render(fresh);
    } catch (e) { /* صامت: المحاولة التالية بعد ثوانٍ */ } finally { busy = false; }
  }

  /* ---------- العرض ---------- */
  const sigOf = () => JSON.stringify([SO.people.map((p) => [p.uid, p.rel, p.on, p.av, p.name]), SO.incoming.map((p) => p.uid), SO.sent.map((p) => p.uid), SO.friends.map((p) => p.uid), SO.convos.map((c) => [c.uid, c.lt, c.unread]), SO.unread, SO.uv]);
  function render(force) {
    if (S.r !== 'users') return;
    const s = sigOf(); if (!force && s === SO.sig) return; SO.sig = s;
    const a = document.activeElement;
    if (a && a.id === 'scq') { paintRes(); return; }
    if (a && a.id === 'sci') return;
    try { draw(); } catch (e) {}
  }
  function card(p) {
    const u = esc(p.uid); let tag = '', act = '';
    if (p.rel === 'friend') { tag = '<span class="u2-tag">صديق</span>'; }
    else if (p.rel === 'sent') { tag = '<span class="u2-tag w">بانتظار القبول</span>'; act = `<button class="u2-btn w" data-a="sccan" data-v="${u}">${ic('hour')} إلغاء الطلب</button>`; }
    else if (p.rel === 'recv') { tag = '<span class="u2-tag b">أرسل لك طلباً</span>'; act = `<button class="u2-btn g" data-a="scacc" data-v="${u}">${ic('chk')} قبول</button><button class="u2-btn x" data-a="scdec" data-v="${u}">رفض</button>`; }
    else act = `<button class="u2-btn" data-a="scadd" data-v="${u}">${ic('add')} إضافة صديق</button>`;
    const un = p.unread ? `<b class="cnt" style="position:static;display:inline-grid">${p.unread > 9 ? '9+' : p.unread}</b>` : '';
    return `<div class="u2-c"><div class="u2-r1">${avatar(p)}<div class="sp"><div class="sc-nm">${esc(p.name)}</div><div class="sc-st">${tag}<span class="${p.on ? 'u2-on' : 'mu'}" style="font-size:.8rem">${seen(p)}</span></div></div></div>
<div class="u2-r2">${act}<button class="u2-btn ${p.rel === 'friend' ? '' : 'w'}" style="${p.rel === 'friend' ? '' : 'background:#1c2a36;border-color:var(--line);color:var(--cy);box-shadow:none;flex:.8'}" data-a="scdm" data-v="${u}">${ic('chat')} مراسلة ${un}</button><button class="u2-ib" data-a="screp" data-v="${u}" aria-label="إبلاغ">${ic('warn')}</button></div></div>`;
  }
  const list = () => {
    const q = SO.q.trim().toLowerCase();
    const base = SO.people.filter((p) => !q || String(p.name).toLowerCase().includes(q));
    if (!SO.loaded) return empty('users', 'جارٍ تحميل المستخدمين...', 'لحظات');
    if (!base.length) return q ? empty('search', 'لا يوجد مستخدم بهذا الاسم', 'جرّب اسماً آخر') : empty('users', 'لا يوجد مستخدمون آخرون بعد', 'سيظهر هنا كل من ينضم إلى التطبيق');
    return `<div class="sc-sec"><span>${q ? 'نتائج البحث' : 'مستخدمون مقترحون'}</span><i>${base.length}</i></div><div class="u2" style="padding-bottom:0">${base.map(card).join('')}</div>`;
  };
  function paintRes() { const r = document.querySelector('#scr'); if (r) r.innerHTML = list(); }
  const chatBtn = () => `<button class="u2-chat" data-a="scinbox" aria-label="الدردشة">${ic('chat')}<span>الدردشة</span>${SO.unread ? `<b class="cnt">${SO.unread > 9 ? '9+' : SO.unread}</b>` : ''}</button>`;
  const listV = () => {
    const code = (() => { try { return ucode(S.acc); } catch (e) { return ''; } })(), inc = SO.incoming;
    return hd('المستخدمون', 'users', { back: 'home', acts: chatBtn() }) +
      `<div class="u2"><div class="u2-me"><div class="sp"><small>رمز الإحالة الخاص بك</small><b dir="ltr">${esc(code)}</b></div><button class="u2-ghost" data-a="ucopy" data-v="${esc(code)}" aria-label="نسخ الرمز">${X(IC.copy, 20)}</button><button class="u2-ghost" data-a="ushare" data-v="${esc(code)}" aria-label="مشاركة الرمز">${X(IC.share, 20)}</button></div>` +
      (inc.length ? `<div class="sc-sec"><span>طلبات الصداقة</span><i>${inc.length}</i></div>${inc.map(card).join('')}` : '') +
      `<div class="u2-sb">${ic('search')}<input id="scq" dir="auto" autocomplete="off" spellcheck="false" maxlength="30" value="${esc(SO.q)}" placeholder="ابحث بالاسم..."><button type="button" id="scc" data-a="scclr" aria-label="مسح" ${SO.q ? '' : 'hidden'}>${ic('x')}</button></div><div id="scr">${list()}</div></div>`;
  };
  const inboxV = () => {
    const cv = SO.convos, ids = new Set(cv.map((c) => c.uid)), fr = SO.friends.filter((f) => !ids.has(f.uid));
    const row = (o, last) => `<button class="u2-cv" data-a="scdm" data-v="${esc(o.uid)}">${avatar(o)}<div class="sp"><b>${esc(o.name)}</b><span class="pv">${last ? (o.mine ? 'أنت: ' : '') + esc(gp(o.last)) : 'ابدأ المحادثة الآن'}</span></div><div class="mt">${last ? `<span>${tm(o.lt)}</span>` : ''}${o.unread ? `<span class="u2-un">${o.unread > 9 ? '9+' : o.unread}</span>` : ''}</div></button>`;
    return `<div class="hd"><button class="ib" data-a="scback" aria-label="رجوع">${ic('back')}</button><div class="ci">${ic('chat')}</div><h1>الدردشات</h1></div><div class="u2"><button class="u2-cv sp2" data-a="go" data-v="chat"><span class="u2-av">${ic('head')}</span><div class="sp"><b>الدعم الفني</b><span class="pv">تواصل مع فريق خدمة العملاء</span></div>${ic('chev')}</button>` +
      (cv.length ? head('المحادثات', cv.length) + cv.map((o) => row(o, 1)).join('') : '') +
      (fr.length ? head('أصدقاؤك', fr.length) + fr.map((o) => row(o, 0)).join('') : '') +
      (!cv.length && !fr.length ? empty('chat', 'لا توجد محادثات بعد', 'يمكنك مراسلة أي مستخدم حتى لو لم يكن صديقاً', `<button class="btn" data-a="scback">${ic('search')} تصفّح المستخدمين</button>`) : '') + '</div>';
  };
  const bubbles = () => {
    if (!SO.msgs.length) return empty('chat', 'ابدأ المحادثة', 'أرسل أول رسالة الآن');
    let last = '';
    return SO.msgs.map((m) => { const d = dayL(m.t), h = d !== last ? `<div class="u2-day"><span>${d}</span></div>` : ''; last = d; const g = gparse(m.x);
      if (g) return h + `<div class="u2-gb ${m.mine ? 'o' : 'i'}"><span class="em">${esc(g.em)}</span><div><b>${m.mine ? 'أرسلت هدية' : 'وصلتك هدية'}</b><span class="s">${esc(g.nm)}${g.q > 1 ? ' ×' + g.q : ''} · ${fmt(g.pr * g.q)} نقطة</span><small>${tm(m.t)}</small></div></div>`;
      return h + `<div class="u2-b ${m.mine ? 'o' : 'i'}">${esc(m.x)}<small>${tm(m.t)}</small></div>`; }).join('');
  };
  const dmV = () => {
    const p = find(SO.up) || SO.peer || { uid: SO.up, name: '...', on: false, av: 0, rel: 'none' };
    return `<div class="cs"><div class="u2-hdn"><button class="ib" data-a="scback" aria-label="رجوع">${ic('back')}</button>${avatar(p, 44)}<div class="sp"><b>${esc(p.name)}</b><small class="${p.on ? 'u2-on' : 'mu'}">${seen(p)}</small></div><button class="ib s r" data-a="screp" data-v="${esc(p.uid)}" aria-label="إبلاغ">${ic('warn')}</button></div>` +
      (p.rel === 'none' ? `<div class="sc-bar"><span>لستما أصدقاء بعد، لكن يمكنك مراسلته.</span><button data-a="scadd" data-v="${esc(p.uid)}">إضافة صديق</button></div>` : p.rel === 'sent' ? `<div class="sc-bar"><span>تم إرسال طلب الصداقة وبانتظار القبول</span></div>` : p.rel === 'recv' ? `<div class="sc-bar"><span>أرسل لك طلب صداقة</span><button data-a="scacc" data-v="${esc(p.uid)}">قبول</button></div>` : '') +
      `<div class="u2-ms cs-m" id="scm">${bubbles()}</div><div class="u2-in"><button class="u2-gf" data-a="scgift" aria-label="إرسال هدية">🎁</button><textarea id="sci" rows="1" maxlength="500" name="dm-note-${Date.now() % 99999}" ${window.CHAT_NOFILL || 'autocomplete="off"'} placeholder="اكتب رسالتك...">${esc(SO.dr)}</textarea><button class="u2-snd" data-a="scsend" aria-label="إرسال">${ic('send')}</button></div></div>`;
  };
  const toEnd = (force) => { try { window.csEnd(force !== false); } catch (e) {} };
  function paintDm(sc) { const c = document.querySelector('#scm'); if (!c) return; const near = c.scrollHeight - c.scrollTop - c.clientHeight < 160; c.innerHTML = bubbles(); if (sc) toEnd(near); }

  V.users = () => {
    if (!S.acc) return V.welcome();
    try { US2.view(); } catch (e) {} // يضبط توقيع المستخدمين القديم فلا يُعاد الرسم بلا داعٍ
    if (SO.who !== S.acc.e) { load('full', true); }
    SO.sig = sigOf();
    if (SO.uv === 'dm') return dmV();
    if (SO.uv === 'inbox') return inboxV();
    return listV();
  };

  /* ---------- الإجراءات ---------- */
  const demoBlock = () => { if (S.acc && S.acc.demo) { say('الحساب التجريبي لا يمكنه الدردشة أو إضافة أصدقاء'); return true; } return false; };
  async function act(a, v) {
    const me = idn(); if (!me) return say('سجّل الدخول أولاً');
    switch (a) {
      case 'scinbox': SO.uv = 'inbox'; draw(); scrollTo(0, 0); load('full', true); return;
      case 'scback': SO.uv = SO.uv === 'dm' ? 'inbox' : 'list'; SO.up = ''; SO.msgs = []; SO.last = 0; draw(); scrollTo(0, 0); return;
      case 'scclr': { SO.q = ''; paintRes(); const x = document.querySelector('#scq'); if (x) { x.value = ''; x.focus(); } const c = document.querySelector('#scc'); if (c) c.hidden = true; return; }
      case 'scdm': {
        if (demoBlock()) return;
        SO.uv = 'dm'; SO.up = v; SO.msgs = []; SO.last = 0; SO.dr = ''; SO.dmInit = false; SO.peer = find(v); draw(); toEnd();
        load('full', true); return;
      }
      case 'scsend': {
        const x = document.querySelector('#sci'); if (!x) return; const t = x.value.trim().slice(0, 500); if (!t) return;
        if (demoBlock()) return;
        x.value = ''; x.style.height = '46px'; SO.dr = '';
        const tmp = { id: -Date.now(), mine: true, x: t, t: Date.now() }; SO.msgs.push(tmp); paintDm(true); toEnd(true); x.focus();
        try {
          const j = await post('/api/soc/dm/send', { ...me, to: SO.up, body: t });
          SO.msgs = SO.msgs.filter((m) => m.id !== tmp.id); if (!SO.msgs.some((m) => m.id === j.msg.id)) SO.msgs.push(j.msg); SO.msgs.sort((p, q) => p.id - q.id); paintDm(true); toEnd(true);
        } catch (e) { SO.msgs = SO.msgs.filter((m) => m.id !== tmp.id); paintDm(); x.value = t; say(e.message); }
        return;
      }
      case 'scadd': {
        if (demoBlock()) return; const p = find(v); const was = p ? p.rel : 'none';
        setRel(v, was === 'recv' ? 'friend' : 'sent'); SO.sig = ''; draw();
        try { const j = await post('/api/soc/friend/request', { ...me, to: v }); setRel(v, j.rel); say(j.rel === 'friend' ? 'أصبحتما صديقين ✅' : 'تم إرسال طلب الصداقة' + (p ? ' إلى ' + p.name : '')); }
        catch (e) { setRel(v, was); say(e.message); }
        SO.sig = ''; draw(); load('full', true); return;
      }
      case 'sccan': { setRel(v, 'none'); SO.sig = ''; draw(); try { await post('/api/soc/friend/cancel', { ...me, to: v }); say('تم إلغاء طلب الصداقة'); } catch (e) { say(e.message); } load('full', true); return; }
      case 'scacc': {
        const p = find(v); setRel(v, 'friend'); SO.incoming = SO.incoming.filter((x) => x.uid !== v); SO.sig = ''; draw();
        try { await post('/api/soc/friend/respond', { ...me, from: v, accept: true }); say('أصبحت صديقاً' + (p ? ' لـ ' + p.name : '') + ' ✅'); } catch (e) { say(e.message); }
        load('full', true); return;
      }
      case 'scdec': { setRel(v, 'none'); SO.incoming = SO.incoming.filter((x) => x.uid !== v); SO.sig = ''; draw(); try { await post('/api/soc/friend/respond', { ...me, from: v, accept: false }); say('تم رفض الطلب'); } catch (e) { say(e.message); } load('full', true); return; }
      case 'scgift': giftDlg(); return;
      case 'scgpick': SO.g.sel = +v; gfPaint(); return;
      case 'scgq': SO.g.qty = Math.max(1, Math.min(SO.g.max, SO.g.qty + (+v || 0))); gfPaint(); return;
      case 'scgsend': giftSend(); return;
      case 'screp': repDlg(v); return;
      case 'scrr': return;
      case 'scrs': {
        if (!SO.rr) return say('اختر سبب الإبلاغ أولاً');
        const det = ((document.querySelector('#sct') || {}).value || '').trim().slice(0, 300);
        try { await post('/api/soc/report', { ...me, to: v, reason: SO.rr, details: det }); document.querySelector('#d').close(); say('تم إرسال البلاغ إلى الإدارة، شكراً لمساعدتك'); }
        catch (e) { say(e.message); }
        return;
      }
    }
  }
  const REAS = ['إساءة أو تحرش', 'احتيال أو نصب', 'انتحال شخصية', 'رسائل مزعجة', 'محتوى غير لائق', 'سبب آخر'];
  function repDlg(uid) {
    const p = find(uid); if (!p) return; SO.rr = '';
    dlg(`<h2 style="margin-top:0">الإبلاغ عن مستخدم</h2><div class="u2-rp">${avatar(p, 44)}<div class="sp"><b>${esc(p.name)}</b></div></div><p class="mu" style="margin:14px 0 8px">اختر سبب الإبلاغ</p><div class="u2-rs">${REAS.map((r) => `<button type="button" class="u2-rc" data-a="scrr" data-v="${r}">${r}</button>`).join('')}</div><label>تفاصيل إضافية (اختياري)<textarea id="sct" rows="3" maxlength="300" placeholder="اشرح ما حدث باختصار..."></textarea></label><button class="btn" data-a="scrs" data-v="${esc(uid)}">${ic('send')} إرسال البلاغ</button><p class="mu" style="font-size:.8rem;text-align:center;margin:10px 0 0">يصل البلاغ إلى قسم البلاغات لدى الإدارة وليس إلى الدعم.</p>`);
  }

  window.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-a^="sc"]'); if (!b) return;
    const a = b.dataset.a; if (!/^sc[a-z]+$/.test(a)) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (a === 'scrr') { SO.rr = b.dataset.v; document.querySelectorAll('.u2-rc').forEach((x) => x.classList.toggle('on', x === b)); return; }
    act(a, b.dataset.v);
  }, true);
  // الرجوع من أي زر data-r يعيد الشاشة للقائمة الرئيسية
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-r]'); if (b) { SO.uv = 'list'; SO.q = ''; SO.dr = ''; SO.up = ''; SO.msgs = []; SO.last = 0; } }, true);
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t) return;
    if (t.id === 'scq') { SO.q = t.value; const c = document.querySelector('#scc'); if (c) c.hidden = !t.value; paintRes(); }
    else if (t.id === 'sci') SO.dr = t.value;
  });
  document.addEventListener('keydown', (e) => { if (e.target && e.target.id === 'sci' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); act('scsend'); } });

  /* ---------- المؤقت: شاشة المستخدمين كل 2.5 ثانية، وباقي التطبيق كل 5 ثوانٍ (إشعارات فورية) ---------- */
  let n = 0;
  setInterval(() => {
    if (!idn() || document.hidden) return; n++;
    if (S.r === 'users') load('full'); else if (n % 2 === 0) load('light');
  }, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && idn()) load(S.r === 'users' ? 'full' : 'light'); });
  setTimeout(() => { if (idn()) load('light'); }, 1500);
  // عند فتح شاشة المستخدمين نحمّل فوراً
  const _draw = window.draw;
  let lastR = '';
  window.draw = function () { const r = _draw.apply(this, arguments); if (S.r === 'users' && lastR !== 'users' && idn()) load('full', true); lastR = S.r; return r; };
})();

/* privacy-ext.js — صفحة «الخصوصية» + الستوري (Stories)
   الخصوصية: من يرى حالة الاتصال · من يرسل طلب صداقة · من يراسلني · من يرى منشوراتي · من يرى الستوري
   الخيارات: الجميع / الأصدقاء / أنا فقط (طلب الصداقة: الجميع / لا أحد). تُحفظ على السيرفر وتُطبَّق هناك.
   الستوري: صورة أو نص ملوّن · يختفي بعد 24 ساعة · يظهر حسب خصوصية صاحبه · عدّاد مشاهدات لصاحبه. */
(function () {
  'use strict';
  if (window.__prvExt) return;
  window.__prvExt = 1;
  if (typeof S === 'undefined' || typeof V === 'undefined') return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const idn = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const post = async (p, b) => {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال بالخادم');
    return j;
  };
  const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  /* ======================= التنسيق ======================= */
  const css = document.createElement('style');
  css.textContent = `
.pv-wrap{display:grid;gap:12px;padding-bottom:30px}
.pv-intro{display:flex;gap:10px;align-items:flex-start;background:#ffffff0a;border:1px solid var(--line,#ffffff1f);border-radius:18px;padding:12px 14px;font-size:.84rem;line-height:1.7;opacity:.95}
.pv-card{background:linear-gradient(180deg,#ffffff0d,#ffffff06);border:1.5px solid var(--line,#ffffff1f);border-radius:22px;padding:14px 14px 16px}
.pv-card h3{margin:0 0 3px;font-size:1rem;font-weight:800;display:flex;align-items:center;gap:8px}
.pv-card h3 .ci{width:30px;height:30px;border-radius:10px;flex:none}
.pv-card p{margin:0 0 12px;font-size:.76rem;opacity:.72;line-height:1.6}
.pv-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px}
.pv-seg button{font:inherit;font-weight:700;font-size:.9rem;color:inherit;background:var(--inp,#ffffff0d);border:1.5px solid var(--line,#ffffff26);border-radius:99px;padding:11px 6px;cursor:pointer;transition:background .18s,color .18s,border-color .18s,transform .1s;white-space:nowrap}
.pv-seg button:active{transform:scale(.96)}
.pv-seg button.on{background:var(--cy,#22d3ee);border-color:var(--cy,#22d3ee);color:#05242a;box-shadow:0 6px 16px -8px var(--cy,#22d3ee)}
.pv-seg button[disabled]{opacity:.5;pointer-events:none}
.pv-foot{text-align:center;font-size:.74rem;opacity:.6;line-height:1.7}

/* ---------- الستوري ---------- */
.st-row{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 10px;margin:10px 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.st-row::-webkit-scrollbar{display:none}
.st-it{flex:none;width:68px;display:grid;justify-items:center;gap:6px;background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
.st-ring{position:relative;width:64px;height:64px;border-radius:50%;padding:3px;display:grid;place-items:center;background:var(--line,#ffffff33)}
.st-ring.new{background:conic-gradient(from 200deg,var(--cy,#22d3ee),#7c3aed,#db2777,var(--cy,#22d3ee))}
.st-ring.mine.has{background:conic-gradient(from 200deg,#22c55e,var(--cy,#22d3ee),#22c55e)}
.st-av{width:100%;height:100%;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:1.3rem;color:#fff;background:hsl(var(--hu,200) 55% 38%) center/cover;border:3px solid var(--bg,#0e1621);box-sizing:border-box}
.st-plus{position:absolute;bottom:-2px;inset-inline-end:-2px;width:24px;height:24px;border-radius:50%;background:var(--cy,#22d3ee);color:#05242a;display:grid;place-items:center;font-weight:900;font-size:1.05rem;line-height:1;border:2.5px solid var(--bg,#0e1621)}
.st-nm{font-size:.72rem;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
.st-empty{font-size:.78rem;opacity:.6;align-self:center;padding:0 6px}

#stv,#stc{position:fixed;inset:0;z-index:100050;background:#000;color:#fff;display:flex;flex-direction:column;direction:rtl;font-family:inherit;touch-action:manipulation}
#stv .bars{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));inset-inline:10px;display:flex;gap:4px;z-index:3}
#stv .bars i{flex:1;height:3px;border-radius:3px;background:#ffffff40;overflow:hidden;display:block}
#stv .bars i b{display:block;height:100%;width:0;background:#fff}
#stv .bars i.done b{width:100%}
#stv .top{position:absolute;top:calc(20px + env(safe-area-inset-top,0px));inset-inline:10px;display:flex;align-items:center;gap:10px;z-index:3;text-shadow:0 1px 6px #000a}
#stv .top .st-av{width:40px;height:40px;font-size:1rem;border:2px solid #fff}
#stv .top .w{flex:1;min-width:0}#stv .top b{display:block;font-size:.95rem}#stv .top small{opacity:.8;font-size:.72rem}
#stv .top button,#stc .tb button{width:40px;height:40px;border-radius:50%;border:0;background:#00000066;color:#fff;font:inherit;font-size:1.2rem;display:grid;place-items:center;cursor:pointer;padding:0;backdrop-filter:blur(6px)}
#stv .stage{flex:1;display:grid;place-items:center;position:relative;overflow:hidden}
#stv .stage img{max-width:100%;max-height:100%;object-fit:contain}
#stv .stage .tx{position:absolute;inset:0;display:grid;place-items:center;padding:90px 28px;text-align:center;font-size:1.55rem;font-weight:800;line-height:1.7;white-space:pre-wrap;word-break:break-word}
#stv .stage .cap{position:absolute;bottom:calc(70px + env(safe-area-inset-bottom,0px));inset-inline:16px;text-align:center;font-size:1.02rem;font-weight:700;line-height:1.6;text-shadow:0 2px 10px #000;background:linear-gradient(transparent,#0008);padding:18px 8px 6px;border-radius:12px;white-space:pre-wrap;word-break:break-word}
#stv .zn{position:absolute;top:80px;bottom:90px;width:36%;z-index:2}#stv .zn.l{left:0}#stv .zn.r{right:0}
#stv .ft{position:absolute;bottom:0;inset-inline:0;padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:3;background:linear-gradient(transparent,#000a);font-size:.84rem}
#stv .ft button{border:0;background:#ffffff22;color:#fff;font:inherit;font-weight:700;border-radius:99px;padding:9px 16px;cursor:pointer}
#stv .ft .del{background:#ef535055}

#stc .tb{display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 8px;z-index:2}
#stc .tb h2{margin:0;font-size:1.05rem}
#stc .cv{flex:1;position:relative;display:grid;place-items:center;overflow:hidden;margin:0 10px;border-radius:22px;background:#0f766e}
#stc .cv img{max-width:100%;max-height:100%;object-fit:contain;display:none}
#stc .cv textarea{position:absolute;inset:0;width:100%;height:100%;background:transparent;border:0;outline:0;color:#fff;text-align:center;font:inherit;font-size:1.55rem;font-weight:800;line-height:1.7;padding:40px 24px;resize:none;display:block}
#stc .cv textarea::placeholder{color:#ffffff99}
#stc.img .cv textarea{inset:auto 0 0 0;height:96px;font-size:1.05rem;padding:12px 16px;background:linear-gradient(transparent,#000b)}
#stc.img .cv img{display:block}
#stc .bt{padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));display:grid;gap:10px}
#stc .md{display:flex;gap:8px}
#stc .md button{flex:1;font:inherit;font-weight:700;color:#fff;background:#ffffff14;border:1.5px solid #ffffff2a;border-radius:99px;padding:10px;cursor:pointer}
#stc .md button.on{background:var(--cy,#22d3ee);border-color:var(--cy,#22d3ee);color:#05242a}
#stc .bgs{display:flex;gap:10px;justify-content:center}
#stc .bgs button{width:30px;height:30px;border-radius:50%;border:2.5px solid #ffffff55;cursor:pointer;padding:0}
#stc .bgs button.on{border-color:#fff;transform:scale(1.12)}
#stc.img .bgs{display:none}
#stc .who{font-size:.76rem;opacity:.75;text-align:center}#stc .who a{color:var(--cy,#22d3ee);cursor:pointer;text-decoration:underline}
#stc .go{border:0;border-radius:16px;padding:14px;font:inherit;font-weight:800;font-size:1rem;cursor:pointer;color:#05242a;background:linear-gradient(135deg,var(--cy,#22d3ee),var(--cy2,#14b8a6))}
#stc .go[disabled]{opacity:.5}
`;
  document.head.appendChild(css);

  /* ======================= الخصوصية ======================= */
  const ITEMS = [
    { k: 'online', ic: 'eye', t: 'من يستطيع رؤية حالة الاتصال', d: 'متصل الآن / آخر ظهور. إذا أخفيتها فلن ترى حالة الآخرين أيضاً بدقة.', o: [['all', 'الجميع'], ['friends', 'الأصدقاء'], ['me', 'أنا فقط']] },
    { k: 'friend_req', ic: 'add', t: 'من يستطيع إرسال طلب صداقة', d: 'تحكّم بمن يمكنه إضافتك كصديق.', o: [['all', 'الجميع'], ['me', 'لا أحد']] },
    { k: 'dm', ic: 'chat', t: 'من يستطيع مراسلتي', d: 'الرسائل المباشرة في قسم المستخدمين.', o: [['all', 'الجميع'], ['friends', 'الأصدقاء'], ['me', 'لا أحد']] },
    { k: 'posts', ic: 'doc', t: 'من يستطيع رؤية منشوراتي', d: 'الأخبار التي تنشرها في الصفحة الرئيسية.', o: [['all', 'الجميع'], ['friends', 'الأصدقاء'], ['me', 'أنا فقط']] },
    { k: 'stories', ic: 'cam', t: 'من يستطيع رؤية الستوري', d: 'القصص التي تختفي بعد 24 ساعة.', o: [['all', 'الجميع'], ['friends', 'الأصدقاء'], ['me', 'أنا فقط']] },
  ];
  const PV = (window.PRV = { priv: null, who: '', busy: false });

  async function pvLoad() {
    const me = idn(); if (!me || PV.busy) return; PV.busy = true;
    try { const j = await post('/api/soc/privacy/get', me); PV.priv = j.priv; PV.who = me.e; if (S.r === 'privacy') draw(); }
    catch (e) { say(e.message); } finally { PV.busy = false; }
  }
  V.privacy = () => {
    const me = idn();
    const head = hd('الخصوصية', 'eye', { back: 'profile' });
    if (!me) return head + '<div class="card" style="padding:18px;text-align:center;margin-top:16px">سجّل الدخول بحساب حقيقي لضبط إعدادات الخصوصية.</div>';
    if (!PV.priv || PV.who !== me.e) { setTimeout(pvLoad, 0); return head + '<div class="card" style="padding:22px;text-align:center;margin-top:16px;opacity:.8">جارٍ تحميل إعداداتك...</div>'; }
    return head + `<div class="pv-wrap" style="margin-top:14px"><div class="pv-intro"><span style="font-size:1.3rem">🔒</span><span>أنت تتحكم بما يراه الآخرون عنك. تُحفظ اختياراتك على حسابك وتُطبَّق على كل أجهزتك فوراً.</span></div>` +
      ITEMS.map((it) => `<div class="pv-card"><h3><span class="ci">${ic(it.ic, 16)}</span>${it.t}</h3><p>${it.d}</p><div class="pv-seg" data-k="${it.k}">${it.o.map((o) => `<button type="button" data-pv="${it.k}" data-val="${o[0]}" class="${PV.priv[it.k] === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div></div>`).join('') +
      '<div class="pv-foot">«الأصدقاء» تعني من أضفتهم وقبلوا صداقتك فقط.<br>حسابات الإدارة والدعم قد ترى بياناتك للضرورة التشغيلية.</div></div>';
  };
  window.prvOpen = () => { if (!idn()) return say('سجّل الدخول بحساب حقيقي أولاً'); PV.priv = null; go('privacy'); };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('button[data-pv]'); if (!b) return;
    e.stopPropagation();
    const me = idn(); if (!me || !PV.priv) return;
    const k = b.dataset.pv, v = b.dataset.val, old = PV.priv[k]; if (old === v) return;
    const seg = b.closest('.pv-seg'); const paint = (val) => seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.val === val));
    PV.priv[k] = v; paint(v); seg.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try { const j = await post('/api/soc/privacy/set', { ...me, key: k, val: v }); PV.priv = j.priv || PV.priv; say('تم حفظ الخصوصية ✓'); }
    catch (er) { PV.priv[k] = old; paint(old); say(er.message); }
    seg.querySelectorAll('button').forEach((x) => { x.disabled = false; });
  }, true);

  /* ======================= الستوري ======================= */
  const ST = (window.STORIES = { mine: { n: 0, ts: 0 }, items: [], loaded: false, who: '', busy: false });
  const avStyle = (p) => (p.av ? `background-image:url('/api/soc/avatar/${esc(p.uid)}?v=${p.av}');color:transparent;` : '') + `--hu:${hue(p.uid || 'x')}`;
  const ini = (n) => esc(String(n || '?').trim().charAt(0) || '?');

  const strip = () => {
    const me = idn(); if (!me) return '';
    const mineAv = (() => { try { return S.av ? `background-image:url('${SAFE_SRC(S.av)}');color:transparent;--hu:200` : `--hu:200`; } catch (e) { return '--hu:200'; } })();
    const mine = `<div class="st-it" data-st="mine"><span class="st-ring mine ${ST.mine.n ? 'has' : ''}"><span class="st-av" style="${mineAv}">${ini(S.name)}</span><span class="st-plus" data-st="add" aria-label="إضافة ستوري">+</span></span><span class="st-nm">قصتي</span></div>`;
    const others = ST.items.map((p) => `<button class="st-it" data-st="view" data-uid="${esc(p.uid)}"><span class="st-ring ${p.unseen ? 'new' : ''}"><span class="st-av" style="${avStyle(p)}">${ini(p.name)}</span></span><span class="st-nm">${esc(p.name)}</span></button>`).join('');
    return `<div class="st-row" id="stbox">${mine}${others || (ST.loaded ? '<span class="st-empty">لا توجد قصص من أصدقائك الآن</span>' : '')}</div>`;
  };
  window.stStrip = () => { if (!ST.loaded || ST.who !== (idn() || {}).e) setTimeout(() => stLoad(true), 0); return strip(); };
  const stPaint = () => { const b = document.getElementById('stbox'); if (b && S.r === 'users') b.outerHTML = strip(); };

  async function stLoad(force) {
    const me = idn(); if (!me || ST.busy) return; if (ST.who && ST.who !== me.e) { ST.items = []; ST.mine = { n: 0, ts: 0 }; ST.loaded = false; }
    ST.busy = true;
    try { const j = await post('/api/soc/story/list', me); ST.mine = j.mine || ST.mine; ST.items = j.items || []; ST.loaded = true; ST.who = me.e; stPaint(); }
    catch (e) { /* صامت */ } finally { ST.busy = false; }
  }
  setInterval(() => { try { if (!document.hidden && S.r === 'users') stLoad(); } catch (e) {} }, 25000);

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-st]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const a = b.dataset.st;
    if (a === 'add') return composer();
    if (a === 'mine') return ST.mine.n ? viewer('') : composer();
    if (a === 'view') return viewer(b.dataset.uid);
  }, true);

  /* ---------- العارض ---------- */
  let V_ = null;
  const ago2 = (t) => { try { return typeof ago === 'function' ? ago(t) : new Date(t).toLocaleTimeString('ar-IQ'); } catch (e) { return ''; } };
  async function viewer(uid) {
    const me = idn(); if (!me) return;
    let j; try { j = await post('/api/soc/story/view', { ...me, uid: uid || undefined }); } catch (e) { return say(e.message); }
    if (!j.stories.length) { say('لا توجد قصص'); stLoad(true); return; }
    closeViewer();
    const el = document.createElement('div'); el.id = 'stv';
    document.body.appendChild(el); document.documentElement.style.overflow = 'hidden';
    V_ = { el, j, i: 0, t: 0, raf: 0, paused: false, dur: 5500, start: 0, acc: 0 };
    show(0);
    history.pushState({ stv: 1 }, ''); // زر الرجوع في الجوال يغلق العارض
  }
  function closeViewer(fromPop) {
    if (!V_) return; cancelAnimationFrame(V_.raf); V_.el.remove(); V_ = null; document.documentElement.style.overflow = '';
    if (!fromPop) { try { if (history.state && history.state.stv) history.back(); } catch (e) {} }
    stLoad(true);
  }
  window.addEventListener('popstate', () => { if (V_) closeViewer(true); if (C_) closeComposer(true); });
  function show(i) {
    const v = V_; if (!v) return; const st = v.j.stories;
    if (i >= st.length) return closeViewer(); if (i < 0) i = 0;
    v.i = i; cancelAnimationFrame(v.raf); v.acc = 0; v.start = performance.now(); v.paused = false;
    const s = st[i], me = v.j.own;
    const av = me ? (S.av ? `background-image:url('${SAFE_SRC(S.av)}');color:transparent;--hu:200` : '--hu:200') : avStyle({ uid: v.j.uid, av: (ST.items.find((p) => p.uid === v.j.uid) || {}).av });
    v.el.innerHTML = `<div class="bars">${st.map((_, k) => `<i class="${k < i ? 'done' : ''}"><b></b></i>`).join('')}</div>
<div class="top"><span class="st-av" style="${av}">${ini(me ? S.name : v.j.name)}</span><div class="w"><b>${esc(me ? 'قصتي' : v.j.name)}</b><small>${esc(ago2(s.t))}</small></div><button data-sv="x" aria-label="إغلاق">✕</button></div>
<div class="stage" style="background:${s.img ? '#000' : esc(s.bg)}">${s.img ? `<img src="${SAFE_SRC(s.img)}" alt="">${s.x ? `<div class="cap">${esc(s.x)}</div>` : ''}` : `<div class="tx">${esc(s.x)}</div>`}</div>
<div class="zn l" data-sv="next"></div><div class="zn r" data-sv="prev"></div>
${me ? `<div class="ft"><span>👁 ${s.views || 0} مشاهدة</span><button class="del" data-sv="del">حذف</button></div>` : ''}`;
    const bar = v.el.querySelectorAll('.bars i b')[i];
    const tick = (now) => {
      if (!V_ || V_ !== v) return;
      if (v.paused) { v.start = now - v.acc; } else v.acc = now - v.start;
      const p = Math.min(1, v.acc / v.dur); if (bar) bar.style.width = p * 100 + '%';
      if (p >= 1) return show(v.i + 1);
      v.raf = requestAnimationFrame(tick);
    };
    v.raf = requestAnimationFrame(tick);
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-sv]'); if (!b || !V_) return;
    e.stopPropagation(); const a = b.dataset.sv;
    if (a === 'x') return closeViewer();
    if (a === 'next') return show(V_.i + 1);
    if (a === 'prev') return show(V_.i - 1);
    if (a === 'del') {
      if (!confirm('حذف هذا الستوري؟')) return;
      const s = V_.j.stories[V_.i], me = idn();
      try { await post('/api/soc/story/delete', { ...me, id: s.id }); V_.j.stories.splice(V_.i, 1); say('تم الحذف'); if (!V_.j.stories.length) return closeViewer(); show(Math.min(V_.i, V_.j.stories.length - 1)); }
      catch (er) { say(er.message); }
    }
  }, true);
  // الضغط المطوّل يوقف التقدّم مؤقتاً
  const hold = (on) => { if (V_) V_.paused = on; };
  document.addEventListener('pointerdown', (e) => { if (V_ && e.target.closest('#stv .zn,#stv .stage')) hold(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => document.addEventListener(t, () => hold(false)));

  /* ---------- المنشئ ---------- */
  const BGS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#15803d', '#334155', '#9f1239'];
  let C_ = null;
  const shrink = (file, max = 1080) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      let m = max, q = 0.8, out = '';
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q); if (out.length < 1.2e6) break; m = Math.round(m * 0.78); q = Math.max(0.5, q - 0.08);
      }
      ok(out);
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
  const whoSees = () => ({ all: 'الجميع', friends: 'أصدقائك فقط', me: 'أنت فقط' }[(PV.priv && PV.priv.stories) || 'friends']);
  function composer() {
    const me = idn(); if (!me) return say('سجّل الدخول بحساب حقيقي لنشر الستوري');
    try { if (S.acc && S.acc.demo) return say('الحساب التجريبي لا يمكنه نشر الستوري'); } catch (e) {}
    closeComposer(true);
    if (!PV.priv || PV.who !== me.e) pvLoad().then(() => { const w = document.getElementById('stwho'); if (w) w.textContent = whoSees(); });
    const el = document.createElement('div'); el.id = 'stc';
    el.innerHTML = `<div class="tb"><button data-sc="x" aria-label="إغلاق">✕</button><h2>ستوري جديد</h2><span style="width:40px"></span></div>
<div class="cv" id="stcv" style="background:${BGS[0]}"><img id="stci" alt=""><textarea id="stct" maxlength="280" placeholder="اكتب ما تريد مشاركته..."></textarea></div>
<div class="bt"><div class="md"><button data-sc="mt" class="on">Aa نص</button><button data-sc="mi">📷 صورة</button></div><input type="file" id="stcf" accept="image/*" hidden>
<div class="bgs">${BGS.map((c, i) => `<button data-sc="bg" data-c="${c}" class="${i ? '' : 'on'}" style="background:${c}" aria-label="لون"></button>`).join('')}</div>
<div class="who">سيظهر لـ <b id="stwho">${whoSees()}</b> لمدة 24 ساعة · <a data-sc="prv">تغيير الخصوصية</a></div>
<button class="go" data-sc="go">نشر الستوري</button></div>`;
    document.body.appendChild(el); document.documentElement.style.overflow = 'hidden';
    C_ = { el, img: '', bg: BGS[0], busy: false };
    history.pushState({ stc: 1 }, '');
  }
  function closeComposer(fromPop) {
    if (!C_) return; C_.el.remove(); C_ = null; if (!V_) document.documentElement.style.overflow = '';
    if (!fromPop) { try { if (history.state && history.state.stc) history.back(); } catch (e) {} }
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-sc]'); if (!b || !C_) return;
    e.stopPropagation(); const a = b.dataset.sc, c = C_;
    if (a === 'x') return closeComposer();
    if (a === 'prv') { closeComposer(); return window.prvOpen(); }
    if (a === 'bg') { c.bg = b.dataset.c; c.el.querySelector('#stcv').style.background = c.bg; c.el.querySelectorAll('[data-sc=bg]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (a === 'mt') { c.img = ''; c.el.classList.remove('img'); c.el.querySelector('#stci').removeAttribute('src'); c.el.querySelector('#stcv').style.background = c.bg; c.el.querySelectorAll('.md button').forEach((x) => x.classList.toggle('on', x === b)); c.el.querySelector('#stct').placeholder = 'اكتب ما تريد مشاركته...'; return; }
    if (a === 'mi') return c.el.querySelector('#stcf').click();
    if (a === 'go') {
      if (c.busy) return; const t = c.el.querySelector('#stct').value.trim();
      if (!c.img && !t) return say('أضف نصاً أو صورة');
      c.busy = true; b.disabled = true; b.textContent = 'جارٍ النشر...';
      try { await post('/api/soc/story/add', { ...idn(), img: c.img || undefined, body: t, bg: c.bg }); closeComposer(); say('تم نشر الستوري ✅'); stLoad(true); }
      catch (er) { say(er.message); c.busy = false; b.disabled = false; b.textContent = 'نشر الستوري'; }
    }
  }, true);
  document.addEventListener('change', async (e) => {
    if (!C_ || e.target.id !== 'stcf') return;
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const img = await shrink(f); C_.img = img;
      const el = C_.el; el.classList.add('img'); el.querySelector('#stci').src = img; el.querySelector('#stcv').style.background = '#000';
      el.querySelector('#stct').placeholder = 'أضف تعليقاً (اختياري)...';
      el.querySelectorAll('.md button').forEach((x) => x.classList.toggle('on', x.dataset.sc === 'mi'));
    } catch (er) { say('تعذر قراءة الصورة'); }
  });
})();

/* news-ext.js — أخبار المستخدمين في الصفحة الرئيسية (تحت «آخر الأخبار والعروض»)
   نشر خبر: عنوان + صورة + وصف · زر إعجاب فقط · الناشر: الاسم + الصورة + كود الإحالة · مرتبط بسيرفر الأخبار وبثّ فوري */
(function () {
  'use strict';
  if (window.__nwExt) return;
  window.__nwExt = 1;

  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (x) { return null; } };
  const say = (m) => { try { toast(m); } catch (x) { alert(m); } };
  const J = async (p, b) => {
    const r = await fetch(p, { method: b ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال بالسيرفر');
    return j;
  };
  const ago2 = (t) => { try { return typeof ago === 'function' ? ago(t) : new Date(t).toLocaleDateString('ar-IQ'); } catch (x) { return ''; } };

  let items = [], shown = 5, sig = '', fetching = 0, openId = {};
  window._unews = items;

  /* ---------- التصميم ---------- */
  const css = document.createElement('style');
  css.textContent = `
.nw-sec{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:18px 0 10px}
.nw-sec b{font-size:1.05rem}
.nw-pub{display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:.85rem;padding:9px 15px;border-radius:99px;color:#04252b;background:linear-gradient(135deg,var(--cy,#22d3ee),var(--cy2,#14b8a6));box-shadow:0 6px 16px -6px var(--cy,#22d3ee)}
.nw-pub svg{width:17px;height:17px;fill:currentColor}
.nw-card{border:1px solid var(--line,#ffffff1f);background:linear-gradient(180deg,#ffffff0d,#ffffff05);border-radius:22px;padding:14px;margin-bottom:12px;overflow:hidden}
.nw-top{display:flex;align-items:center;gap:11px;margin-bottom:11px}
.nw-av{position:relative;width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--cy,#22d3ee),#2563eb);overflow:hidden;box-shadow:0 0 0 2px var(--line,#ffffff22)}
.nw-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.nw-who{min-width:0;flex:1}
.nw-who b{display:block;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:.74rem;opacity:.85}
.nw-code{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;background:var(--inp,#ffffff12);border:1px solid var(--line,#ffffff1f);font-weight:700;letter-spacing:.5px;direction:ltr}
.nw-t{font-weight:800;font-size:1.05rem;line-height:1.5;margin:0 0 6px}
.nw-img{width:100%;max-height:320px;object-fit:cover;border-radius:16px;display:block;margin:8px 0;background:var(--inp,#ffffff10)}
.nw-vw{position:relative;margin:8px 0;border-radius:16px;overflow:hidden;background:#000}
.nw-vid{display:block;width:100%;max-height:420px;background:#000;object-fit:contain}
.nw-snd{position:absolute;bottom:10px;inset-inline-start:10px;width:38px;height:38px;border-radius:50%;border:0;background:#000a;color:#fff;font-size:1.1rem;cursor:pointer;display:grid;place-items:center}
.nw-vtag{position:absolute;top:8px;inset-inline-end:8px;background:#000a;color:#fff;font-size:.7rem;padding:3px 9px;border-radius:99px}
.nw-d{font-size:.92rem;line-height:1.8;opacity:.92;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.nw-d.open{display:block;-webkit-line-clamp:unset}
.nw-more{background:none;border:0;color:var(--cy,#22d3ee);font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;padding:4px 0}
.nw-ft{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#ffffff14)}
.nw-like{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line,#ffffff22);background:var(--inp,#ffffff0d);color:inherit;font:inherit;font-weight:700;cursor:pointer;padding:8px 16px;border-radius:99px;transition:transform .15s,background .2s}
.nw-like svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2}
.nw-like.on{background:#ff3b6b22;border-color:#ff3b6b88;color:#ff5c85}
.nw-like.on svg{fill:#ff5c85;stroke:#ff5c85}
.nw-like:active{transform:scale(.93)}
.nw-gift{display:inline-flex;align-items:center;gap:7px;border:1px solid #f59e0b66;background:#f59e0b18;color:#fbbf24;font:inherit;font-weight:700;cursor:pointer;padding:8px 14px;border-radius:99px}
.nw-gift:active{transform:scale(.93)}
.nw-gg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0;max-height:240px;overflow:auto}
.nw-gg button{display:grid;gap:2px;justify-items:center;border:1.5px solid var(--line,#ffffff22);background:var(--inp,#ffffff0d);color:inherit;border-radius:14px;padding:8px 2px;font:inherit;cursor:pointer}
.nw-gg button.on{border-color:#f59e0b;background:#f59e0b22}
.nw-gg b{font-size:1.6rem;line-height:1.2}.nw-gg small{font-size:.68rem;opacity:.85}.nw-gg i{font-style:normal;font-size:.7rem;color:#fbbf24;font-weight:700}
.nw-qty{display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0}
.nw-qty button{width:38px;height:38px;border-radius:12px;border:1px solid var(--line,#ffffff33);background:var(--inp,#ffffff10);color:inherit;font-size:1.2rem;cursor:pointer}
.nw-del{background:none;border:0;color:#ff6b6b;font:inherit;font-size:.8rem;cursor:pointer;padding:6px 8px}
.nw-empty{text-align:center;padding:22px 14px;border:1px dashed var(--line,#ffffff2a);border-radius:20px;opacity:.85;font-size:.9rem}
.nw-all{display:block;width:100%;margin:2px 0 6px;padding:11px;border-radius:16px;border:1px solid var(--line,#ffffff22);background:var(--inp,#ffffff0d);color:inherit;font:inherit;font-weight:700;cursor:pointer}
.nw-form label{display:block;margin:10px 0 4px;font-weight:700;font-size:.88rem}
.nw-form input[type=text],.nw-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#ffffff2a);background:var(--inp,#ffffff10);color:inherit;border-radius:14px;padding:12px 14px;font:inherit}
.nw-form textarea{min-height:110px;resize:vertical}
.nw-drop{display:grid;place-items:center;gap:6px;border:1.5px dashed var(--line,#ffffff40);border-radius:16px;padding:16px;cursor:pointer;text-align:center;font-size:.88rem;opacity:.95}
.nw-prev{width:100%;max-height:200px;object-fit:cover;border-radius:14px;display:none;margin-top:8px}
.nw-cnt{font-size:.74rem;opacity:.7;text-align:end;margin-top:3px}
.nw-go{width:100%;margin-top:14px;border:0;cursor:pointer;font:inherit;font-weight:800;padding:14px;border-radius:16px;color:#04252b;background:linear-gradient(135deg,var(--cy,#22d3ee),var(--cy2,#14b8a6))}
.nw-go[disabled]{opacity:.55}
`;
  document.head.appendChild(css);

  const SVG_PLUS = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>';
  const SVG_HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c1.9 0 3.4 1 4.2 2.4h.1C11.1 6 12.6 5 14.5 5 17.8 5 19.6 8.4 18.1 11.8 16 16.4 12 21 12 21z" transform="translate(1.2 0)"/></svg>';

  /* ---------- العرض ---------- */
  const avatar = (n) => {
    const nm = String((n.pub && n.pub.name) || '?').trim();
    return `<span class="nw-av">${E(nm.charAt(0).toUpperCase() || '?')}${n.pub && n.pub.av ? `<img loading="lazy" alt="" src="/api/news/${n.id}/avatar?v=${n.pub.av}" onerror="this.remove()">` : ''}</span>`;
  };
  const card = (n) => {
    const long = (n.descr || '').length > 160 || (n.descr || '').split('\n').length > 3;
    return `<article class="nw-card" data-nid="${n.id}">
<div class="nw-top">${avatar(n)}<div class="nw-who"><b>${E(n.pub.name)}</b><div class="nw-meta">${n.pub.code ? `<span class="nw-code" title="كود الإحالة">كود الإحالة: ${E(n.pub.code)}</span>` : ''}<span>${E(ago2(n.ts))}</span></div></div></div>
<h3 class="nw-t">${E(n.title)}</h3>
${n.video ? `<div class="nw-vw"><video class="nw-vid" data-nv="${n.id}" src="${E((window.__SERVER || '') + n.video)}" muted loop playsinline webkit-playsinline preload="metadata"></video><button class="nw-snd" data-nw="snd" data-id="${n.id}" aria-label="الصوت">🔇</button></div>` : ''}
${n.img ? `<img class="nw-img" loading="lazy" alt="" src="${E(n.img)}" onerror="this.remove()">` : ''}
<div class="nw-d${openId[n.id] ? ' open' : ''}">${E(n.descr)}</div>
${long ? `<button class="nw-more" data-nw="more" data-id="${n.id}">${openId[n.id] ? 'عرض أقل' : 'قراءة المزيد'}</button>` : ''}
<div class="nw-ft"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="nw-like${n.liked ? ' on' : ''}" data-nw="like" data-id="${n.id}" aria-label="إعجاب">${SVG_HEART}<span>${n.likes || 0}</span></button>${n.own ? (n.gifts ? `<span class="nw-gift" style="cursor:default">🎁 <span>${n.gifts}</span></span>` : '') : `<button class="nw-gift" data-nw="gift" data-id="${n.id}" aria-label="إرسال هدية">🎁 <span>${n.gifts || 0}</span></button>`}</div>${n.own ? `<button class="nw-del" data-nw="del" data-id="${n.id}">حذف خبري</button>` : ''}</div>
</article>`;
  };
  const inner = () => {
    if (!items.length) return '<div class="nw-empty">لا توجد أخبار من المستخدمين بعد — كن أول من ينشر خبراً!</div>';
    return items.slice(0, shown).map(card).join('') + (items.length > shown ? `<button class="nw-all" data-nw="all">عرض المزيد (${items.length - shown})</button>` : '');
  };
  window.nwStrip = () => `<div class="nw-sec"><b>أخبار المستخدمين</b><button class="nw-pub" data-nw="pub">${SVG_PLUS} نشر خبر</button></div><div id="nwbox">${inner()}</div>`;
  /* تشغيل تلقائي صامت للفيديو عند ظهوره على الشاشة، وإيقافه عند خروجه */
  /* إيقاف الفيديو وكتم صوته (عند الخروج من نطاق الرؤية/الصفحة/التطبيق) */
  const stopV = (v) => { try { v.pause(); v.muted = true; const b = v.parentNode && v.parentNode.querySelector('.nw-snd'); if (b) b.textContent = '🔇'; } catch (x) {} };
  const playing = new Set();
  document.addEventListener('play', (ev) => { const v = ev.target; if (v && v.tagName === 'VIDEO' && v.classList && v.classList.contains('nw-vid')) playing.add(v); }, true);
  const sweep = () => playing.forEach((v) => {
    try {
      if (v.paused) { playing.delete(v); return; }
      const r = v.isConnected ? v.getBoundingClientRect() : null, vh = window.innerHeight || 800;
      const vis = r && r.height > 0 && Math.min(r.bottom, vh) - Math.max(r.top, 0) >= r.height * 0.4 && !document.hidden && !(document.getElementById('nwbox') === null);
      if (!vis) { stopV(v); playing.delete(v); }
    } catch (x) { playing.delete(v); }
  });
  setInterval(sweep, 400);
  window.addEventListener('scroll', sweep, { passive: true, capture: true });
  window.addEventListener('pagehide', () => document.querySelectorAll('video.nw-vid').forEach(stopV));
  window.addEventListener('blur', () => document.querySelectorAll('video.nw-vid').forEach(stopV));
  let vio = null;
  const watchVideos = () => {
    try {
      if (!('IntersectionObserver' in window)) return;
      if (!vio) vio = new IntersectionObserver((es) => es.forEach((en) => {
        const v = en.target; if (!v || v.tagName !== 'VIDEO') return;
        if (en.isIntersecting && en.intersectionRatio >= 0.55 && !document.hidden) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else { stopV(v); }
      }), { threshold: [0, 0.55, 1] });
      document.querySelectorAll('#nwbox video.nw-vid').forEach((v) => vio.observe(v));
    } catch (x) { /* اختياري */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video.nw-vid').forEach(stopV); });
  const paint = () => { const b = document.getElementById('nwbox'); if (b) { b.innerHTML = inner(); watchVideos(); } };

  /* ---------- الجلب والتحديث ---------- */
  async function load(force) {
    if (fetching) return; fetching = 1;
    try {
      const m = me();
      const j = m ? await J('/api/news/list', { e: m.e, h: m.h }) : await J('/api/news/list'); /* POST: السيرفر يتحقق من هوية المشاهد لتطبيق خصوصية المنشورات */
      if (!Array.isArray(j.items)) return;
      const s = JSON.stringify(j.items);
      if (!force && s === sig) return;
      sig = s; items = j.items; window._unews = items; paint();
    } catch (x) { /* يعاود لاحقاً */ } finally { fetching = 0; }
  }
  window.nwLoad = load;
  let lt = 0;
  window.addEventListener('store-evt', (ev) => { const d = ev && ev.detail; if (d && (d.k === 'news' || d.k === 'hello')) { clearTimeout(lt); lt = setTimeout(() => load(), 150); } });
  setInterval(() => { try { if (!document.hidden && S.r === 'home') load(); } catch (x) {} }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  let lastE = '';
  setInterval(() => { const m = me(); const e = m ? m.e : ''; if (e !== lastE) { lastE = e; load(true); } }, 3000);
  setTimeout(() => load(true), 600);

  /* ---------- نافذة نشر خبر ---------- */
  let img = '';
  const shrink = (file, max = 1100) => new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      let m = max, q = 0.78, out = '';
      for (let i = 0; i < 5; i++) {
        const k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q); if (out.length < 1.1e6) break; m = Math.round(m * 0.75); q = Math.max(0.5, q - 0.08);
      }
      ok(out);
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  /* رفع الفيديو على دفعات 1MB (يعمل عبر جسر التطبيق وعلى الشبكات الضعيفة) */
  async function uploadVideo(id, file, m, onPct) {
    const CH = 1024 * 1024, n = Math.max(1, Math.ceil(file.size / CH));
    for (let i = 0; i < n; i++) {
      const part = file.slice(i * CH, Math.min(file.size, (i + 1) * CH));
      let ok = false, last = '';
      for (let t = 0; t < 3 && !ok; t++) {
        try {
          const r = await fetch('/api/u/news/vchunk?id=' + id + '&i=' + i + '&n=' + n, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/octet-stream', 'x-e': encodeURIComponent(m.e), 'x-h': m.h }, body: part });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) { last = j.error || 'خطأ ' + r.status; if (r.status >= 400 && r.status < 500 && r.status !== 429) throw new Error(last); } else ok = true;
        } catch (x) { last = x.message || last; if (/غير|كبير|صيغة|ابدأ|ناقصة/.test(last)) throw x; await new Promise((r) => setTimeout(r, 800 * (t + 1))); }
      }
      if (!ok) throw new Error(last || 'انقطع الاتصال');
      try { onPct(Math.round(((i + 1) / n) * 100)); } catch (x) { /* */ }
    }
  }

  function openPublish() {
    if (!me()) return say('سجّل الدخول بحساب حقيقي لنشر الأخبار');
    try { if (S.acc && S.acc.demo) return say('الحساب التجريبي لا يمكنه نشر الأخبار'); } catch (x) {}
    img = '';
    dlg(`<div class="nw-form"><h2 style="margin:0 0 4px">نشر خبر</h2><p class="mu" style="margin:0 0 6px;font-size:.85rem">سيظهر خبرك لجميع المستخدمين مع اسمك وصورتك وكود الإحالة.</p>
<label for="nwt">عنوان الخبر</label><input id="nwt" type="text" maxlength="90" placeholder="اكتب عنواناً واضحاً">
<label>صورة الخبر (اختياري)</label><label class="nw-drop" for="nwi" style="margin:0"><span>📷 اضغط لاختيار صورة</span></label><input id="nwi" type="file" accept="image/*" style="display:none"><img id="nwp" class="nw-prev" alt="">
<label>فيديو (اختياري — حتى 20MB و60 ثانية، MP4)</label><label class="nw-drop" for="nwv" style="margin:0"><span>🎬 اضغط لاختيار فيديو</span></label><input id="nwv" type="file" accept="video/mp4,video/webm,video/*" style="display:none">
<label for="nwd">وصف الخبر</label><textarea id="nwd" maxlength="1500" placeholder="اكتب تفاصيل الخبر هنا..."></textarea><div class="nw-cnt"><span id="nwc">0</span> / 1500</div>
<button class="nw-go" id="nwgo">نشر الخبر</button></div>`);
    const d = document.getElementById('d');
    let vf = null;
    d.querySelector('#nwv').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; vf = null; if (!f) return;
      const sp = d.querySelector('label[for=nwv] span');
      if (f.size > 20 * 1024 * 1024) { say('الفيديو أكبر من 20MB — اختر فيديو أقصر'); e.target.value = ''; sp.textContent = '🎬 اضغط لاختيار فيديو'; return; }
      const dur = await new Promise((ok) => { try { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { const t = v.duration; URL.revokeObjectURL(v.src); ok(t); }; v.onerror = () => ok(-1); v.src = URL.createObjectURL(f); } catch (x) { ok(-1); } });
      if (dur > 61) { say('مدة الفيديو أطول من 60 ثانية'); e.target.value = ''; sp.textContent = '🎬 اضغط لاختيار فيديو'; return; }
      vf = f; sp.textContent = '✅ ' + (f.name || 'فيديو').slice(0, 28) + ' (' + (f.size / 1048576).toFixed(1) + 'MB) — اضغط للتغيير';
    });
    d.querySelector('#nwd').addEventListener('input', (e) => { d.querySelector('#nwc').textContent = e.target.value.length; });
    d.querySelector('#nwi').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { img = await shrink(f); const p = d.querySelector('#nwp'); p.src = img; p.style.display = 'block'; d.querySelector('.nw-drop span').textContent = '✅ تم اختيار الصورة — اضغط للتغيير'; }
      catch (x) { say('تعذر قراءة الصورة'); }
    });
    d.querySelector('#nwgo').addEventListener('click', async (e) => {
      const m = me(); if (!m) return say('سجّل الدخول أولاً');
      const title = d.querySelector('#nwt').value.trim(), descr = d.querySelector('#nwd').value.trim();
      if (title.length < 3) return say('اكتب عنواناً للخبر');
      if (descr.length < 5) return say('اكتب وصفاً للخبر');
      const b = e.currentTarget; b.disabled = true; b.textContent = 'جارٍ النشر...';
      try {
        const pr = await J('/api/u/news/publish', Object.assign({}, m, { title, descr, img }));
        let vErr = '';
        if (vf && pr && pr.id) {
          try { await uploadVideo(pr.id, vf, m, (pc) => { b.textContent = 'جارٍ رفع الفيديو ' + pc + '%'; }); }
          catch (x) { vErr = x.message || 'تعذر رفع الفيديو'; }
        }
        try { d.close(); } catch (x) {}
        say(vErr ? 'نُشر الخبر لكن تعذر رفع الفيديو: ' + vErr : 'تم نشر خبرك — يراه الجميع الآن');
        shown = Math.max(shown, 5); load(true);
      } catch (x) { say(x.message); b.disabled = false; b.textContent = 'نشر الخبر'; }
    });
  }

  /* ---------- هدية على منشور: الناشر يستلم 50٪ والباقي لصاحب التطبيق (النسبة من إعدادات الهدايا في لوحة التحكم) ---------- */
  const NFm = (n) => Math.floor(+n || 0).toLocaleString('en');
  let GL = null;
  async function openGift(id) {
    const m = me(); if (!m) return say('سجّل الدخول بحساب حقيقي لإرسال هدية');
    try { if (S.acc && S.acc.demo) return say('الحساب التجريبي لا يمكنه إرسال الهدايا'); } catch (x) {}
    try { if (!GL) GL = await J('/api/gifts/list'); } catch (x) { return say(x.message); }
    if (!GL.enabled || !(GL.gifts || []).length) return say('الهدايا متوقفة حالياً');
    let sel = GL.gifts[0], qty = 1; const maxQ = GL.maxQty || 10;
    dlg(`<div class="nw-form"><h2 style="margin:0 0 2px">🎁 إرسال هدية للناشر</h2><p class="mu" style="margin:0;font-size:.82rem">يستلم الناشر نصف قيمة الهدية والباقي لصاحب التطبيق.</p>
<div class="nw-gg" id="nwgg">${GL.gifts.map((g, i) => `<button data-gi="${i}" class="${i === 0 ? 'on' : ''}"><b>${E(g.emoji)}</b><small>${E(g.name)}</small><i>${NFm(g.price)}</i></button>`).join('')}</div>
<div class="nw-qty"><button data-q="-">−</button><b id="nwq" style="min-width:30px;text-align:center;font-size:1.1rem">1</b><button data-q="+">+</button></div>
<div class="mu" style="text-align:center;font-size:.85rem" id="nwgt"></div>
<div class="mu" style="text-align:center;font-size:.78rem;margin-top:2px">رصيدك: <b>${NFm((typeof S !== 'undefined' && S.pts) || 0)}</b> نقطة</div>
<button class="nw-go" id="nwgs">إرسال الهدية</button></div>`);
    const d = document.getElementById('d');
    const upd = () => { d.querySelector('#nwq').textContent = qty; d.querySelector('#nwgt').textContent = `${sel.emoji} ${sel.name} ×${qty} = ${NFm(sel.price * qty)} نقطة`; };
    upd();
    d.querySelector('#nwgg').addEventListener('click', (e) => { const b = e.target.closest('button[data-gi]'); if (!b) return; sel = GL.gifts[+b.dataset.gi]; d.querySelectorAll('#nwgg button').forEach((x) => x.classList.toggle('on', x === b)); upd(); });
    d.querySelector('.nw-qty').addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (!b) return; qty = Math.max(1, Math.min(maxQ, qty + (b.dataset.q === '+' ? 1 : -1))); upd(); });
    d.querySelector('#nwgs').addEventListener('click', async (e) => {
      const b = e.currentTarget; if (b.disabled) return;
      try { if ((+S.pts || 0) < sel.price * qty) return say('رصيدك غير كافٍ'); } catch (x) {}
      b.disabled = true; b.textContent = 'جارٍ الإرسال...';
      try {
        const r = await J('/api/gifts/post', Object.assign({ id, gift: sel.id, qty }, m));
        try { d.close(); } catch (x) {}
        say('تم إرسال ' + sel.emoji + ' — شكراً لدعمك الناشر');
        const n = items.find((x) => x.id === id); if (n) { n.gifts = r.gifts; sig = JSON.stringify(items); paint(); }
        try { window.__balPull && window.__balPull(); } catch (x) { /* اختياري */ }
      } catch (x) { say(x.message); b.disabled = false; b.textContent = 'إرسال الهدية'; }
    });
  }

  /* ---------- النقرات ---------- */
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-nw]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const a = b.dataset.nw, id = +b.dataset.id;
    if (a === 'pub') return openPublish();
    if (a === 'all') { shown = items.length; return paint(); }
    if (a === 'gift') return openGift(id);
    if (a === 'snd') { const v = b.parentNode && b.parentNode.querySelector('video'); if (v) { v.muted = !v.muted; b.textContent = v.muted ? '🔇' : '🔊'; if (!v.muted) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } } return; }
    if (a === 'more') { openId[id] = !openId[id]; return paint(); }
    if (a === 'like') {
      const m = me(); if (!m) return say('سجّل الدخول بحساب حقيقي للإعجاب');
      const n = items.find((x) => x.id === id); if (!n || b.dataset.busy) return;
      b.dataset.busy = 1;
      n.liked = !n.liked; n.likes = Math.max(0, (n.likes || 0) + (n.liked ? 1 : -1)); paint(); // فوري
      try { const r = await J('/api/u/news/like', Object.assign({ id }, m)); n.liked = r.liked; n.likes = r.likes; }
      catch (x) { n.liked = !n.liked; n.likes = Math.max(0, (n.likes || 0) + (n.liked ? 1 : -1)); say(x.message); }
      sig = JSON.stringify(items); paint();
      return;
    }
    if (a === 'del') {
      const m = me(); if (!m || !confirm('حذف هذا الخبر؟')) return;
      try { await J('/api/u/news/delete', Object.assign({ id }, m)); items = items.filter((x) => x.id !== id); window._unews = items; sig = JSON.stringify(items); paint(); say('تم حذف الخبر'); }
      catch (x) { say(x.message); }
    }
  }, true);

  /* ---------- تركيب ذاتي في الرئيسية (تحت «آخر الأخبار والعروض») إن لم يستدعِ index.html الدالة nwStrip() ---------- */
  (function () {
    function mount() {
      try {
        if (typeof S === 'undefined' || S.r !== 'home') return;
        const a = document.getElementById('app'); if (!a || a.querySelector('.nw-sec')) return;
        const an = a.querySelectorAll('button.ic[data-r="news"]'); let ref = an.length ? an[an.length - 1] : null;
        if (!ref) { const g = a.querySelectorAll('.g2'); ref = g.length ? g[g.length - 1] : null; }
        if (!ref) return;
        ref.insertAdjacentHTML('afterend', window.nwStrip());
      } catch (x) {}
    }
    const a = document.getElementById('app');
    if (a) { let t = 0; new MutationObserver(() => { if (t) return; t = requestAnimationFrame(() => { t = 0; mount(); }); }).observe(a, { childList: true }); }
    mount(); setTimeout(mount, 800);
  })();
})();

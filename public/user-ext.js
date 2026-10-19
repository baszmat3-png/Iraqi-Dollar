/* جهة المستخدم: محادثة الدعم محفوظة على السيرفر + بلاغات + أسئلة شائعة + تنبيهات الإدارة (تحديث كل 5 ثوانٍ) */
(function () {
  const J = async (p, b) => {
    const r = await fetch(p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'تعذر الاتصال');
    return j;
  };
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (e) { return null; } };
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const shrink = (file, max = 1000) => new Promise((ok, no) => {
    if (!file) return no(new Error('no file'));
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      let m = max, q = 0.75, out = '';
      for (let i = 0; i < 5; i++) {
        const k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q); if (out.length < 1.2e6) break; m = Math.round(m * 0.75); q = Math.max(0.5, q - 0.08);
      }
      ok(out);
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });


  /* ---- هيكل الدردشة الثابت (مثل واتساب): الهيدر وخانة الكتابة ثابتان والرسائل فقط تتحرك ---- */
  (function () {
    const css = document.createElement('style');
    css.textContent = `
    html.cs-on,html.cs-on body{overflow:hidden!important;overscroll-behavior:none}
    .cs{position:fixed;left:50%;transform:translateX(-50%);top:var(--vt,0px);width:min(520px,100%);height:var(--vh,100dvh);display:flex;flex-direction:column;z-index:30;background:var(--bg);overflow:hidden}
    .cs>.u2-hdn{position:static!important;transform:none!important;width:auto!important;flex:none;margin:0!important;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px!important;background:var(--bg);border-bottom:1px solid #ffffff14;box-shadow:0 4px 14px #0005;z-index:2}
    .cs>.sc-bar{flex:none;margin:6px 12px 0}
    .cs-m,.cs .u2-ms{flex:1 1 auto;min-height:0!important;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 14px!important;display:flex;flex-direction:column;justify-content:flex-start!important;gap:4px}
    .cs-m>:first-child,.cs .u2-ms>:first-child{margin-top:auto}
    .cs>.u2-in{position:static!important;transform:none!important;width:auto!important;flex:none;margin:6px 12px calc(10px + env(safe-area-inset-bottom,0px))!important;border-radius:26px;align-items:flex-end}
    .u2-in textarea{margin:0;border:0;background:none;flex:1;min-width:0;padding:11px 14px;resize:none;height:46px;max-height:120px;overflow-y:auto;color:inherit;font:inherit;line-height:1.5;outline:0;box-shadow:none}
    .u2-in textarea:focus-visible{outline:0}`;
    document.head.appendChild(css);
    const vv = window.visualViewport, r = document.documentElement;
    const fit = () => {
      const h = vv ? vv.height : window.innerHeight, t = vv ? vv.offsetTop : 0;
      r.style.setProperty('--vh', Math.round(h) + 'px'); r.style.setProperty('--vt', Math.max(0, Math.round(t)) + 'px');
      const m = document.querySelector('.cs-m,.cs .u2-ms');
      if (m && document.activeElement && document.activeElement.closest && document.activeElement.closest('.u2-in')) m.scrollTop = m.scrollHeight;
    };
    if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
    window.addEventListener('resize', fit); fit();
    window.csSync = () => { r.classList.toggle('cs-on', !!document.querySelector('.cs')); fit(); };
    window.csEnd = (force) => requestAnimationFrame(() => {
      const m = document.querySelector('.cs-m,.cs .u2-ms'); if (!m) return;
      if (force || m.scrollHeight - m.scrollTop - m.clientHeight < 160) m.scrollTop = m.scrollHeight;
    });
    // خانة الكتابة تكبر تلقائياً حتى 5 أسطر، وزر Enter في كيبورد الجوال يرسل
    document.addEventListener('input', (e) => { const t = e.target; if (t && t.tagName === 'TEXTAREA' && t.closest && t.closest('.u2-in')) { t.style.height = '46px'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; } }, true);
    document.addEventListener('beforeinput', (e) => {
      const t = e.target; if (!t || t.tagName !== 'TEXTAREA' || !t.closest || !t.closest('.u2-in') || e.inputType !== 'insertLineBreak') return;
      e.preventDefault(); const b = t.closest('.u2-in').querySelector('.u2-snd'); if (b) b.click();
    }, true);
  })();

  /* ---- محادثة الدعم: المحادثة كاملة محفوظة على السيرفر لكل مستخدم، والتحميل تزايدي ---- */
  const SUPX = (window.SUPX = { msgs: [], last: 0, who: '' });
  const tmS = (t) => { try { return new Date(t).toLocaleTimeString('ar-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const dayS = (t) => { const d = new Date(t), n = new Date(), z = (x) => x.toDateString(); if (z(d) === z(n)) return 'اليوم'; if (z(d) === z(new Date(n - 864e5))) return 'أمس'; return d.toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long' }); };
  window.supHtml = () => {
    let last = '';
    return SUPX.msgs.map((m) => {
      const d = dayS(m.created_at), h = d !== last ? `<p class="mu" style="text-align:center;margin:10px 0 4px;font-size:.8rem">${d}</p>` : ''; last = d;
      const b = esc(m.body || '') + (m.img ? `<img src="${SAFE_SRC(m.img)}" data-supimg="${m.id}" style="display:block;max-width:100%;max-height:260px;border-radius:10px;margin-top:6px;cursor:zoom-in">` : '');
      return h + `<div class="bub ${m.from_admin ? 'bt' : 'me'}">${b}<small style="display:block;font-size:.66rem;opacity:.65;margin-top:3px;text-align:end">${tmS(m.created_at)}${m.pending ? ' · جارٍ الإرسال' : ''}</small></div>`;
    }).join('');
  };
  const HELLO = '<div class="bub me">مرحباً! كيف يمكنني مساعدتك اليوم؟</div>';
  const toEndS = (force) => window.csEnd(force);
  function paintSup(sc, force) { const c = document.querySelector('#ch'); if (!c) return; const near = c.scrollHeight - c.scrollTop - c.clientHeight < 160; c.innerHTML = '<p class="mu" style="text-align:center;margin:4px 0">المحادثة محفوظة</p>' + HELLO + supHtml(); if (sc && (force || near)) toEndS(true); }

  const NOFILL = 'autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="send" inputmode="text" data-lpignore="true" data-1p-ignore="true" data-form-type="other" aria-autocomplete="none"';
  window.CHAT_NOFILL = NOFILL;
  V.chat = () => `<div class="cs"><div class="u2-hdn"><button class="ib" data-r="support" aria-label="رجوع">${ic('back')}</button><div class="ci" style="width:46px;height:46px">${ic('head', 22)}</div><div class="sp"><b>الدعم الفني</b><small class="u2-on">فريق خدمة العملاء</small></div></div>
<div id="ch" class="cs-m"><p class="mu" style="text-align:center;margin:4px 0">المحادثة محفوظة</p>${HELLO}${supHtml()}</div>
<div class="u2-in"><button class="ib" id="cimg" aria-label="إرفاق صورة" style="width:46px;height:46px;flex:none">${ic('img')}</button><textarea id="cm" rows="1" maxlength="2000" name="support-note-${Date.now() % 99999}" ${NOFILL} placeholder="اكتب رسالتك هنا..."></textarea><button class="u2-snd" data-a="send" aria-label="إرسال">${ic('send')}</button></div></div>`;

  let busy = false;
  async function supLoad(force) {
    const id = me(); if (!id) { SUPX.msgs = []; SUPX.last = 0; SUPX.who = ''; return; }
    if (busy && !force) return; busy = true;
    try {
      if (SUPX.who !== id.e) { SUPX.msgs = []; SUPX.last = 0; SUPX.who = id.e; }
      const j = await J('/api/u/support/history', { ...id, after: SUPX.last });
      const fresh = j.messages || []; if (!fresh.length) return;
      SUPX.msgs = SUPX.msgs.filter((m) => !m.pending); // نستبدل الرسائل المؤقتة بالفعلية
      const have = new Set(SUPX.msgs.map((m) => m.id));
      fresh.forEach((m) => { if (!have.has(m.id)) SUPX.msgs.push(m); SUPX.last = Math.max(SUPX.last, m.id); });
      SUPX.msgs.sort((a, b) => a.id - b.id);
      paintSup(true);
    } finally { busy = false; }
  }

  let pend = null;
  const resetImgBtn = () => { const ib = document.querySelector('#cimg'); if (ib) { ib.style.opacity = ''; ib.style.background = ''; ib.style.backgroundSize = ''; ib.innerHTML = ic('img'); } };
  window.supSend = async () => {
    const x = document.querySelector('#cm'), id = me();
    if (!x || !id) return say('سجّل الدخول أولاً');
    const body = x.value.trim(); if (!body && !pend) return;
    const img = pend; x.value = ''; x.style.height = '46px'; pend = null; resetImgBtn();
    const tmp = { id: -Date.now(), from_admin: false, body, img, created_at: new Date().toISOString(), pending: 1 };
    SUPX.msgs.push(tmp); paintSup(true, true); x.focus();
    try { await J('/api/u/support/send', { ...id, body, img }); await supLoad(true); }
    catch (e) { SUPX.msgs = SUPX.msgs.filter((m) => m !== tmp); paintSup(); x.value = body; pend = img; say(e.message); }
  };

  /* ---- نافذة البلاغ ---- */
  function reportBox() {
    if (!me()) return say('سجّل الدخول أولاً');
    const o = document.createElement('div'); let shot = null;
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl';
    o.innerHTML = `<div class="card" style="width:100%;max-width:420px;max-height:90vh;overflow:auto"><h3 style="margin:0 0 8px">إبلاغ عن حساب</h3>
<input id="rt" dir="ltr" placeholder="بريد أو رقم الحساب المبلّغ عنه"><select id="rr"><option>احتيال</option><option>إساءة أو ألفاظ مسيئة</option><option>انتحال شخصية</option><option>أخرى</option></select>
<textarea id="rd" rows="3" placeholder="اشرح ما حدث" style="width:100%;box-sizing:border-box"></textarea>
<label class="btn o sm" style="display:block;text-align:center;margin:8px 0">إرفاق صورة (سكرين)<input id="rf" type="file" accept="image/*" hidden></label><div id="rn" class="mu"></div>
<div class="g2"><button class="btn" id="rs">إرسال البلاغ</button><button class="btn o" id="rc">إلغاء</button></div></div>`;
    document.body.appendChild(o);
    const $ = (s) => o.querySelector(s);
    $('#rc').onclick = () => o.remove();
    $('#rf').onchange = async (e) => { try { shot = await shrink(e.target.files[0]); $('#rn').textContent = 'تم إرفاق الصورة'; } catch (x) { say('تعذر قراءة الصورة'); } };
    $('#rs').onclick = async () => {
      try { await J('/api/u/report', { ...me(), target: $('#rt').value, reason: $('#rr').value, details: $('#rd').value, shot }); o.remove(); say('تم إرسال البلاغ، شكراً لك'); }
      catch (e) { say(e.message); }
    };
  }

  /* ---- أزرار الصفحة (تفويض نقرات) ---- */
  document.addEventListener('click', (ev) => {
    const z = ev.target.closest('[data-supimg]');
    if (z) { const m = SUPX.msgs.find((x) => String(x.id) === z.dataset.supimg); if (m && m.img) { ev.stopPropagation(); ev.preventDefault(); const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:100002;background:#000d;display:flex;align-items:center;justify-content:center;padding:12px'; o.innerHTML = `<img src="${SAFE_SRC(m.img)}" style="max-width:100%;max-height:100%;border-radius:12px">`; o.onclick = () => o.remove(); document.body.appendChild(o); } return; }
    const t = ev.target.closest('[data-a="rpt"],#cimg'); if (!t) return;
    ev.stopPropagation(); ev.preventDefault();
    if (t.id === 'cimg') {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = async () => { try { pend = await shrink(f.files[0]); t.style.opacity = ''; t.innerHTML = ''; t.style.background = `url('${SAFE_SRC(pend)}') center/cover`; say('تم اختيار الصورة، اضغط إرسال'); } catch (e) { say('تعذر قراءة الصورة'); } };
      f.click();
    } else reportBox();
  }, true);

  /* ---- الأسئلة الشائعة من لوحة التحكم ---- */
  window.FAQA = {};
  async function faqLoad() {
    const j = await J('/api/faq'); if (!j.items.length || typeof SQ === 'undefined') return;
    const cats = {}; j.items.forEach((f) => (cats[f.cat] = cats[f.cat] || []).push(f));
    const sig = JSON.stringify(j.items.map((f) => [f.id, f.cat, f.q, f.a])); if (sig === faqLoad.sig) return; faqLoad.sig = sig;
    SQ.length = 0; FAQA = {};
    Object.keys(cats).forEach((c, ci) => { SQ.push([c, 'head', cats[c].map((f) => f.q)]); cats[c].forEach((f, qi) => (FAQA[ci + '-' + qi] = f.a)); });
    try { if (S.r === 'support') go('support'); } catch (e) {}
  }

  /* ---- تنبيهات الإدارة ---- */
  async function notices() { const id = me(); if (!id) return; (await J('/api/u/notices', id)).notices.forEach((n) => say(n.body)); }

  document.addEventListener('keydown', (e) => { if (e.target && e.target.id === 'cm' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); window.supSend(); } });
  const tick = () => { if (document.hidden) return; supLoad().catch(() => {}); notices().catch(() => {}); };
  setInterval(tick, 5000); setInterval(() => { if (!document.hidden && S.r === 'chat') supLoad().catch(() => {}); }, 2000);
  setInterval(() => faqLoad().catch(() => {}), 15000);
  setTimeout(() => { tick(); faqLoad().catch(() => {}); }, 2500);
  const _dr = window.draw; let lr = '';
  window.draw = function () { const r = _dr.apply(this, arguments); try { window.csSync(); } catch (e) {} if (S.r === 'chat' && lr !== 'chat') { toEndS(true); supLoad(true).catch(() => {}); } lr = S.r; return r; };
})();

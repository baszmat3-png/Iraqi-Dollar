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
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  /* ---- محادثة الدعم ---- */
  const SUPX = (window.SUPX = { msgs: [], sig: '' });
  window.supHtml = () => SUPX.msgs.map((m) => {
    const b = esc(m.body || '') + (m.img ? `<img src="${m.img}" style="display:block;max-width:100%;border-radius:10px;margin-top:6px">` : '');
    return `<div class="bub ${m.from_admin ? 'bt' : 'me'}">${b}</div>`;
  }).join('');

  async function supLoad() {
    const id = me(); if (!id) { SUPX.msgs = []; SUPX.sig = ''; return; }
    const j = await J('/api/u/support/history', id);
    const sig = j.messages.length + ':' + (j.messages.length ? j.messages[j.messages.length - 1].id : 0);
    if (sig === SUPX.sig) return;
    SUPX.msgs = j.messages; SUPX.sig = sig;
    const c = document.querySelector('#ch');
    if (c) {
      c.innerHTML = '<p class="mu" style="text-align:center">المحادثة محفوظة</p><div class="bub me">مرحباً! كيف يمكنني مساعدتك اليوم؟</div>' + supHtml();
      c.lastElementChild && c.lastElementChild.scrollIntoView({ block: 'end' });
    }
  }

  let pend = null;
  window.supSend = async () => {
    const x = document.querySelector('#cm'), id = me();
    if (!x || !id) return say('سجّل الدخول أولاً');
    const body = x.value.trim(); if (!body && !pend) return;
    const img = pend; x.value = ''; pend = null;
    const ib = document.querySelector('#cimg'); if (ib) ib.style.opacity = '';
    try { await J('/api/u/support/send', { ...id, body, img }); SUPX.sig = ''; await supLoad(); }
    catch (e) { x.value = body; say(e.message); }
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
    const t = ev.target.closest('[data-a="rpt"],#cimg'); if (!t) return;
    ev.stopPropagation(); ev.preventDefault();
    if (t.id === 'cimg') {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = async () => { try { pend = await shrink(f.files[0]); t.style.opacity = '.45'; say('تم اختيار الصورة، اضغط إرسال'); } catch (e) { say('تعذر قراءة الصورة'); } };
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

  const tick = () => { if (document.hidden) return; supLoad().catch(() => {}); notices().catch(() => {}); };
  setInterval(tick, 5000); setInterval(() => faqLoad().catch(() => {}), 15000);
  setTimeout(() => { tick(); faqLoad().catch(() => {}); }, 2500);
})();

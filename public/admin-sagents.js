/* لوحة الإدارة — موظفو الدعم (مستخدمون يردّون على رسائل الدعم من التطبيق) + الاطلاع على محادثاتهم */
(function () {
  if (window.SAA) return;
  const SAA = window.SAA = { ok: 0, busy: 0, list: [], t: 0, sel: '', threads: [] };
  const E = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const D = (v) => { try { return typeof dt === 'function' ? dt(v) : new Date(v).toLocaleString('ar'); } catch (x) { return ''; } };
  const owner = () => { try { return !localStorage.getItem('stt'); } catch (x) { return true; } };
  SAA.load = async function () {
    if (SAA.busy || !owner()) return; SAA.busy = 1;
    const j = await ctlApi('/support-agents', 'GET');
    if (j) { SAA.list = j.agents || []; SAA.ok = 1; SAA.t = Date.now(); }
    SAA.busy = 0; const b = document.getElementById('saa-box'); if (b) b.innerHTML = SAA.inner();
  };
  SAA.inner = function () {
    const rows = SAA.list.map((a) => `<div class="card" style="padding:10px;margin-bottom:8px"><div class="row2"><b>${E(a.name || a.email.split('@')[0])}</b><span class="mu" style="font-size:.74rem">ردود: ${a.replies} · مستخدمون: ${a.users}</span></div><div class="mu" dir="ltr" style="font-size:.74rem;text-align:start">${E(a.email)}</div><div class="row2" style="margin-top:6px;gap:6px"><button class="btn" data-a="p_saview" data-v="${E(a.email)}">المحادثات</button><button class="btn" data-a="p_sadel" data-v="${E(a.email)}" style="color:#ff6b6b">إزالة</button></div></div>`).join('');
    return (rows || '<div class="mu" style="text-align:center;padding:10px">لم تعيّن أي موظف دعم بعد</div>') +
      `<div class="row2" style="gap:6px;margin-top:8px"><input id="saa-q" placeholder="بريد أو رقم هاتف المستخدم" dir="ltr" style="flex:1"><button class="btn" data-a="p_saadd">تعيين</button></div>`;
  };
  SAA.html = function () {
    if (!owner()) return '';
    if (!SAA.ok || Date.now() - SAA.t > 15000) setTimeout(SAA.load, 0);
    return `<div class="card" style="padding:12px;margin-bottom:12px"><b>🎧 موظفو الدعم (مستخدمون للرد على الرسائل)</b><div class="mu" style="font-size:.78rem;margin:4px 0 8px">يظهر للمستخدم المعيَّن أيقونة «رسائل الدعم» في تطبيقه ويرد منها، وتطّلع هنا على محادثاته.</div><div id="saa-box">${SAA.inner()}</div></div>`;
  };
  function overlay(h) {
    let o = document.getElementById('saa-ov'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'saa-ov';
    o.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#000c;display:flex;align-items:center;justify-content:center;padding:12px';
    o.innerHTML = `<div style="background:var(--bg,#14161c);color:inherit;max-width:560px;width:100%;max-height:90vh;overflow:auto;border-radius:14px;padding:14px">${h}</div>`;
    o.addEventListener('click', (ev) => { if (ev.target === o) o.remove(); });
    document.body.appendChild(o); return o;
  }
  SAA.view = async function (email) {
    const j = await ctlApi('/support-agents/threads?email=' + encodeURIComponent(email), 'GET'); if (!j) return;
    SAA.threads = j.threads || []; SAA.sel = email;
    overlay(`<div class="row2"><b>محادثات ${E(email)}</b><button class="btn" data-a="p_saclose">✕</button></div>` +
      (SAA.threads.length ? SAA.threads.map((t) => `<button class="card" data-a="p_saopen" data-v="${E(t.email)}" style="display:block;width:100%;text-align:start;padding:10px;margin-top:8px;font:inherit;color:inherit;cursor:pointer"><div class="row2"><b>${E(t.name || t.email.split('@')[0])}</b><span class="mu" style="font-size:.74rem">${D(t.last)}</span></div><div class="mu" style="font-size:.8rem">${E(String(t.lastbody || '').slice(0, 80))}</div></button>`).join('') : '<div class="mu" style="padding:16px;text-align:center">لا توجد ردود بعد</div>'));
  };
  SAA.open = async function (user) {
    const j = await ctlApi('/support-agents/thread?e=' + encodeURIComponent(user), 'GET'); if (!j) return;
    const img = (m) => (m.img && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(m.img) ? `<img src="${m.img}" style="max-width:100%;border-radius:8px;margin-top:4px">` : '');
    overlay(`<div class="row2"><b>${E(user)}</b><span><button class="btn" data-a="p_saview" data-v="${E(SAA.sel)}">رجوع</button> <button class="btn" data-a="p_saclose">✕</button></span></div>` +
      (j.messages || []).map((m) => `<div style="margin-top:8px;display:flex;justify-content:${m.from_admin ? 'flex-start' : 'flex-end'}"><div style="max-width:85%;padding:8px 10px;border-radius:12px;background:${m.from_admin ? '#1f6feb33' : '#ffffff14'}"><div class="mu" style="font-size:.7rem">${m.from_admin ? '🎧 ' + E(m.agent ? (m.agent_name || m.agent) : 'الإدارة') : 'المستخدم'} · ${D(m.created_at)}</div><div style="white-space:pre-wrap;word-break:break-word">${E(m.body || '')}</div>${img(m)}</div></div>`).join(''));
  };
  SAA.act = function (a, v) {
    if (a === 'saadd') { const i = document.getElementById('saa-q'); const q = i ? i.value.trim() : ''; if (!q) { toast('اكتب بريد أو رقم المستخدم'); return 1; } ctlApi('/support-agents/add', 'POST', { q }).then((j) => { if (j) { toast('تم تعيين ' + (j.name || j.email) + ' موظف دعم'); SAA.load(); } }); return 1; }
    if (a === 'sadel') { if (!confirm('إزالة هذا الموظف من الرد على الدعم؟')) return 1; ctlApi('/support-agents/remove', 'POST', { email: v }).then((j) => { if (j) { toast('تمت الإزالة'); SAA.load(); } }); return 1; }
    if (a === 'saview') { SAA.view(v); return 1; }
    if (a === 'saopen') { SAA.open(v); return 1; }
    if (a === 'saclose') { const o = document.getElementById('saa-ov'); if (o) o.remove(); return 1; }
    return 0;
  };
})();

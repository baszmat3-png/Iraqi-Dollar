/* موظف الدعم: يظهر لهذا المستخدم فقط (المعيَّن من لوحة التحكم) أيقونة رسائل الدعم للرد على المستخدمين */
(function () {
  if (window.SGA) return;
  const SGA = window.SGA = { on: 0, unread: 0, key: '', user: '', last: 0 };
  const me = () => { try { return S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null; } catch (x) { return null; } };
  const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (v) => { try { return new Date(v).toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }); } catch (x) { return ''; } };
  async function api(p, body, quiet) {
    const m = me(); if (!m) return null;
    try {
      const r = await fetch('/api/u/sagent/' + p, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, m, body || {})) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { if (!quiet) { try { toast(j.error || 'تعذّر التنفيذ'); } catch (x) {} } return null; }
      return j;
    } catch (x) { return null; }
  }
  function btn() { const b = document.getElementById('sgaBtn'); if (b) b.remove(); }
  SGA.poll = async function () {
    const m = me(); if (!m) { SGA.on = 0; return; }
    const j = await api('me', {}, 1);
    const o0 = SGA.on, u0 = SGA.unread;
    SGA.on = j && j.agent ? 1 : 0; SGA.unread = +(j && j.unread) || 0; btn();
    if ((o0 !== SGA.on || u0 !== SGA.unread) && S.r === 'home' && !document.getElementById('sgaOv')) { try { const dd = document.getElementById('d'); if (!(dd && dd.open)) draw(); } catch (x) {} }
    const o = document.getElementById('sgaOv');
    if (o && SGA.on) { if (SGA.user) SGA.thread(SGA.user, 1); else SGA.list(1); }
  };
  function ov(h) {
    let o = document.getElementById('sgaOv');
    if (!o) {
      o = document.createElement('div'); o.id = 'sgaOv';
      o.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000d;display:flex;align-items:stretch;justify-content:center';
      o.innerHTML = '<div id="sgaIn" dir="rtl" style="background:#14161c;color:#eee;width:100%;max-width:560px;display:flex;flex-direction:column;height:100%"></div>';
      document.body.appendChild(o);
    }
    o.firstChild.innerHTML = h; return o;
  }
  SGA.close = function () { const o = document.getElementById('sgaOv'); if (o) o.remove(); SGA.user = ''; SGA.poll(); };
  SGA.open = function () { SGA.user = ''; SGA.list(); };
  SGA.list = async function (quiet) {
    const j = await api('threads', {}, quiet); if (!j) return;
    if (SGA.user) return;
    const hd = '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #ffffff1f"><b>🎧 رسائل الدعم</b><button id="sgaX" style="background:none;border:0;color:#fff;font-size:1.3rem">✕</button></div>';
    const rows = j.threads.map((t, i) => `<button data-i="${i}" style="display:block;width:100%;text-align:start;padding:12px 14px;border:0;border-bottom:1px solid #ffffff12;background:${t.unread ? '#f5a52418' : 'none'};color:inherit;font:inherit"><div style="display:flex;justify-content:space-between"><b>${E(t.name || String(t.email).split('@')[0])}</b><span style="opacity:.6;font-size:.74rem">${T(t.created_at)}</span></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span style="opacity:.8;font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.from_admin ? 'أنت/الدعم: ' : ''}${t.has_img && !t.body ? '📷 صورة' : E(String(t.body || '').slice(0, 70))}</span>${t.unread ? `<span style="background:#f5222d;border-radius:10px;padding:0 7px;font-size:.74rem">${t.unread}</span>` : ''}</div></button>`).join('');
    const o = ov(hd + '<div style="flex:1;overflow:auto">' + (rows || '<div style="padding:30px;text-align:center;opacity:.6">لا توجد رسائل دعم</div>') + '</div>');
    o.querySelector('#sgaX').onclick = SGA.close;
    o.querySelectorAll('button[data-i]').forEach((b) => { b.onclick = () => SGA.thread(j.threads[+b.dataset.i].email); });
  };
  SGA.thread = async function (u, quiet) {
    SGA.user = u;
    const j = await api('thread', { user: u }, quiet); if (!j) return;
    const keep = (document.getElementById('sgaTx') || {}).value || '';
    const msgs = j.messages.map((m) => `<div style="display:flex;justify-content:${m.from_admin ? 'flex-start' : 'flex-end'};margin:6px 0"><div style="max-width:85%;padding:8px 10px;border-radius:12px;background:${m.from_admin ? '#1f6feb44' : '#ffffff18'}"><div style="white-space:pre-wrap;word-break:break-word">${E(m.body || '')}</div>${m.img && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(m.img) ? `<img src="${m.img}" style="max-width:100%;border-radius:8px;margin-top:4px">` : ''}<div style="opacity:.5;font-size:.68rem;margin-top:2px">${T(m.created_at)}</div></div></div>`).join('');
    const o = ov(`<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #ffffff1f"><button id="sgaB" style="background:none;border:0;color:#fff;font-size:1.2rem">→</button><b style="flex:1;overflow:hidden;text-overflow:ellipsis" dir="ltr">${E(u)}</b><button id="sgaX" style="background:none;border:0;color:#fff;font-size:1.3rem">✕</button></div><div id="sgaMs" style="flex:1;overflow:auto;padding:8px 12px">${msgs}</div><div style="display:flex;gap:8px;padding:10px;border-top:1px solid #ffffff1f"><textarea id="sgaTx" rows="2" maxlength="2000" placeholder="اكتب ردّك…" style="flex:1;border-radius:10px;border:1px solid #ffffff33;background:#0e1014;color:#fff;padding:8px;font:inherit;resize:none"></textarea><button id="sgaS" style="border:0;border-radius:10px;background:#1f6feb;color:#fff;padding:0 16px;font:inherit">إرسال</button></div>`);
    const tx = o.querySelector('#sgaTx'); tx.value = keep;
    const ms = o.querySelector('#sgaMs'); ms.scrollTop = ms.scrollHeight;
    o.querySelector('#sgaX').onclick = SGA.close;
    o.querySelector('#sgaB').onclick = () => { SGA.user = ''; SGA.list(); };
    o.querySelector('#sgaS').onclick = async function () {
      const v = tx.value.trim(); if (!v) return; this.disabled = true;
      const r = await api('reply', { user: u, body: v });
      if (r) { tx.value = ''; await SGA.thread(u, 1); } else this.disabled = false;
    };
  };
  setTimeout(SGA.poll, 2500); setInterval(SGA.poll, 20000);
})();

/* news-admin.js — لوحة التحكم: قسم أخبار المستخدمين (عرض كل الأخبار مع بيانات الناشر + حذف) */
(function () {
  'use strict';
  if (window.__nwAdmin) return;
  window.__nwAdmin = 1;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const dt = (t) => t ? new Date(t).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  async function api(path, body) {
    if (!key()) throw new Error('احفظ مفتاح الإدارة أولاً (الإعدادات ← التحكم المركزي)');
    const r = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'X-Admin-Key': key(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
    return j;
  }

  const css = document.createElement('style');
  css.textContent = `
#nwb{position:fixed;bottom:142px;inset-inline-start:16px;z-index:9998;display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#ff8a3d,#ffb347);color:#2b1300;border:0;border-radius:99px;padding:11px 18px;font:700 .9rem Cairo,Tahoma,sans-serif;box-shadow:0 6px 22px #0007;cursor:pointer}
#nwb i{background:#2b1300;color:#ffb347;border-radius:99px;padding:1px 8px;font-style:normal;font-size:12px}
#nwo{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#e8f1f6;background:#0E1621;--ac:#ffb347;--bd:#4a3a24;--cd:#1d2230;--mu:#8f9bb3}
#nwo.on{display:flex}#nwo *{box-sizing:border-box}
#nwo .h{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 10px;border-bottom:1px solid #ffffff0d}
#nwo h1{margin:0;font-size:1.25rem;flex:1}
#nwo .x{width:40px;height:40px;border-radius:12px;border:1.5px solid var(--bd);background:#2a2214;color:var(--ac);font-size:1.2rem;cursor:pointer}
#nwm{flex:1;overflow:auto;padding:14px;max-width:900px;width:100%;margin:0 auto}
#nwo .k{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
#nwo .k div{background:var(--cd);border:1.5px solid var(--bd);border-radius:14px;padding:10px;text-align:center}
#nwo .k b{display:block;font-size:1.25rem;color:var(--ac)}#nwo .k span{font-size:.72rem;color:var(--mu)}
#nwo .sr{width:100%;background:#0E1621;border:1.5px solid var(--bd);border-radius:12px;color:#fff;font:inherit;padding:10px 13px;margin-bottom:12px}
#nwo .c{background:var(--cd);border:1.5px solid var(--bd);border-radius:18px;padding:14px;margin-bottom:12px}
#nwo .top{display:flex;align-items:center;gap:11px;margin-bottom:10px}
#nwo .av{position:relative;width:46px;height:46px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;color:#2b1300;background:var(--ac);overflow:hidden}
#nwo .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#nwo .who{flex:1;min-width:0}#nwo .who b{display:block}
#nwo .mu{color:var(--mu);font-size:.78rem;word-break:break-all}
#nwo .cd{display:inline-block;margin-top:3px;padding:2px 10px;border-radius:99px;background:#ffb34722;border:1px solid #ffb34766;color:var(--ac);font-weight:700;font-size:.74rem;direction:ltr}
#nwo h3{margin:4px 0 6px;font-size:1.02rem}
#nwo .im{width:100%;max-height:280px;object-fit:cover;border-radius:14px;margin:6px 0;display:block}
#nwo .ds{font-size:.88rem;line-height:1.8;white-space:pre-wrap;word-break:break-word;opacity:.92}
#nwo .ft{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #ffffff12}
#nwo .lk{font-weight:700;color:#ff6b8f}
#nwo .dl{border:0;border-radius:12px;padding:9px 18px;font:700 .85rem Cairo,Tahoma,sans-serif;cursor:pointer;background:#ef5350;color:#fff}
#nwo .dl[disabled]{opacity:.5;pointer-events:none}
#nwo .em{text-align:center;color:var(--mu);padding:30px}
`;
  document.head.appendChild(css);
  { const g = document.createElement('style'); g.textContent = 'body:not(.stf-in) #nwb,body:not(.stf-in) #nwo{display:none!important}'; document.head.appendChild(g); }   // يظهر بعد دخول لوحة التحكم فقط كبقية الأزرار العائمة

  const btn = document.createElement('button'); btn.id = 'nwb'; btn.innerHTML = '📰 أخبار المستخدمين <i hidden></i>';
  const ov = document.createElement('div'); ov.id = 'nwo';
  ov.innerHTML = '<div class="h"><h1>📰 أخبار المستخدمين</h1><button class="x" aria-label="إغلاق">✕</button></div><div id="nwm"></div>';
  document.body.appendChild(btn); document.body.appendChild(ov);
  const M = ov.querySelector('#nwm');

  let items = [], q = '', sig = '', timer = 0, busy = 0;

  const card = (n) => {
    const nm = String(n.pub.name || '?').trim();
    return `<div class="c" data-id="${n.id}">
<div class="top"><span class="av">${esc(nm.charAt(0).toUpperCase() || '?')}${n.pub.av ? `<img loading="lazy" alt="" src="/api/news/${n.id}/avatar?v=${n.pub.av}" onerror="this.remove()">` : ''}</span>
<div class="who"><b>${esc(nm)}</b><div class="mu" dir="ltr" style="text-align:start">${esc(n.email || '')}</div>${n.pub.code ? `<span class="cd">كود الإحالة: ${esc(n.pub.code)}</span>` : ''}</div>
<div class="mu" style="text-align:end;flex:none">${esc(dt(n.ts))}</div></div>
<h3>${esc(n.title)}</h3>
${n.img ? `<img class="im" loading="lazy" alt="" src="${esc(n.img)}" onerror="this.remove()">` : ''}
<div class="ds">${esc(n.descr)}</div>
<div class="ft"><span class="lk">❤ ${n.likes || 0} إعجاب</span><button class="dl" data-del="${n.id}">🗑 حذف الخبر</button></div></div>`;
  };

  function render() {
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((n) => [n.title, n.descr, n.pub.name, n.pub.code, n.email].join(' ').toLowerCase().includes(t)) : items;
    const likes = items.reduce((s, n) => s + (n.likes || 0), 0), pubs = new Set(items.map((n) => n.email)).size;
    const keep = document.activeElement && document.activeElement.classList.contains('sr');
    const top = M.scrollTop;
    M.innerHTML = `<div class="k"><div><b>${items.length}</b><span>الأخبار المنشورة</span></div><div><b>${pubs}</b><span>الناشرون</span></div><div><b>${likes}</b><span>إجمالي الإعجابات</span></div></div>
<input class="sr" placeholder="بحث بالعنوان أو اسم الناشر أو كود الإحالة..." value="${esc(q)}">${list.map(card).join('') || '<div class="em">لا توجد أخبار</div>'}`;
    M.scrollTop = top;
    if (keep) { const s = M.querySelector('.sr'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    const b = btn.querySelector('i'); b.textContent = items.length; b.hidden = !items.length;
  }

  async function load(force) {
    if (busy) return; busy = 1;
    try {
      const j = await api('/api/ctl/news');
      const s = JSON.stringify(j.items);
      if (force || s !== sig) { sig = s; items = j.items; render(); }
    } catch (e) { if (force) M.innerHTML = '<div class="em">' + esc(e.message) + '</div>'; }
    finally { busy = 0; }
  }

  const open = () => { ov.classList.add('on'); load(true); clearInterval(timer); timer = setInterval(() => { if (!document.hidden) load(); }, 6000); };
  const close = () => { ov.classList.remove('on'); clearInterval(timer); };
  btn.onclick = open;
  ov.querySelector('.x').onclick = close;
  M.addEventListener('input', (e) => { if (e.target.classList.contains('sr')) { q = e.target.value; render(); } });
  M.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const id = +b.dataset.del, n = items.find((x) => x.id === id);
    if (!n || !confirm('حذف هذا الخبر نهائياً؟\n«' + n.title + '» — الناشر: ' + n.pub.name)) return;
    b.disabled = true;
    try { await api('/api/ctl/news/delete', { id }); items = items.filter((x) => x.id !== id); sig = JSON.stringify(items); render(); say('تم حذف الخبر — اختفى من التطبيق فوراً'); }
    catch (x) { say(x.message); b.disabled = false; }
  });
  setTimeout(() => load(), 1500);
  setInterval(() => { if (!ov.classList.contains('on') && !document.hidden && document.body.classList.contains('stf-in')) load(); }, 20000);
})();

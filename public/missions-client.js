/* قسم المهمات — 5 مراحل (التقدّم والمكافآت من السيرفر) */
(function () {
  if (window.MS) return;
  const MS = window.MS = { st: null, earned: 0, busy: 0, open: 1 };
  const hdr = () => { const a = S.acc; return a && a.e && a.h ? { e: a.e, h: a.h } : null; };
  const redraw = () => { try { if (S.r === 'missions') { const dd = document.getElementById('d'); if (!(dd && dd.open)) draw(); } } catch (x) {} };
  async function api(path, extra) {
    const h = hdr(); if (!h) { toast('سجّل الدخول أولاً'); return null; }
    try {
      const r = await fetch('/api/missions/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, h, extra || {})) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { toast(j.error || 'تعذّر تنفيذ العملية'); return null; }
      return j;
    } catch (x) { toast('تحقق من الاتصال بالإنترنت'); return null; }
  }
  MS.load = async function () {
    if (MS.busy) return; MS.busy = 1;
    const j = await api('state'); if (j) { MS.st = j.stages; MS.earned = j.earned; }
    MS.busy = 0; redraw();
  };
  MS.claim = async function (id) {
    const j = await api('claim', { id });
    if (j) { try { if (window.__balPull) window.__balPull(); } catch (x) {} toast('🎉 حصلت على ' + f(j.pts) + ' نقطة'); }
    MS.load();
  };
  MS.tab = function (n) { MS.open = +n; redraw(); };
  MS.view = function () {
    if (!MS.st && !MS.busy) setTimeout(MS.load, 0);
    const st = MS.st || [];
    const tot = st.reduce((t, s) => t + s.missions.length + 1, 0), dn = st.reduce((t, s) => t + s.missions.filter((m) => m.claimed).length + (s.bonusClaimed ? 1 : 0), 0);
    const card = (s) => {
      const open = MS.open === s.id, done = s.missions.filter((m) => m.claimed).length;
      return `<div class="card" style="${s.locked ? 'opacity:.55' : ''}"><div class="row2" data-a="mstab" data-i="${s.id}" style="cursor:pointer"><b>${s.emoji} المرحلة ${s.id}: ${s.name}</b><span class="mu">${s.locked ? '🔒 مقفلة' : done + '/' + s.missions.length}</span></div>` +
        (open && !s.locked ? s.missions.map((m) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row2"><b>${m.title}</b><span class="cy">+${f(m.reward)} نقطة</span></div><div class="mu" style="font-size:.82rem">${m.desc}</div>
          <div style="height:6px;border-radius:9px;background:#ffffff18;margin:7px 0;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(m.prog / m.goal * 100)}%;background:var(--cy)"></i></div>
          <div class="row2"><span class="mu" style="font-size:.8rem">${f(m.prog)} / ${f(m.goal)}</span>${m.claimed ? '<span class="bdg ok">تم الاستلام ✓</span>' : m.done ? `<button class="btn sm" data-a="mscl" data-i="${m.id}">استلم المكافأة</button>` : '<span class="bdg no">قيد التنفيذ</span>'}</div></div>`).join('') +
          `<div class="row2" style="padding:10px 0;border-top:1px dashed var(--line)"><b>🎁 مكافأة إنهاء المرحلة</b>${s.bonusClaimed ? '<span class="bdg ok">تم الاستلام ✓</span>' : s.bonusReady ? `<button class="btn sm" data-a="mscl" data-i="s${s.id}">+${f(s.bonus)} نقطة</button>` : `<span class="mu">+${f(s.bonus)} نقطة · أكمل كل المهام</span>`}</div>` : '') + '</div>';
    };
    return hd('المهمات', 'gauge', { back: 'home' }) +
      `<div class="note" style="color:var(--cy);background:#0f2a33;border-color:var(--line)">${ic('info', 18)}<span>5 مراحل من الأسهل للأصعب. تُفتح المرحلة التالية بعد استلام كل مكافآت السابقة، والمكافآت تُضاف لرصيدك من السيرفر.</span></div>` +
      (st.length ? `<div class="card"><div class="row2"><b>تقدّمك</b><span class="cy">${dn}/${tot}</span></div><div class="mu">إجمالي ما كسبته من المهمات: ${f(MS.earned)} نقطة</div></div>` + st.map(card).join('') : '<div class="card mu" style="text-align:center">جارٍ التحميل...</div>');
  };
})();

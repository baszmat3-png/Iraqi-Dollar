/* حذف الحساب من داخل التطبيق (متطلب Google Play)
 * يضيف زر «حذف حسابي» أسفل «تسجيل الخروج» في الملف الشخصي. يعتمد على: account-delete-ext.js في السيرفر. */
(function () {
  if (typeof S === 'undefined' || typeof AC === 'undefined') return;
  const E = (t) => (typeof esc === 'function' ? esc(String(t)) : String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const show = (h) => { try { dlg(h); } catch (e) { alert('تعذر فتح النافذة'); } };
  const close = () => { try { document.getElementById('d').close(); } catch (e) {} };
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  let busy = 0;

  const me = () => {
    if (!S.acc || S.staff) return null;
    const m = AC.get(), k = Object.keys(m).find((x) => x.toLowerCase() === String(S.acc.e).toLowerCase());
    const a = k ? m[k] : null;
    return { e: String(S.acc.e).toLowerCase(), key: k || S.acc.e, h: a && a.h || '', demo: !!(a && a.demo) };
  };

  async function post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok, j };
  }

  function wipeLocal(u) {
    try { const m = AC.get(); delete m[u.key]; AC.set(m); } catch (e) {}
    try { localStorage.removeItem((typeof CK !== 'undefined' ? CK : 'ctr_state') + ':' + u.key); } catch (e) {}
    try { if (window.SECX && SECX.wipeLocal) SECX.wipeLocal(u.key); } catch (e) {}
    try { clearSes(); } catch (e) {}
    S.acc = null;
    close();
    try { go('welcome'); } catch (e) { location.reload(); }
    say('تم حذف حسابك وبياناتك');
  }

  const WHAT = `<p class="mu" style="margin:6px 0">سيُحذف نهائياً: حسابك وصورتك الشخصية، جلسات الدخول والأجهزة، الأصدقاء والرسائل والإشعارات، ملف البائع وإعلاناتك، ومتجرك إن وُجد.</p>
<p class="mu" style="margin:6px 0">يُحتفظ به بالقدر اللازم قانونياً ولمنع الاحتيال: سجلات المعاملات المالية وطلبات P2P المكتملة، دون ربطها باسمك بعد الحذف. <a href="/privacy-policy.html" target="_blank" style="color:inherit;text-decoration:underline">سياسة الخصوصية</a></p>
<p style="margin:10px 0;color:#ff6b6b"><b>لا يمكن التراجع عن الحذف.</b></p>`;

  async function open() {
    if (busy) return;
    const u = me();
    if (!u) return;
    const head = '<h2 style="margin-top:0;color:#ff6b6b">حذف الحساب</h2>';
    // حساب محلي فقط (لا بصمة له على السيرفر)
    if (!u.h) {
      return show(head + WHAT + `<button class="btn r" id="dalo">حذف الحساب من هذا الجهاز</button><button class="btn o" style="margin-top:8px" onclick="d.close()">إلغاء</button>`)
        || setTimeout(() => { const b = document.getElementById('dalo'); if (b) b.onclick = () => wipeLocal(u); }, 0);
    }
    show(head + '<p class="mu">جارٍ التحقق من حسابك…</p>');
    let r;
    try { r = await post('/api/u/account/delete/check', { e: u.e, h: u.h }); } catch (e) { return show(head + '<p class="mu">تعذر الاتصال بالسيرفر، حاول لاحقاً.</p><button class="btn o" onclick="d.close()">إغلاق</button>'); }
    if (!r.ok) return show(head + `<p class="mu">${E(r.j.error || 'تعذر التحقق من الحساب، سجّل الدخول من جديد ثم أعد المحاولة.')}</p><button class="btn o" onclick="d.close()">إغلاق</button>`);

    const bl = (r.j.blockers || []).slice();
    try { if (typeof debtOverdue === 'function' && debtOverdue(u.e)) bl.push('عليك قسط استدانة متأخر. سدّده أولاً ثم أعد المحاولة.'); } catch (e) {}
    if (bl.length) {
      return show(head + WHAT + `<div style="background:#ff6b6b22;border-radius:10px;padding:10px 12px;margin:10px 0"><b>لا يمكن الحذف الآن:</b><ul style="margin:6px 0;padding-inline-start:18px">${bl.map((x) => `<li>${E(x)}</li>`).join('')}</ul></div><button class="btn o" onclick="d.close()">حسناً</button>`);
    }
    const b = r.j.balance || {}, has = (b.pts || 0) + (b.gems || 0) + (b.usd || 0) > 0;
    show(head + WHAT
      + (has ? `<div style="background:#f4c20d22;border-radius:10px;padding:10px 12px;margin:10px 0"><b>رصيدك الحالي سيضيع:</b> ${nf(b.pts)} نقطة${b.gems ? ' · ' + nf(b.gems) + ' جوهرة' : ''}${b.usd ? ' · ' + nf(b.usd) + '$' : ''}<br><small>اسحب أو حوّل ما تريد قبل المتابعة.</small><label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="dafo" style="width:auto"> أوافق على فقدان رصيدي</label></div>` : '')
      + `<p class="mu" style="margin:8px 0">للتأكيد اكتب كلمة «حذف»:</p><input id="dacf" autocomplete="off" placeholder="حذف"><p id="daer" style="color:#ff6b6b;min-height:1.2em;margin:6px 0"></p>`
      + `<button class="btn r" id="dago">حذف حسابي نهائياً</button><button class="btn o" style="margin-top:8px" onclick="d.close()">إلغاء</button>`);
    setTimeout(() => {
      const go1 = document.getElementById('dago'), er1 = document.getElementById('daer');
      if (!go1) return;
      go1.onclick = async () => {
        if (busy) return;
        const cf = (document.getElementById('dacf').value || '').trim(), fo = document.getElementById('dafo');
        if (cf !== 'حذف') { er1.textContent = 'اكتب كلمة «حذف» للتأكيد'; return; }
        if (has && !(fo && fo.checked)) { er1.textContent = 'وافق على فقدان الرصيد للمتابعة'; return; }
        busy = 1; go1.disabled = true; er1.textContent = 'جارٍ الحذف…';
        try {
          const x = await post('/api/u/account/delete', { e: u.e, h: u.h, confirm: 'حذف', forfeit: has ? true : false });
          if (!x.ok) { er1.textContent = x.j.error || 'تعذر الحذف، حاول لاحقاً'; go1.disabled = false; return; }
          wipeLocal(u);
        } catch (e) { er1.textContent = 'تعذر الاتصال بالسيرفر، حاول لاحقاً'; go1.disabled = false; } finally { busy = 0; }
      };
    }, 0);
  }

  // زر الحذف أسفل «تسجيل الخروج»
  function inject() {
    if (!S.acc || S.staff) return;
    document.querySelectorAll('[data-a="logout"]').forEach((b) => {
      if (b.nextElementSibling && b.nextElementSibling.getAttribute('data-a') === 'delacc') return;
      const x = document.createElement('button');
      x.className = 'btn o'; x.setAttribute('data-a', 'delacc'); x.type = 'button';
      x.style.cssText = 'margin-top:10px;color:#ff6b6b;border-color:#ff6b6b66';
      x.textContent = 'حذف حسابي';
      b.insertAdjacentElement('afterend', x);
    });
  }
  document.addEventListener('click', (ev) => {
    const t = ev.target && ev.target.closest && ev.target.closest('[data-a="delacc"]');
    if (!t) return;
    ev.stopPropagation(); ev.preventDefault();
    open();
  }, true);
  new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
  inject();
  window.openDeleteAccount = open;
})();

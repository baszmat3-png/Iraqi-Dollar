/* لوحة الإدارة المتقدمة: المستخدمون · البلاغات · الدعم · الأسئلة الشائعة (تعمل على السيرفر) */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const dt = (t) => new Date(t).toLocaleString('ar-IQ');
  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'X-Admin-Key': key(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
    return j;
  }
  const shrink = (file, max = 1000) => new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  const css = document.createElement('style');
  css.textContent = `#axb{position:fixed;bottom:16px;inset-inline-start:16px;z-index:9998;background:#2bcfe2;color:#000;border:0;border-radius:99px;padding:12px 18px;font:700 14px inherit;font-family:inherit;box-shadow:0 4px 16px #0008}
#axb i{background:#ef5350;color:#fff;border-radius:99px;padding:1px 7px;margin-inline-start:6px;font-style:normal;font-size:12px}
#axo{position:fixed;inset:0;z-index:9999;background:#0f1722;color:#e8eef5;display:none;flex-direction:column;font-family:inherit;direction:rtl}
#axo.on{display:flex}#axo header{display:flex;gap:6px;align-items:center;padding:10px;border-bottom:1px solid #2a3a4d;overflow-x:auto}
#axo header button,#axo .b{background:#1f2a37;color:#e8eef5;border:1px solid #2a3a4d;border-radius:10px;padding:9px 13px;font:inherit;cursor:pointer;white-space:nowrap}
#axo header button.on,#axo .b.p{background:#2bcfe2;color:#000;border-color:#2bcfe2}#axo .b.d{color:#ef5350}
#axm{flex:1;overflow:auto;padding:12px}#axo .c{background:#1a2431;border:1px solid #2a3a4d;border-radius:12px;padding:12px;margin-bottom:10px}
#axo input,#axo textarea,#axo select{width:100%;box-sizing:border-box;background:#0f1722;color:#e8eef5;border:1px solid #2a3a4d;border-radius:10px;padding:10px;margin:4px 0;font:inherit}
#axo .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#axo .mu{color:#8da2b8;font-size:.82rem}#axo .g{flex:1}
#axo .bb{max-width:85%;padding:8px 12px;border-radius:12px;margin:5px 0;overflow-wrap:anywhere}#axo .u{background:#1f2a37}#axo .a{background:#0e5f6b;margin-inline-start:auto}
#axo img.s{max-width:100%;border-radius:8px;margin-top:6px}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.id = 'axb'; btn.innerHTML = 'إدارة متقدمة<i hidden></i>';
  const ov = document.createElement('div');
  ov.id = 'axo';
  ov.innerHTML = '<header><button data-t="users">المستخدمون</button><button data-t="reports">البلاغات</button><button data-t="support">الدعم</button><button data-t="fin">المالية</button><button data-t="ledger">سجل العمليات</button><button data-t="faq">الأسئلة الشائعة</button><span class="g"></span><button data-x="1">إغلاق ✕</button></header><div id="axm"></div>';
  document.body.append(btn, ov);
  const M = ov.querySelector('#axm');

  let lf = { kind: '', cat: '', q: '' }, tab = 'users', thread = null, rep = 'open', busy = false, shot = null, uq = '';

  const err = (e) => { M.insertAdjacentHTML('afterbegin', `<div class="c" style="color:#ef5350">${esc(e.message)}</div>`); };

  const V = {
    async users() {
      const j = await api('/api/ctl/users?q=' + encodeURIComponent(uq));
      return `<div class="c"><div class="r"><input id="uq" class="g" placeholder="بحث بالبريد أو الاسم أو الرقم" value="${esc(uq)}"><button class="b p" data-a="usearch">بحث</button></div>
<div class="mu">كل الحسابات: ${j.total.n} · تجريبية: ${j.total.demo} · محظورة: ${j.total.blk}</div>
<button class="b d" data-a="purge" style="margin-top:8px">حذف الحسابات التجريبية فقط</button></div>` +
        j.users.map((u) => `<div class="c"><b>${esc(u.name || '—')}</b> ${u.demo ? '<span class="mu">[تجريبي]</span>' : ''}${u.blk ? ' <span style="color:#ef5350">[محظور]</span>' : ''}
<div class="mu" dir="ltr">${esc(u.email)} · ${esc(u.phone || '')}</div>
<div class="mu">نقاط: ${nf(u.pts)} · جواهر: ${nf(u.gems)} · $${nf(u.usd)} · آخر ظهور: ${u.last_seen ? dt(u.last_seen) : '—'}</div>
<div class="r" style="margin-top:8px"><button class="b" data-a="charge" data-e="${esc(u.email)}">شحن</button><button class="b" data-a="reset" data-e="${esc(u.email)}">تصفير</button>
<button class="b" data-a="${u.blk ? 'unban' : 'ban'}" data-e="${esc(u.email)}">${u.blk ? 'فك الحظر' : 'حظر'}</button><button class="b d" data-a="del" data-e="${esc(u.email)}">حذف</button>
<button class="b" data-a="chat" data-e="${esc(u.email)}">مراسلة</button></div></div>`).join('');
    },
    async reports() {
      const j = await api('/api/ctl/reports?status=' + rep);
      return `<div class="r" style="margin-bottom:10px"><button class="b ${rep === 'open' ? 'p' : ''}" data-a="rtab" data-v="open">المفتوحة</button><button class="b ${rep === 'closed' ? 'p' : ''}" data-a="rtab" data-v="closed">المعالجة</button></div>` +
        (j.reports.map((r) => `<div class="c"><div class="r"><b>${esc(r.reason)}</b><span class="g"></span><span class="mu">${dt(r.created_at)}</span></div>
<div class="mu" dir="ltr">المبلِّغ: ${esc(r.reporter)}</div><div dir="ltr">المبلَّغ عنه: <b>${esc(r.target)}</b> ${r.target_blk ? '<span style="color:#ef5350">[محظور]</span>' : ''}</div>
<p>${esc(r.details)}</p>${r.shot ? `<img class="s" src="${r.shot}">` : ''}${r.status !== 'open' ? `<div class="mu">الحالة: ${esc(r.status)} ${esc(r.note || '')}</div>` : `
<textarea id="rn${r.id}" rows="2" placeholder="ملاحظة أو نص التنبيه لصاحب الحساب"></textarea>
<div class="r"><button class="b d" data-a="rban" data-id="${r.id}">حظر الحساب</button><button class="b" data-a="rwarn" data-id="${r.id}">تنبيه صاحب الحساب</button><button class="b" data-a="rclose" data-id="${r.id}">إغلاق</button></div>`}</div>`).join('') || '<div class="c mu">لا توجد بلاغات</div>');
    },
    async support() {
      if (thread) {
        const j = await api('/api/ctl/support/thread?e=' + encodeURIComponent(thread));
        return `<div class="r"><button class="b" data-a="back">← المحادثات</button><b dir="ltr">${esc(thread)}</b></div><div class="c" id="axt">` +
          j.messages.map((m) => `<div class="bb ${m.from_admin ? 'a' : 'u'}">${esc(m.body)}${m.img ? `<img class="s" src="${m.img}">` : ''}<div class="mu">${dt(m.created_at)}</div></div>`).join('') +
          `</div><textarea id="ar" rows="2" placeholder="اكتب الرد..."></textarea><div class="r"><label class="b">صورة<input id="af" type="file" accept="image/*" hidden></label><span id="an" class="mu"></span><span class="g"></span><button class="b p" data-a="areply">إرسال</button></div>`;
      }
      const j = await api('/api/ctl/support/threads');
      return j.threads.map((t) => `<div class="c" data-a="open" data-e="${esc(t.email)}" style="cursor:pointer"><div class="r"><b>${esc(t.name || t.email)}</b>${t.unread ? `<span style="background:#ef5350;border-radius:99px;padding:0 8px">${t.unread}</span>` : ''}<span class="g"></span><span class="mu">${dt(t.created_at)}</span></div>
<div class="mu">${t.from_admin ? 'أنت: ' : ''}${esc(t.has_img && !t.body ? '📷 صورة' : t.body).slice(0, 90)}</div></div>`).join('') || '<div class="c mu">لا توجد محادثات. المحادثات تُحفظ دائماً ولا تُحذف.</div>';
    },
    async fin() {
      const [j, c] = await Promise.all([api('/api/ctl/fin2/summary'), api('/api/ctl/fin2/costs')]);
      const S = j.settings, L = j.liability, row = (a, b, col) => `<div class="r"><span class="g">${a}</span><b${col ? ` style="color:${col}"` : ''}>${b}</b></div>`;
      const names = new Set(c.items.map((x) => x.name)), extra = (typeof PR !== 'undefined' ? PR.map((p) => p[0]) : []).filter((n) => !names.has(n)).map((name) => ({ name, kind: 'product', buy: 0, sell: 0 }));
      const costRow = (x) => `<div class="c" data-cn="${esc(x.name)}" data-ck="${x.kind}"><b>${esc(x.name)}</b><div class="r"><input class="cb" type="number" placeholder="سعر الشراء (د.ع)" value="${x.buy || ''}"><input class="cs" type="number" placeholder="سعر البيع (د.ع)" value="${x.sell || ''}"><button class="b p" data-a="csave">حفظ</button></div></div>`;
      return `<div class="c"><div class="mu">رصيد صاحب التطبيق${j.since ? ' · منذ آخر إعادة تعيين ' + dt(j.since) : ''}</div><div style="font-size:1.6rem;font-weight:700">${nf(j.owner.balance)} د.ع</div>
<div class="mu" style="margin-top:6px">مصدر الرصيد:</div>${j.owner.sources.map((x) => row(esc(x.label), nf(x.iqd), x.iqd < 0 ? '#ef5350' : '')).join('')}</div>
<div class="c"><b>الأرباح: ${nf(j.profit)} د.ع</b>${j.parts.map((x) => row(esc(x.label), nf(x.iqd))).join('')}</div>
<div class="c"><b>المبيعات</b>${row('عدد القطع المباعة', nf(j.sales.units))}${row('إجمالي البيع', nf(j.sales.revenue) + ' د.ع')}${row('هامش الربح', j.sales.margin + '%')}</div>
<div class="c"><b>الأكثر طلباً</b>${j.top.map((t) => `<div style="margin-top:6px">${esc(t.name)} ${t.missing ? '<span style="color:#f0b429" class="mu">(بلا سعر شراء/بيع)</span>' : ''}<div class="mu">العدد ${nf(t.units)} · البيع ${nf(t.revenue)} · الربح ${nf(t.profit)}</div></div>`).join('') || '<div class="mu">لا مبيعات بعد</div>'}</div>
<div class="c"><b>أموال المستخدمين الواجب إرجاعها (${L.months} أشهر)</b>${row('المستلم من العدادات', nf(L.received))}${row('رُدّ كعوائد', nf(L.paid))}${row('المتبقي', nf(L.outstanding))}${row('المطلوب تحويله شهرياً', nf(L.monthly) + ' د.ع', '#2bcfe2')}</div>
<div class="c"><b>الإعدادات</b><div class="mu">إيميل حساب التطبيق (يُخفى من الإحصائيات)</div><input id="fa" dir="ltr" value="${esc(S.app_email)}"><label class="r"><input id="fh" type="checkbox" style="width:auto" ${S.hide_app ? 'checked' : ''}> إخفاء رصيد حساب التطبيق وعدم احتسابه</label>
<div class="r"><input id="fm" type="number" placeholder="أشهر الإرجاع" value="${S.months}"><input id="fd" type="number" placeholder="% ربح الاستدانة من القسط" value="${S.debt_pct}"></div>
<div class="r"><input id="fo" type="number" placeholder="الرصيد الافتتاحي (د.ع)" value="${S.open_bal || ''}"><input id="fs" placeholder="مصدر الرصيد الافتتاحي" value="${esc(S.open_src)}"></div>
<div class="r"><button class="b p" data-a="fset">حفظ</button><button class="b d" data-a="freset">إعادة تعيين الإحصائيات والبدء من جديد</button></div><div class="mu">إعادة التعيين لا تحذف السجل، فقط تبدأ الحساب من الآن.</div></div>
<b>أسعار الشراء والبيع</b><div class="mu" style="margin-bottom:6px">الربح = (البيع − الشراء) × العدد، ويُحسب بعد حفظ السعرين.</div>${c.items.concat(extra).map(costRow).join('')}`;
    },
    async ledger() {
      const j = await api(`/api/ctl/fin2/ledger?kind=${lf.kind}&cat=${lf.cat}&q=${encodeURIComponent(lf.q)}`);
      return `<div class="c"><div class="r"><select id="lk"><option value="">الكل</option><option value="in" ${lf.kind === 'in' ? 'selected' : ''}>إيرادات</option><option value="out" ${lf.kind === 'out' ? 'selected' : ''}>مصروفات</option></select>
<select id="lc"><option value="">كل التصنيفات</option>${Object.entries(j.cats).map(([k, v]) => `<option value="${k}" ${lf.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
<div class="r"><input id="lq" class="g" placeholder="بحث بالبريد أو التفاصيل" value="${esc(lf.q)}"><button class="b p" data-a="lfilter">تطبيق</button></div>
<div class="mu">إيرادات ${nf(j.totals.in)} · مصروفات ${nf(j.totals.out)} · الصافي ${nf(j.totals.in - j.totals.out)} د.ع</div></div>
<div class="c"><b>إضافة قيد يدوي</b><div class="r"><select id="mk"><option value="in">إيراد</option><option value="out">مصروف</option></select><input id="mc" placeholder="التصنيف (مثل: إيجار)"></div><div class="r"><input id="mi" type="number" placeholder="المبلغ (د.ع)"><input id="mn" class="g" placeholder="التفاصيل"></div><button class="b p" data-a="ladd">إضافة</button></div>` +
        (j.rows.map((r) => `<div class="c" style="${r.pre_reset ? 'opacity:.6' : ''}"><div class="r"><b style="color:${r.kind === 'in' ? '#4caf50' : '#ef5350'}">${r.kind === 'in' ? '+' : '−'}${nf(r.iqd)} د.ع</b><span class="mu">${esc(r.cat_label)}</span><span class="g"></span><span class="mu">${dt(r.ts)}</span></div>
<div class="mu" dir="ltr">من: ${esc(r.from)} ← إلى: ${esc(r.to)}${r.app ? ' [حساب التطبيق]' : ''}</div><div>${esc(r.note || '')}</div>${r.src === 'manual' ? `<button class="b d" data-a="ldel" data-id="${esc(r.uid)}">حذف</button>` : ''}</div>`).join('') || '<div class="c mu">لا توجد حركات</div>');
    },
    async faq() {
      const j = await (await fetch('/api/faq')).json();
      const row = (f) => `<div class="c" data-f="${f.id || 0}"><input class="fc" placeholder="القسم" value="${esc(f.cat || '')}"><input class="fq" placeholder="السؤال" value="${esc(f.q || '')}"><textarea class="fa" rows="3" placeholder="الجواب">${esc(f.a || '')}</textarea>
<div class="r"><input class="fs" type="number" style="width:90px" placeholder="الترتيب" value="${f.sort || 0}"><span class="g"></span><button class="b p" data-a="fsave">حفظ</button>${f.id ? '<button class="b d" data-a="fdel">حذف</button>' : ''}</div></div>`;
      return '<div class="mu" style="margin-bottom:8px">تظهر هذه الأسئلة للمستخدمين في قسم المساعدة. إن كانت القائمة فارغة تُستخدم الأسئلة الافتراضية.</div>' + row({}) + j.items.map(row).join('');
    },
  };

  async function draw(keep) {
    if (busy) return; busy = true;
    ov.querySelectorAll('header [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    try {
      const y = M.scrollTop, html = await V[tab]();
      // لا نعيد الرسم أثناء الكتابة حتى لا يضيع النص
      const typing = M.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!(keep && typing)) { M.innerHTML = html; M.scrollTop = keep ? y : 0; if (tab === 'support' && thread) { const t = M.querySelector('#axt'); t && (t.parentElement.scrollTop = 1e9); } }
    } catch (e) { err(e); }
    busy = false;
  }

  async function act(el) {
    const a = el.dataset.a, e = el.dataset.e, id = el.dataset.id;
    const post = async (p, b) => { try { await api(p, b); } catch (x) { return alert(x.message); } draw(); };
    if (a === 'usearch') { uq = M.querySelector('#uq').value.trim(); return draw(); }
    if (a === 'purge') return confirm('حذف كل الحسابات التجريبية؟ الحسابات الحقيقية لن تُمس.') && post('/api/ctl/users/purge-demo', { confirm: true });
    if (a === 'del') return confirm('حذف الحساب ' + e + ' نهائياً؟') && post('/api/ctl/users/act', { email: e, op: 'delete', confirm: true });
    if (a === 'reset') return confirm('تصفير رصيد ' + e + '؟') && post('/api/ctl/users/act', { email: e, op: 'reset' });
    if (a === 'ban' || a === 'unban') return post('/api/ctl/users/act', { email: e, op: a });
    if (a === 'charge') { const p = prompt('نقاط للشحن (0 للتخطي)', '0'); if (p === null) return; const g = prompt('جواهر للشحن', '0'); if (g === null) return; const u = prompt('دولار للشحن', '0'); if (u === null) return; return post('/api/ctl/users/act', { email: e, op: 'charge', pts: +p, gems: +g, usd: +u }); }
    if (a === 'chat') { tab = 'support'; thread = e; return draw(); }
    if (a === 'rtab') { rep = el.dataset.v; return draw(); }
    if (a === 'rban' || a === 'rwarn' || a === 'rclose') { const note = (M.querySelector('#rn' + id) || {}).value || ''; if (a === 'rban' && !confirm('حظر الحساب المبلّغ عنه؟')) return; return post('/api/ctl/reports/act', { id: +id, op: a.slice(1), note }); }
    if (a === 'open') { thread = e; return draw(); }
    if (a === 'back') { thread = null; return draw(); }
    if (a === 'areply') { const body = M.querySelector('#ar').value.trim(); if (!body && !shot) return; const s = shot; shot = null; return post('/api/ctl/support/reply', { e: thread, body, img: s }); }
    if (a === 'fset') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin2/settings', { app_email: g('#fa').value, hide_app: g('#fh').checked, months: +g('#fm').value, debt_pct: +g('#fd').value, open_bal: +g('#fo').value, open_src: g('#fs').value }); }
    if (a === 'freset') return confirm('إعادة تعيين الإحصائيات المالية والبدء من جديد؟ السجل القديم يبقى محفوظاً.') && post('/api/ctl/fin2/reset', { confirm: true });
    if (a === 'csave') { const c = el.closest('[data-cn]'); return post('/api/ctl/fin2/costs', { name: c.dataset.cn, kind: c.dataset.ck, buy: +c.querySelector('.cb').value, sell: +c.querySelector('.cs').value }); }
    if (a === 'lfilter') { lf = { kind: M.querySelector('#lk').value, cat: M.querySelector('#lc').value, q: M.querySelector('#lq').value.trim() }; return draw(); }
    if (a === 'ladd') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin/add', { kind: g('#mk').value, cat: g('#mc').value, iqd: +g('#mi').value, note: g('#mn').value }); }
    if (a === 'ldel') return confirm('حذف هذا القيد اليدوي؟') && post('/api/ctl/fin/del', { uid: id });
    if (a === 'fsave' || a === 'fdel') {
      const c = el.closest('[data-f]'), fid = +c.dataset.f;
      if (a === 'fdel') return confirm('حذف السؤال؟') && post('/api/ctl/faq/del', { id: fid });
      return post('/api/ctl/faq/save', { id: fid, cat: c.querySelector('.fc').value, q: c.querySelector('.fq').value, a: c.querySelector('.fa').value, sort: c.querySelector('.fs').value });
    }
  }

  ov.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-t],[data-x],[data-a]');
    if (!t) return;
    if (t.dataset.x) return ov.classList.remove('on');
    if (t.dataset.t) { tab = t.dataset.t; thread = null; return draw(); }
    act(t);
  });
  ov.addEventListener('change', async (ev) => {
    if (ev.target.id !== 'af' || !ev.target.files[0]) return;
    try { shot = await shrink(ev.target.files[0]); M.querySelector('#an').textContent = 'تم اختيار صورة'; } catch (e) { alert('تعذر قراءة الصورة'); }
  });
  btn.onclick = () => { if (!key()) return alert('احفظ مفتاح الإدارة أولاً من قسم النظام والأمان'); ov.classList.add('on'); draw(); };

  // تحديث دوري كل 5 ثوانٍ
  setInterval(async () => {
    if (!key()) return;
    if (ov.classList.contains('on') && !document.hidden) draw(true);
    try { const c = await api('/api/ctl/counts'), n = c.reports + c.support, b = btn.querySelector('i'); b.hidden = !n; b.textContent = n; } catch (e) {}
  }, 5000);
})();

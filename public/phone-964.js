/* phone-964.js — يكتب رمز الدولة +964 تلقائياً في كل خانات رقم الهاتف (التطبيق + لوحة التحكم)
   - يعمل على الخانات الحالية والتي تُنشأ لاحقاً داخل النوافذ (MutationObserver)
   - لا يغيّر الخانات التي فيها رقم محفوظ مسبقاً
   - إذا تُركت الخانة على +964 فقط تُقرأ كقيمة فارغة حتى لا يُحفظ رمز بدون رقم */
(function () {
  'use strict';
  var CC = '+964';
  // خانات بمعرّفاتها (التسجيل، تغيير الرقم، الوكالات، العقود، إضافة/تعديل مستخدم، التاجر، P2P، واتساب الطلبات)
  var IDS = ['rp', 'nv', 'ag_p', 'agd_p', 'ay3', 'up', 'ep', 'cp', 'c_o2', 'apph', 'mxap', 'cf_agWa'];
  var SEL = 'input[type="tel"],input[inputmode="tel"],input[autocomplete="tel"],' +
    IDS.map(function (i) { return 'input#' + i; }).join(',');
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function isPhone(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    var t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'email' || t === 'password' || t === 'number' || t === 'file' || t === 'checkbox' || t === 'radio' || t === 'search') return false;
    // نافذة تغيير الرقم/البريد تستعمل نفس المعرّف nv: نعتمد على النوع tel
    if (el.id === 'nv' && t !== 'tel') return false;
    if (el.matches(SEL)) return true;
    var ph = el.getAttribute('placeholder') || '';
    return /\+?964\s?7/.test(ph);
  }

  function norm(v) {
    var s = String(v || '').replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; });
    var raw = s.replace(/[\s\-()]/g, '');
    if (!raw) return CC;
    if (/^\+/.test(raw)) return s;
    if (/^00/.test(raw)) return '+' + raw.slice(2);
    if (/^964/.test(raw)) return '+' + raw;
    if (/^07\d/.test(raw)) return CC + raw.slice(1);
    if (/^7\d{9}$/.test(raw)) return CC + raw;
    return s;
  }

  // يُبقي الرمز +964 ثابتاً: أي رمز آخر أو صفر بادئ يُحوَّل إلى +964
  function lock(v) {
    var d = String(v || '').replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }).replace(/\D/g, '');
    if (!d || '964'.indexOf(d) === 0) return CC;
    d = d.replace(/^0+/, '');
    if (d.indexOf('964') === 0) d = d.slice(3);
    d = d.replace(/^0+/, '');
    return CC + d;
  }

  function setVal(el, v) { desc.set.call(el, v); }
  function getVal(el) { return desc.get.call(el); }

  function prep(el) {
    if (el.__p964) return;
    el.__p964 = 1;
    // القيمة التي يقرؤها الكود: +964 وحدها = فارغ
    try {
      Object.defineProperty(el, 'value', {
        configurable: true,
        get: function () { var v = getVal(el); return String(v).trim() === CC ? '' : v; },
        set: function (v) { setVal(el, v); }
      });
    } catch (e) {}
    if (!String(getVal(el)).trim()) setVal(el, CC);
    el.setAttribute('dir', 'ltr');
    el.addEventListener('focus', function () {
      if (!String(getVal(el)).trim()) setVal(el, CC);
      var n = getVal(el).length;
      setTimeout(function () { try { el.setSelectionRange(n, n); } catch (e) {} }, 0);
    });
    el.addEventListener('input', function () {
      var v = getVal(el), n = lock(v);
      if (n !== v) setVal(el, n); // الرمز ثابت +964 ولا يمكن حذفه أو تغييره
    });
    el.addEventListener('blur', function () {
      var v = getVal(el);
      if (!String(v).trim()) { setVal(el, CC); return; }
      var n = lock(v);
      if (n !== v) setVal(el, n);
    });
  }

  // أي قائمة منسدلة لرمز الدولة: يبقى +964 فقط
  function fixSelects(root) {
    var ss = root.tagName === 'SELECT' ? [root] : (root.querySelectorAll ? root.querySelectorAll('select') : []);
    for (var i = 0; i < ss.length; i++) {
      var s = ss[i], os = s.options, code = 0, ok = 0;
      for (var j = 0; j < os.length; j++) {
        if (/^\s*\+?\d{1,3}\s*$/.test(os[j].value || os[j].text)) code++;
        if (/964/.test(os[j].value || os[j].text)) ok++;
      }
      if (code && code === os.length) {
        if (ok) { for (var k = os.length - 1; k >= 0; k--) if (!/964/.test(os[k].value || os[k].text)) s.remove(k); }
        else { s.innerHTML = '<option value="+964">+964</option>'; }
        s.value = s.options[0].value; s.disabled = true;
      }
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    fixSelects(root);
    if (root.tagName === 'INPUT') { if (isPhone(root)) prep(root); return; }
    var list = root.querySelectorAll ? root.querySelectorAll('input') : [];
    for (var i = 0; i < list.length; i++) if (isPhone(list[i])) prep(list[i]);
  }

  function start() {
    scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var a = ms[i].addedNodes;
        for (var j = 0; j < a.length; j++) scan(a[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    // شبكة أمان: أي خانة هاتف لم تُلتقط تُجهَّز عند أول تركيز
    document.addEventListener('focusin', function (e) { if (isPhone(e.target)) prep(e.target); }, true);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

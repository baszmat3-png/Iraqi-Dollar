/* xss-guard.js — يُحمَّل قبل أي سكربت آخر.
 * SAFE_SRC(v): يُرجع القيمة فقط إن كانت صورة data: مضبوطة النهاية (بلا علامات اقتباس/أقواس) أو مساراً داخلياً /api/...
 * وإلا نصاً فارغاً. يُستخدم حول كل قيمة صورة تُحقن داخل src="..." أو url('...') في قوالب HTML. */
(function () {
  'use strict';
  var DATA = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  var API = /^\/api\/[A-Za-z0-9\/_\-.]*(?:\?[A-Za-z0-9_\-.=&%]*)?$/;
  window.SAFE_SRC = function (v) {
    if (typeof v !== 'string' || v.length > 6e6) return '';
    return DATA.test(v) || API.test(v) ? v : '';
  };
})();

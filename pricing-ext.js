/* المرحلة 5 — توحيد التسعيرة المخزّنة في الإعدادات المنشورة (بدل القيم القديمة مثل 1,520 نقطة للدولار)
   النقطة للمستخدم 0.132 د.ع · للوكيل 0.120 د.ع · الدولار 1,620 د.ع · النقاط لكل دولار = 1620×1000÷132 */
exports.migrate = async (pool) => {
  try {
    const r = (await pool.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    if (!r || !r.val || typeof r.val !== 'object' || !r.val.cfg) return;
    const c = r.val.cfg;
    if (Number(c.pv) >= 2) return;
    Object.assign(c, { agRate: 132, agOff: 120, iqd: 1620, usdRate: 12272.73, pv: 2, ct: {} });
    await pool.query(`UPDATE sync_kv SET val=$1, updated_at=NOW() WHERE key='config'`, [JSON.stringify(r.val)]);
    console.log('pricing-ext: الإعدادات المنشورة حُدّثت إلى التسعيرة الجديدة');
  } catch (e) { console.error('pricing-ext:', e.message); }
};

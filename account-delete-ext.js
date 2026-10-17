/* account-delete-ext.js — حذف الحساب من داخل التطبيق (متطلب Google Play)
 *  POST /api/u/account/delete/check  {e,h}                    : يعرض الأرصدة وما يمنع الحذف
 *  POST /api/u/account/delete        {e,h,confirm:'حذف',forfeit} : ينفّذ الحذف
 * يُحذف: الحساب والصورة والجلسات والأجهزة والأصدقاء والرسائل والإشعارات وملف البائع والإعلانات.
 * يُحتفظ به بالقدر اللازم قانونياً ولمنع الاحتيال: سجلات المعاملات المالية (بدون بيانات شخصية إضافية) وبصمة بريد مشفّرة.
 * التركيب في server.js:  require('./account-delete-ext')(app, { pool, wrap, fail });
 */
const crypto = require('crypto');
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update('acc-del:' + s).digest('hex');

module.exports = (app, { pool, wrap, fail }) => {
  const hits = new Map(); // تحديد معدل بسيط لكل IP
  const limited = (ip) => {
    const t = Date.now(), a = (hits.get(ip) || []).filter((x) => t - x < 60000);
    a.push(t); hits.set(ip, a);
    if (hits.size > 5000) hits.clear();
    return a.length > 8;
  };

  const one = async (sql, p) => { try { return (await pool.query(sql, p)).rows[0] || {}; } catch (e) { return {}; } };

  async function authed(req) {
    if (limited(req.ip)) fail(429, 'محاولات كثيرة، حاول بعد دقيقة');
    const e = txt(req.body && req.body.e, 200).toLowerCase(), h = txt(req.body && req.body.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = (await pool.query(
      `SELECT email, pts, gems, usd, blk, demo FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h])).rows[0];
    if (!r) fail(401, 'غير مسجّل الدخول');
    return { email: e, h, acc: r };
  }

  async function blockers(email) {
    const out = [];
    const o = await one(`SELECT COUNT(*)::int n FROM p2p_orders WHERE (LOWER(buyer_email)=$1 OR LOWER(seller_email)=$1) AND status IN ('awaiting_payment','proof_submitted','disputed')`, [email]);
    if (o.n > 0) out.push('لديك طلبات P2P مفتوحة (' + o.n + '). أكملها أو ألغِها أولاً.');
    const a = await one(`SELECT COUNT(*)::int n FROM p2p_ads WHERE LOWER(seller_email)=$1 AND status IN ('active','paused') AND avail_pts>0`, [email]);
    if (a.n > 0) out.push('لديك إعلانات P2P فيها نقاط محجوزة. أغلقها لتعود النقاط لرصيدك ثم أعد المحاولة.');
    const p = (await one(`SELECT COUNT(*)::int n FROM agent_buys WHERE LOWER(email)=$1 AND status='pending'`, [email])).n
      + (await one(`SELECT COUNT(*)::int n FROM pts_requests WHERE LOWER(email)=$1 AND status='pending'`, [email])).n
      + (await one(`SELECT COUNT(*)::int n FROM store_orders WHERE LOWER(email)=$1 AND status='pending'`, [email])).n;
    if (p > 0) out.push('لديك طلبات شراء قيد المعالجة (' + p + '). انتظر انتهاءها.');
    return out;
  }

  app.post('/api/u/account/delete/check', wrap(async (req, res) => {
    const u = await authed(req);
    if (u.acc.blk) return res.json({ ok: true, can: false, blockers: ['الحساب موقوف، تواصل مع الدعم لحذفه.'], balance: {} });
    const b = await blockers(u.email);
    res.json({
      ok: true, can: !b.length, blockers: b,
      balance: { pts: Number(u.acc.pts) || 0, gems: Number(u.acc.gems) || 0, usd: Number(u.acc.usd) || 0 },
    });
  }));

  app.post('/api/u/account/delete', wrap(async (req, res) => {
    const u = await authed(req);
    if (u.acc.blk) fail(403, 'الحساب موقوف، تواصل مع الدعم لحذفه');
    if (txt(req.body.confirm, 20) !== 'حذف') fail(400, 'اكتب كلمة «حذف» للتأكيد');
    const bal = (Number(u.acc.pts) || 0) + (Number(u.acc.gems) || 0) + (Number(u.acc.usd) || 0);
    if (bal > 0 && req.body.forfeit !== true) fail(400, 'يجب الموافقة على فقدان الرصيد المتبقي');
    const bl = await blockers(u.email);
    if (bl.length) fail(409, bl[0]);

    const email = u.email, tomb = 'deleted-' + sha(email).slice(0, 12);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const run = async (sql, p) => { // كل أمر في نقطة حفظ: غياب جدول لا يُفشل العملية
        await c.query('SAVEPOINT sp');
        try { const r = await c.query(sql, p); await c.query('RELEASE SAVEPOINT sp'); return r; }
        catch (e) { await c.query('ROLLBACK TO SAVEPOINT sp'); return { rowCount: 0 }; }
      };
      const E = [email];
      for (const t of ['avatars', 'agent_profiles', 'sec_sessions', 'sec_trusted', 'sec_otps', 'user_devices', 'notices', 'soc_notes', 'support_msgs', 'ref_owned', 'agency_free', 'fin_excl'])
        await run(`DELETE FROM ${t} WHERE LOWER(email)=$1`, E);
      await run(`DELETE FROM soc_friends WHERE LOWER(a)=$1 OR LOWER(b)=$1`, E);
      await run(`DELETE FROM soc_msgs WHERE LOWER(f)=$1 OR LOWER(t)=$1`, E);
      await run(`DELETE FROM p2p_msgs WHERE LOWER(f)=$1 OR LOWER(t)=$1`, E);
      await run(`DELETE FROM p2p_ads WHERE LOWER(seller_email)=$1`, E);
      await run(`DELETE FROM p2p_sellers WHERE LOWER(email)=$1`, E);
      await run(`DELETE FROM p2p_reviews WHERE LOWER(seller_email)=$1`, E);
      await run(`UPDATE p2p_reviews SET comment=NULL, buyer_email=$2 WHERE LOWER(buyer_email)=$1`, [email, tomb]);
      // المتاجر: بيانات النشاط تُمسح، والسجل المالي يبقى باسم مجهول
      await run(`UPDATE merchants SET status='closed', phone='', image=NULL, details='', address='', landmark='', services='' WHERE LOWER(owner)=$1 AND id IN (SELECT merchant_id FROM merchant_tx)`, E);
      await run(`DELETE FROM merchants WHERE LOWER(owner)=$1 AND id NOT IN (SELECT merchant_id FROM merchant_tx)`, E);
      await run(`UPDATE merchants SET owner=$2 WHERE LOWER(owner)=$1`, [email, tomb]);
      await run(`UPDATE store_orders SET name=NULL WHERE LOWER(email)=$1`, E);
      await run(`UPDATE pts_requests SET name='', phone='' WHERE LOWER(email)=$1`, E);
      await run(`CREATE TABLE IF NOT EXISTS deleted_accounts(email_hash TEXT PRIMARY KEY, deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`, []);
      await run(`INSERT INTO deleted_accounts(email_hash) VALUES($1) ON CONFLICT DO NOTHING`, [sha(email)]);
      const d = await c.query(`DELETE FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [email, u.h]);
      if (d.rowCount !== 1) throw Object.assign(new Error('x'), { http: 401 });
      await c.query('COMMIT');
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch (x) {}
      if (e.http) fail(401, 'غير مسجّل الدخول');
      throw e;
    } finally { c.release(); }
    res.json({ ok: true });
  }));
};

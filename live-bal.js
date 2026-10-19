/* live-bal.js — مركز البثّ الفوري لأرصدة كل المستخدمين (نقاط · جواهر · دولار)
   السيرفر هو المرجع الوحيد للرصيد (جدول sync_accounts). هذا الملف يراقب أي تغيير فيه — أياً كان مصدره
   (شحن/خصم من الإدارة، تحويل، هدية، تاجر، وكيل، P2P، رصيد مرفوع من جهاز المستخدم...) — ويبثّه لحظياً إلى:
     1) لوحة التحكم (أقسام: شحن النقاط · المستخدمون · الحسابات والتحكم):
          GET /api/ctl/live-bal?since=N   استطلاع طويل (long-poll):
            since<0  → يرجع {seq} فقط (نقطة البداية)
            وإلا     → يرجع فوراً أي تغييرات أحدث من N، أو ينتظر حتى 20 ثانية لأول تغيير.
     2) كل أجهزة صاحب الحساب المتصلة (تطبيق + متصفح...) عبر SSE: حدث «bal» (يسحب منه الجهاز رصيده من السيرفر فوراً).
   المراقبة تعمل فقط ما دامت لوحة تحكم مفتوحة (مسح كامل) أو يوجد مستخدمون متصلون (مسح لحساباتهم فقط)،
   وإلا لا حمل على القاعدة. */
module.exports = (app, { pool, wrap, ctl }) => {
  const RING_MAX = 5000, TICK = 500, ADMIN_TTL = 40000;
  let seq = 0, primedFull = false, curRun = null, rerun = false, lastPoll = 0;
  const last = new Map();          // email -> 'pts|gems|usd'
  let ring = [];                   // [{s,e,pts,gems,usd}]
  const waiters = new Set();

  const num = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };
  const adminActive = () => Date.now() - lastPoll < ADMIN_TTL;

  function scan() {
    if (curRun) { rerun = true; return curRun; }
    curRun = scanOnce().finally(() => { curRun = null; if (rerun) { rerun = false; setImmediate(scan); } });
    return curRun;
  }

  async function scanOnce() {
    try {
      const full = adminActive();
      let rows;
      if (full) {
        rows = (await pool.query(`SELECT LOWER(email) AS e, pts, gems, usd FROM sync_accounts`)).rows;
      } else {
        const em = typeof app.locals.sseEmails === 'function' ? app.locals.sseEmails() : [];
        if (!em.length) { primedFull = false; return; }
        rows = (await pool.query(`SELECT LOWER(email) AS e, pts, gems, usd FROM sync_accounts WHERE LOWER(email) = ANY($1::text[])`, [em])).rows;
      }
      const silent = full && !primedFull;        // أول مسح كامل بعد انقطاع: نُعيد التهيئة بصمت
      const seen = full ? new Set() : null;
      const ch = [];
      for (const x of rows) {
        const pts = num(x.pts), gems = num(x.gems), usd = num(x.usd);
        const sig = pts + '|' + gems + '|' + usd;
        if (seen) seen.add(x.e);
        const prev = last.get(x.e);
        if (prev === sig) continue;
        last.set(x.e, sig);
        if (silent) continue;
        if (full) ch.push({ s: ++seq, e: x.e, pts, gems, usd });
        try { if (typeof app.locals.pushBal === 'function') app.locals.pushBal(x.e, { pts, gems, usd }); } catch (e) { /* اختياري */ }
      }
      if (full) {
        for (const k of [...last.keys()]) if (!seen.has(k)) last.delete(k);
        if (silent) { seq++; ring = []; primedFull = true; }   // يُجبر لوحة قديمة على إعادة التحميل الكامل بدل أن تفوتها تغييرات
      } else if (last.size > 50000) last.clear();
      if (ch.length) {
        ring = ring.concat(ch);
        if (ring.length > RING_MAX) ring = ring.slice(ring.length - RING_MAX);
        flush();
      }
    } catch (e) { /* يعاود بعد قليل */ }
  }

  function flush() {
    for (const w of [...waiters]) {
      const ev = ring.filter((x) => x.s > w.since);
      if (ev.length) { waiters.delete(w); clearTimeout(w.t); try { w.res.json({ seq, ev }); } catch (e) { /* أُغلق الاتصال */ } }
    }
  }

  setInterval(scan, TICK).unref();
  // يُستدعى فور أي تعديل رصيد من السيرفر نفسه ليصل البثّ دون انتظار الدورة القادمة
  app.locals.liveBalKick = () => { scan(); };

  app.get('/api/ctl/live-bal', ...ctl, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    lastPoll = Date.now();
    for (let i = 0; i < 3 && !primedFull; i++) await scan();
    const since = Number(req.query.since);
    if (!Number.isFinite(since) || since < 0) return res.json({ seq, ev: [] });
    if (since > seq) return res.json({ seq, reset: true, ev: [] }); // السيرفر أُعيد تشغيله
    const minSeq = ring.length ? ring[0].s : seq + 1;
    if (since < minSeq - 1 && since < seq) return res.json({ seq, reset: true, ev: [] }); // فجوة: أعد التحميل الكامل
    const ev = ring.filter((x) => x.s > since);
    if (ev.length) return res.json({ seq, ev });
    const w = { since, res, t: null };
    w.t = setTimeout(() => { waiters.delete(w); try { res.json({ seq, ev: [] }); } catch (e) {} }, 20000);
    waiters.add(w);
    req.on('close', () => { waiters.delete(w); clearTimeout(w.t); });
  }));

  console.log('live-bal: بثّ فوري للأرصدة جاهز');
};

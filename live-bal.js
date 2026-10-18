/* live-bal.js — بثّ فوري لتغيّر أرصدة كل المستخدمين (نقاط · جواهر · دولار) إلى لوحة التحكم
   GET /api/ctl/live-bal?since=N   استطلاع طويل (long-poll):
        since<0  → يرجع {seq} فقط (نقطة البداية)
        وإلا     → يرجع فوراً أي تغييرات أحدث من N، أو ينتظر حتى 20 ثانية لأول تغيير.
   يعمل المراقب فقط ما دامت لوحة تحكم مفتوحة (لا حمل على القاعدة بدونها). */
module.exports = (app, { pool, wrap, ctl }) => {
  const RING_MAX = 5000;
  let seq = 0, primed = false, scanning = false, lastPoll = 0;
  const last = new Map();          // email -> 'pts|gems|usd'
  let ring = [];                   // [{s,e,pts,gems,usd}]
  const waiters = new Set();

  const num = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };

  async function scan() {
    if (scanning) return; scanning = true;
    try {
      const r = await pool.query(`SELECT LOWER(email) AS e, pts, gems, usd FROM sync_accounts`);
      const seen = new Set();
      const ch = [];
      for (const x of r.rows) {
        const pts = num(x.pts), gems = num(x.gems), usd = num(x.usd);
        const sig = pts + '|' + gems + '|' + usd;
        seen.add(x.e);
        if (primed && last.get(x.e) !== sig) ch.push({ s: ++seq, e: x.e, pts, gems, usd });
        last.set(x.e, sig);
      }
      for (const k of [...last.keys()]) if (!seen.has(k)) last.delete(k);
      primed = true;
      if (ch.length) {
        ring = ring.concat(ch);
        if (ring.length > RING_MAX) ring = ring.slice(ring.length - RING_MAX);
        flush();
      }
    } catch (e) { /* يعاود بعد قليل */ }
    scanning = false;
  }

  function flush() {
    for (const w of [...waiters]) {
      const ev = ring.filter((x) => x.s > w.since);
      if (ev.length) { waiters.delete(w); clearTimeout(w.t); w.res.json({ seq, ev }); }
    }
  }

  setInterval(() => { if (Date.now() - lastPoll < 40000) scan(); }, 700);
  app.locals.liveBalKick = () => { lastPoll = Date.now(); scan(); };

  app.get('/api/ctl/live-bal', ...ctl, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    lastPoll = Date.now();
    if (!primed) await scan();
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

/**
 * cycle-ext.js — دورة عائد العداد (24 ساعة) على السيرفر: الاستحقاق والاستلام وإضافة النقاط كلها من السيرفر.
 *  POST /api/cycle/state  {e,h,seed?}   : يحسب ما مضى منذ آخر تحديث (مع انتهاء العدادات أثناء الدورة)، ويستلم تلقائياً عند اكتمال 24 ساعة
 *  POST /api/cycle/toggle {e,h,run}     : تشغيل/إيقاف مؤقت (الإيقاف يحفظ المتبقي من الدورة)
 *  POST /api/cycle/claim  {e,h}         : مرادف state (للتوافق)
 * المعادلة مطابقة للتطبيق: العائد اليومي = base + مجموع إنتاجية العدادات الفعّالة، يتراكم لحظياً أثناء التشغيل،
 * وعند اكتمال الدورة تُضاف floor(المتراكم) إلى الرصيد ويتوقف العداد (ended) حتى يعيد المستخدم تشغيله.
 * seed: عند أول استعلام فقط تُؤخذ حالة الجهاز الحالية بسقف (≤ عائد يوم واحد) لئلا تضيع دورة جارية عند الترحيل.
 */
const YIELD0 = [50, 100, 100, 500, 500, 1000, 5000, 10000, 100000];
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const DAY = 86400;

module.exports = (app, express, deps) => {
  const { pool, wrap, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '4kb' });
  const ready = q(`CREATE TABLE IF NOT EXISTS ctr_cycle(email TEXT PRIMARY KEY, run BOOLEAN NOT NULL DEFAULT TRUE, left_s DOUBLE PRECISION NOT NULL DEFAULT 86400,
      accr DOUBLE PRECISION NOT NULL DEFAULT 0, ended BOOLEAN NOT NULL DEFAULT FALSE, upd BIGINT NOT NULL, total_claimed BIGINT NOT NULL DEFAULT 0)`)
    .catch((e) => console.error('ctr_cycle schema:', e.message));
  app.use('/api/cycle', (_req, _res, next) => ready.then(() => next(), next));

  async function cfg(c) {
    let v = {};
    try { const r = (await c.query(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0]; v = (r && r.val && r.val.cfg) || {}; } catch (_) { /* افتراضي */ }
    const base = Number(v.base); return { base: Number.isFinite(base) && base >= 0 ? base : 100, ct: v.ct || {} };
  }
  const yOf = (C, i) => { const o = C.ct[i]; return o && Number(o[1]) > 0 ? Number(o[1]) : (YIELD0[i] || 0); };
  // العائد اليومي بلحظة t (ms) بحسب العدادات التي لم تنتهِ بعد
  const rate = (C, cl, t) => C.base + cl.reduce((s, c) => s + (Number(c.e) > t ? yOf(C, Number(c.i)) : 0), 0);

  function advance(st, C, cl, now) {
    let credited = 0;
    if (st.run && now > st.upd) {
      let n = Math.min((now - st.upd) / 1000, 40 * DAY), t = st.upd;
      while (n > 1e-9 && st.run) {
        const m = Math.min(n, st.left_s);
        // نقسّم المقطع عند أوقات انتهاء العدادات
        let a = t, rem = m;
        const cuts = cl.map((c) => Number(c.e)).filter((e) => e > a && e < a + m * 1000).sort((x, y) => x - y);
        for (const cut of cuts.concat([a + m * 1000])) {
          const dt = Math.max(0, (cut - a) / 1000); st.accr += rate(C, cl, a + 1) * dt / DAY; a = cut; rem -= dt;
        }
        n -= m; t += m * 1000; st.left_s -= m;
        if (st.left_s <= 1e-4) {
          const qn = Math.floor(st.accr); credited += qn; st.accr -= qn; st.left_s = DAY; st.run = false; st.ended = true;
        }
      }
    }
    st.upd = now;
    return credited;
  }
  const out = (st, credited, pts) => ({ ok: true, run: !!st.run, left: st.left_s, accr: st.accr, ended: !!st.ended, credited, pts, now: Date.now() });

  async function withState(req, mut) {
    const b = req.body || {}, e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const cl = await pool.connect(); let res;
    try {
      await cl.query('BEGIN');
      const a = (await cl.query(`SELECT email,pts,blk,demo,cl FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2 FOR UPDATE`, [e, h])).rows[0];
      if (!a) fail(401, 'غير مسجّل الدخول');
      if (a.blk) fail(403, 'الحساب موقوف');
      if (a.demo) fail(403, 'الحساب التجريبي يعمل محلياً');
      const C = await cfg(cl), now = Date.now();
      const list = (Array.isArray(a.cl) ? a.cl : []).filter((c) => c && Number(c.e) > now - 40 * DAY * 1000);
      let st = (await cl.query(`SELECT run,left_s,accr,ended,upd FROM ctr_cycle WHERE email=$1 FOR UPDATE`, [e])).rows[0];
      if (!st) {
        const sd = b.seed || {}, cap = rate(C, list, now);
        st = { run: sd.run === 0 || sd.run === false ? false : true, left_s: Math.max(1, Math.min(DAY, Number(sd.left) || DAY)), accr: Math.max(0, Math.min(cap, Number(sd.accr) || 0)), ended: !!sd.ended && !sd.run, upd: now };
        await cl.query(`INSERT INTO ctr_cycle(email,run,left_s,accr,ended,upd) VALUES($1,$2,$3,$4,$5,$6)`, [e, st.run, st.left_s, st.accr, st.ended, now]);
      } else { st.upd = Number(st.upd); st.left_s = Number(st.left_s); st.accr = Number(st.accr); }
      const credited = advance(st, C, list, now);
      if (mut) mut(st);
      await cl.query(`UPDATE ctr_cycle SET run=$2,left_s=$3,accr=$4,ended=$5,upd=$6,total_claimed=total_claimed+$7 WHERE email=$1`, [e, st.run, st.left_s, st.accr, st.ended, st.upd, credited]);
      let pts = Number(a.pts);
      if (credited > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, credited]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [e, credited]);
        pts += credited;
      }
      await cl.query('COMMIT');
      res = out(st, credited, pts); res.email = e;
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    if (res.credited > 0) { try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ } }
    delete res.email; return res;
  }

  app.post('/api/cycle/state', jsonBody, wrap(async (req, res) => res.json(await withState(req))));
  app.post('/api/cycle/claim', jsonBody, wrap(async (req, res) => res.json(await withState(req))));
  app.post('/api/cycle/toggle', jsonBody, wrap(async (req, res) => {
    const want = !!(req.body || {}).run;
    res.json(await withState(req, (st) => { if (want && !st.run) { st.run = true; st.ended = false; } else if (!want) { st.run = false; } }));
  }));
};

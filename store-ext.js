/**
 * store-ext.js — مخزون أكواد البطاقات/الأرصدة + الطلبات على السيرفر (المرحلة 12)
 *  POST /api/u/store/state        : (كل 5 ثوانٍ) أعداد المخزون + طلبات المستخدم (مع الأكواد المسلّمة)
 *  POST /api/u/store/buy          : شراء بطاقة. يوجد كود → يُسلَّم فوراً. لا يوجد → طلب معلّق «تم الطلب»
 *                                   ويُسلَّم الكود تلقائياً فور إضافة أكواد جديدة من لوحة التحكم.
 *  GET  /api/ctl/store/overview   : لوحة التحكم — المخزون والمعلّق والمباع
 *  POST /api/ctl/store/codes      : إضافة أكواد (تُسلَّم تلقائياً للطلبات المعلّقة بالترتيب)
 *  POST /api/ctl/store/reject     : رفض طلب معلّق (يُسترجع المبلغ للمستخدم تلقائياً)
 *  POST /api/ctl/store/clear      : حذف الأكواد غير المباعة لبطاقة
 * تعريف البطاقات (الاسم/السعر) يُقرأ من الإعدادات المنشورة (cards).
 */
const rateLimit = require('express-rate-limit');
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl } = deps;
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
  const lim = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false, validate: false });

  const ddl = [
    `CREATE TABLE IF NOT EXISTS store_codes(
       id BIGSERIAL PRIMARY KEY, card_id TEXT NOT NULL, code TEXT NOT NULL, sold BOOLEAN NOT NULL DEFAULT FALSE,
       order_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(card_id, code))`,
    `CREATE INDEX IF NOT EXISTS store_codes_free ON store_codes(card_id, id) WHERE NOT sold`,
    `CREATE TABLE IF NOT EXISTS store_orders(
       id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, name TEXT, card_id TEXT NOT NULL, card_name TEXT NOT NULL, card_type TEXT,
       price BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', code TEXT, why TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), done_at TIMESTAMPTZ)`,
    `ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS refunded BOOLEAN NOT NULL DEFAULT FALSE`,
    `CREATE INDEX IF NOT EXISTS store_orders_user ON store_orders(LOWER(email), id DESC)`,
    `CREATE INDEX IF NOT EXISTS store_orders_pend ON store_orders(card_id, id) WHERE status='pending'`,
  ];
  const ready = (async () => {
    for (let t = 0; t < 10; t++) {
      try { for (const s of ddl) await q(s); return; }
      catch (e) { if (t === 9) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('store-ext schema:', e.message));
  app.use(['/api/u/store', '/api/ctl/store'], (_req, _res, next) => ready.then(() => next(), next));

  async function who(b) {
    const e = txt(b && b.e, 200).toLowerCase(), h = txt(b && b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const r = await q(`SELECT email, name, blk FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2`, [e, h]);
    if (!r.rows[0]) fail(401, 'غير مسجّل الدخول');
    if (r.rows[0].blk) fail(403, 'الحساب موقوف');
    return { email: String(r.rows[0].email).toLowerCase(), name: r.rows[0].name || '' };
  }
  async function cards() {
    const r = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    return r && r.val && Array.isArray(r.val.cards) ? r.val.cards : [];
  }
  const pubOrder = (o) => ({
    id: Number(o.id), card_id: o.card_id, n: o.card_name, t: o.card_type, p: Number(o.price), status: o.status,
    code: o.status === 'done' ? o.code : null, why: o.why || '', at: new Date(o.created_at).getTime(),
    done: o.done_at ? new Date(o.done_at).getTime() : 0,
  });

  /* تسليم الطلبات المعلّقة لبطاقة من الأكواد الحرة (بالترتيب). يجب استدعاؤها داخل معاملة. */
  async function fulfill(cl, cardId) {
    let n = 0;
    for (;;) {
      const o = (await cl.query(`SELECT id FROM store_orders WHERE card_id=$1 AND status='pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`, [cardId])).rows[0];
      if (!o) break;
      const c = (await cl.query(`SELECT id, code FROM store_codes WHERE card_id=$1 AND NOT sold ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`, [cardId])).rows[0];
      if (!c) break;
      await cl.query(`UPDATE store_codes SET sold=TRUE, order_id=$2 WHERE id=$1`, [c.id, o.id]);
      await cl.query(`UPDATE store_orders SET status='done', code=$2, done_at=NOW() WHERE id=$1`, [o.id, c.code]);
      n++;
    }
    return n;
  }

  /* ---------------- للتطبيق ---------------- */
  app.post('/api/u/store/state', lim, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const u = await who(req.body);
    const stock = {};
    (await q(`SELECT card_id, COUNT(*)::int n FROM store_codes WHERE NOT sold GROUP BY card_id`)).rows.forEach((r) => { stock[r.card_id] = r.n; });
    // الطلبات المرفوضة: تُرجَع للمستخدم مرة واحدة فقط (يُسترجع مبلغها لرصيده)
    const refund = (await q(`UPDATE store_orders SET refunded=TRUE WHERE LOWER(email)=$1 AND status='rejected' AND NOT refunded RETURNING id, card_name, price`, [u.email]))
      .rows.map((r) => ({ id: Number(r.id), n: r.card_name, p: Number(r.price) }));
    const orders = (await q(`SELECT * FROM store_orders WHERE LOWER(email)=$1 ORDER BY id DESC LIMIT 150`, [u.email])).rows.map(pubOrder);
    res.json({ ok: true, stock, orders, refund, t: Date.now() });
  }));

  app.post('/api/u/store/buy', lim, wrap(async (req, res) => {
    const u = await who(req.body);
    const cardId = txt(req.body.cardId, 80);
    const card = (await cards()).find((c) => c && String(c.id) === cardId);
    if (!card) fail(404, 'البطاقة غير متاحة');
    const price = Math.floor(Number(card.p) || 0);
    if (!(price > 0)) fail(400, 'سعر البطاقة غير صالح');
    const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      await cl.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['store:' + cardId]);
      const o = (await cl.query(
        `INSERT INTO store_orders(email,name,card_id,card_name,card_type,price) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [u.email, u.name, cardId, txt(card.n, 120), txt(card.t, 12), price])).rows[0];
      await fulfill(cl, cardId); // الأقدم أولاً: قد يُسلَّم طلب معلّق سابق قبل هذا
      const fin = (await cl.query(`SELECT * FROM store_orders WHERE id=$1`, [o.id])).rows[0];
      await cl.query('COMMIT');
      res.json({ ok: true, order: pubOrder(fin) });
    } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e; }
    finally { cl.release(); }
  }));

  /* ---------------- لوحة التحكم ---------------- */
  app.get('/api/ctl/store/overview', ...ctl, wrap(async (_req, res) => {
    const free = {}, sold = {}, pend = {};
    (await q(`SELECT card_id, COUNT(*)::int n FROM store_codes WHERE NOT sold GROUP BY card_id`)).rows.forEach((r) => { free[r.card_id] = r.n; });
    (await q(`SELECT card_id, COUNT(*)::int n FROM store_codes WHERE sold GROUP BY card_id`)).rows.forEach((r) => { sold[r.card_id] = r.n; });
    (await q(`SELECT card_id, COUNT(*)::int n FROM store_orders WHERE status='pending' GROUP BY card_id`)).rows.forEach((r) => { pend[r.card_id] = r.n; });
    const pending = (await q(`SELECT * FROM store_orders WHERE status='pending' ORDER BY id LIMIT 200`)).rows
      .map((o) => ({ ...pubOrder(o), email: o.email, name: o.name }));
    const recent = (await q(`SELECT * FROM store_orders WHERE status<>'pending' ORDER BY id DESC LIMIT 60`)).rows
      .map((o) => ({ ...pubOrder(o), code: o.code, email: o.email, name: o.name }));
    // أكواد حرة لبطاقات غير موجودة في الإعدادات المنشورة: المستخدم يراها «حسب الطلب» ولا تُسلَّم له
    const pubIds = new Set((await cards()).map((c) => c && String(c.id)));
    const orphan = Object.keys(free).filter((k) => free[k] > 0 && !pubIds.has(k));
    res.json({ ok: true, free, sold, pend, pending, recent, orphan });
  }));

  /* نشر قائمة البطاقات فقط (دون مسّ بقية الإعدادات) ليتطابق ما يراه المستخدم مع معرّفات المخزون */
  app.post('/api/ctl/store/cards', ...ctl, wrap(async (req, res) => {
    const list = Array.isArray(req.body.cards) ? req.body.cards : null;
    if (!list) fail(400, 'قائمة البطاقات غير صالحة');
    const clean = list.slice(0, 300).filter((c) => c && c.id != null && c.n).map((c) => ({
      id: txt(c.id, 80), n: txt(c.n, 120), t: c.t === 'game' ? 'game' : 'bal',
      p: Math.max(0, Math.floor(Number(c.p) || 0)), d: txt(c.d, 500),
      img: typeof c.img === 'string' && c.img.length < 2500000 ? c.img : '',
    }));
    const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      const row = (await cl.query(`SELECT val FROM sync_kv WHERE key='config' FOR UPDATE`)).rows[0];
      const val = row && row.val && typeof row.val === 'object' && !Array.isArray(row.val) ? row.val : {};
      val.cards = clean;
      if (row) await cl.query(`UPDATE sync_kv SET val=$1, updated_at=NOW() WHERE key='config'`, [JSON.stringify(val)]);
      else await cl.query(`INSERT INTO sync_kv(key,val,updated_at) VALUES('config',$1,NOW())`, [JSON.stringify(val)]);
      await cl.query('COMMIT');
    } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e; }
    finally { cl.release(); }
    try { if (app.locals.broadcastCfg) app.locals.broadcastCfg(); } catch (e) {}
    res.json({ ok: true, n: clean.length });
  }));

  app.post('/api/ctl/store/codes', ...ctl, wrap(async (req, res) => {
    const cardId = txt(req.body.cardId, 80);
    if (!cardId) fail(400, 'حدّد البطاقة');
    const raw = Array.isArray(req.body.codes) ? req.body.codes : String(req.body.codes || '').split(/[\s,;،]+/);
    const codes = [...new Set(raw.map((c) => txt(c, 200)).filter(Boolean))].slice(0, 5000);
    if (!codes.length) fail(400, 'لا توجد أكواد');
    const cl = await pool.connect();
    try {
      await cl.query('BEGIN');
      await cl.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['store:' + cardId]);
      // الأكواد المكررة (موجودة في أي بطاقة) تُتجاهل
      const ex = new Set((await cl.query(`SELECT code FROM store_codes WHERE code = ANY($1::text[])`, [codes])).rows.map((r) => r.code));
      const fresh = codes.filter((c) => !ex.has(c));
      for (const c of fresh) await cl.query(`INSERT INTO store_codes(card_id,code) VALUES($1,$2) ON CONFLICT DO NOTHING`, [cardId, c]);
      const delivered = await fulfill(cl, cardId);
      const left = Number((await cl.query(`SELECT COUNT(*)::int n FROM store_codes WHERE card_id=$1 AND NOT sold`, [cardId])).rows[0].n);
      const waiting = Number((await cl.query(`SELECT COUNT(*)::int n FROM store_orders WHERE card_id=$1 AND status='pending'`, [cardId])).rows[0].n);
      await cl.query('COMMIT');
      res.json({ ok: true, added: fresh.length, dup: codes.length - fresh.length, delivered, free: left, waiting });
    } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e; }
    finally { cl.release(); }
  }));

  app.post('/api/ctl/store/reject', ...ctl, wrap(async (req, res) => {
    const id = Number(req.body.id) || 0;
    const r = await q(`UPDATE store_orders SET status='rejected', why=$2, done_at=NOW() WHERE id=$1 AND status='pending' RETURNING id`, [id, txt(req.body.why, 200)]);
    if (!r.rows[0]) fail(404, 'الطلب غير موجود أو تمت معالجته');
    res.json({ ok: true });
  }));

  app.post('/api/ctl/store/clear', ...ctl, wrap(async (req, res) => {
    const r = await q(`DELETE FROM store_codes WHERE card_id=$1 AND NOT sold`, [txt(req.body.cardId, 80)]);
    res.json({ ok: true, removed: r.rowCount });
  }));
};

// حد أكبر لرفع دفعات الأكواد الكبيرة (يجب أن يسبق المحلل العام 50kb)
module.exports.parsers = (app, express) => { app.use('/api/ctl/store', express.json({ limit: '8mb' })); };

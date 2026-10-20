/**
 * gifts-ext.js — نظام الهدايا بين المستخدمين (يُشترى من النقاط)
 *  GET  /api/gifts/list                 : الهدايا المفعّلة (للتطبيق)
 *  POST /api/gifts/send                 : إرسال هدية لمستخدم داخل الدردشة (يخصم من رصيد المرسل)
 *  GET  /api/ctl/gifts                  : لوحة التحكم — الهدايا + الإعدادات + الإحصاءات + آخر العمليات
 *  POST /api/ctl/gifts/save|delete|config  : لوحة التحكم (X-Admin-Key)
 * الأسعار والهدايا تُدار كلياً من لوحة التحكم ← قسم الهدايا.
 */
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// الهدايا الافتراضية: الستة المطلوبة + 10 ملصقات بأسعار متنوعة (تُزرع مرة واحدة فقط عند فراغ الجدول)
const SEED = [
  ['وردة', '🌹', 1000], ['قلب الحب', '❤️', 5000], ['تاج', '👑', 10000],
  ['أسد', '🦁', 500000], ['دب', '🧸', 100000], ['فراشة', '🦋', 10000],
  ['كعكة', '🎂', 2500], ['قهوة', '☕', 1500], ['شوكولاتة', '🍫', 3000], ['بالونات', '🎈', 2000],
  ['قوس قزح', '🌈', 7500], ['دلفين', '🐬', 20000], ['كأس البطولة', '🏆', 40000],
  ['خاتم', '💍', 75000], ['صاروخ', '🚀', 150000], ['ألماس', '💎', 250000],
];

module.exports = (app, express, deps) => {
  const { pool, wrap, ctl, fail } = deps;
  const q = (s, p) => pool.query(s, p);
  const jsonBody = express.json({ limit: '20kb' });

  const ddl = [
    `CREATE TABLE IF NOT EXISTS gift_catalog(
       id SERIAL PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL, price BIGINT NOT NULL DEFAULT 0,
       active BOOLEAN NOT NULL DEFAULT TRUE, sort INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS gift_log(
       id BIGSERIAL PRIMARY KEY, from_email TEXT NOT NULL, to_email TEXT NOT NULL, gift_id INT, name TEXT NOT NULL, emoji TEXT NOT NULL,
       price BIGINT NOT NULL, qty INT NOT NULL DEFAULT 1, total BIGINT NOT NULL, recv BIGINT NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS gift_log_idx ON gift_log(created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS gift_settings(k TEXT PRIMARY KEY, v JSONB NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS post_gifts(
       id BIGSERIAL PRIMARY KEY, news_id BIGINT NOT NULL, from_email TEXT NOT NULL, to_email TEXT NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL,
       price BIGINT NOT NULL, qty INT NOT NULL DEFAULT 1, total BIGINT NOT NULL, recv BIGINT NOT NULL DEFAULT 0, app_cut BIGINT NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS post_gifts_news ON post_gifts(news_id)`,
  ];
  const ready = (async () => {
    for (let t = 0; t < 10; t++) {
      try {
        for (const s of ddl) await q(s);
        const n = Number((await q(`SELECT COUNT(*)::int n FROM gift_catalog`)).rows[0].n);
        if (!n) for (let i = 0; i < SEED.length; i++) await q(`INSERT INTO gift_catalog(name,emoji,price,sort) VALUES($1,$2,$3,$4)`, [SEED[i][0], SEED[i][1], SEED[i][2], (i + 1) * 10]);
        return;
      } catch (e) { if (t === 9) throw e; await new Promise((r) => setTimeout(r, 1500)); }
    }
  })().catch((e) => console.error('gifts-ext schema:', e.message));
  app.use(['/api/gifts', '/api/ctl/gifts'], (_req, _res, next) => ready.then(() => next(), next));

  // الإعدادات: enabled = تفعيل النظام، pct = نسبة ما يستلمه المستلم من سعر الهدية كنقاط (0 = الهدية رمزية والنقاط تُستهلك)
  async function cfg() {
    const r = (await q(`SELECT v FROM gift_settings WHERE k='cfg'`)).rows[0];
    const v = (r && r.v) || {};
    return { enabled: v.enabled !== false, pct: Math.max(0, Math.min(100, Number(v.pct) || 0)), postPct: v.postPct == null ? 50 : Math.max(0, Math.min(100, Number(v.postPct) || 0)), maxQty: Math.max(1, Math.min(99, Number(v.maxQty) || 10)) };
  }

  /* ---------------- للتطبيق ---------------- */
  app.get('/api/gifts/list', wrap(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const c = await cfg();
    const rows = c.enabled ? (await q(`SELECT id,name,emoji,price::float8 AS price FROM gift_catalog WHERE active ORDER BY sort,id`)).rows : [];
    res.json({ ok: true, enabled: c.enabled, maxQty: c.maxQty, gifts: rows });
  }));

  app.post('/api/gifts/send', jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const c = await cfg();
    if (!c.enabled) fail(403, 'الهدايا متوقفة حالياً');
    const gid = parseInt(b.gift, 10), qty = Math.max(1, Math.min(c.maxQty, parseInt(b.qty, 10) || 1));
    if (!gid) fail(400, 'اختر هدية');

    const cl = await pool.connect();
    let out;
    try {
      await cl.query('BEGIN');
      const me = (await cl.query(`SELECT email,name,pts,blk,demo FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2 FOR UPDATE`, [e, h])).rows[0];
      if (!me) fail(401, 'غير مسجّل الدخول');
      if (me.blk) fail(403, 'الحساب موقوف');
      if (me.demo) fail(403, 'الحساب التجريبي لا يمكنه إرسال الهدايا');
      const to = (await cl.query(`SELECT email,name,blk,demo FROM sync_accounts WHERE uid=$1`, [txt(b.to, 64)])).rows[0];
      if (!to || to.blk || to.demo) fail(404, 'المستخدم غير متاح');
      const myEmail = String(me.email).toLowerCase(), toEmail = String(to.email).toLowerCase();
      if (myEmail === toEmail) fail(400, 'لا يمكنك إرسال هدية لنفسك');
      const g = (await cl.query(`SELECT id,name,emoji,price FROM gift_catalog WHERE id=$1 AND active`, [gid])).rows[0];
      if (!g) fail(404, 'هذه الهدية غير متاحة');

      const price = Number(g.price), total = price * qty;
      if (!(total > 0)) fail(400, 'سعر الهدية غير صالح');
      if (Number(me.pts) < total) fail(402, 'رصيد النقاط غير كافٍ');
      const recv = Math.floor(total * c.pct / 100);

      await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1`, [myEmail, total]);
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [myEmail, total]);
      if (recv > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [toEmail, recv]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [toEmail, recv]);
      }
      await cl.query(`INSERT INTO gift_log(from_email,to_email,gift_id,name,emoji,price,qty,total,recv) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [myEmail, toEmail, g.id, g.name, g.emoji, price, qty, total, recv]);

      // رسالة هدية داخل المحادثة (تُعرض كبطاقة هدية في الدردشة)
      const body = `[[GIFT|${g.emoji}|${g.name}|${price}|${qty}]]`;
      const ins = (await cl.query(`INSERT INTO soc_msgs(f,t,body) VALUES($1,$2,$3) RETURNING id,created_at`, [myEmail, toEmail, body])).rows[0];
      const myName = me.name || myEmail.split('@')[0];
      await cl.query(`INSERT INTO soc_notes(email,kind,title,body) VALUES($1,'dm',$2,$3)`,
        [toEmail, 'وصلتك هدية ' + g.emoji, myName + ' أرسل لك ' + g.name + (qty > 1 ? ' ×' + qty : '')]);

      // أوامر الرصيد: تصل لأجهزة الطرفين فوراً (نفس آلية تعديلات الإدارة) فيتحدّث الرصيد المحلي
      const cmds = [{ t: 'adj', e: myEmail, d: { pts: -total }, gf: { r: 'هدية مُرسلة', x: g.name + (qty > 1 ? ' ×' + qty : '') + ' ← ' + (to.name || toEmail.split('@')[0]) } }];
      if (recv > 0) cmds.push({ t: 'adj', e: toEmail, d: { pts: recv }, gf: { r: 'هدية مُستلمة', x: g.name + (qty > 1 ? ' ×' + qty : '') + ' من ' + myName } });
      const ids = [];
      for (const cm of cmds) ids.push((await cl.query('INSERT INTO sync_cmds(body) VALUES($1) RETURNING id', [JSON.stringify(cm)])).rows[0].id);
      await cl.query('COMMIT');
      out = { ok: true, bal: Number(me.pts) - total, msg: { id: Number(ins.id), mine: true, x: body, t: new Date(ins.created_at).getTime() }, cmds, ids };
    } catch (err) {
      try { await cl.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally { cl.release(); }

    if (app.locals.broadcastCmd) out.ids.forEach((id, i) => { try { app.locals.broadcastCmd(id, out.cmds[i]); } catch (_) {} });
    res.json({ ok: true, bal: out.bal, msg: out.msg });
  }));

  /* هدية على منشور (خبر): الناشر يستلم postPct٪ (الافتراضي 50) والباقي لصاحب التطبيق — الخصم والإضافة على السيرفر وبمعاملة واحدة */
  app.post('/api/gifts/post', jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    if (!e || !h) fail(401, 'غير مسجّل الدخول');
    const c = await cfg();
    if (!c.enabled) fail(403, 'الهدايا متوقفة حالياً');
    const gid = parseInt(b.gift, 10), nid = parseInt(b.id, 10), qty = Math.max(1, Math.min(c.maxQty, parseInt(b.qty, 10) || 1));
    if (!gid || !nid) fail(400, 'اختر هدية');
    const cl = await pool.connect();
    let out;
    try {
      await cl.query('BEGIN');
      const me = (await cl.query(`SELECT email,name,pts,blk,demo FROM sync_accounts WHERE LOWER(email)=$1 AND pass_hash=$2 FOR UPDATE`, [e, h])).rows[0];
      if (!me) fail(401, 'غير مسجّل الدخول');
      if (me.blk) fail(403, 'الحساب موقوف');
      if (me.demo) fail(403, 'الحساب التجريبي لا يمكنه إرسال الهدايا');
      const nw = (await cl.query(`SELECT id,email,title FROM user_news WHERE id=$1`, [nid])).rows[0];
      if (!nw) fail(404, 'المنشور غير موجود');
      const myEmail = String(me.email).toLowerCase(), toEmail = String(nw.email).toLowerCase();
      if (myEmail === toEmail) fail(400, 'لا يمكنك إرسال هدية لمنشورك');
      const pub = (await cl.query(`SELECT email,blk,demo FROM sync_accounts WHERE LOWER(email)=$1`, [toEmail])).rows[0];
      if (!pub || pub.blk || pub.demo) fail(404, 'الناشر غير متاح');
      const g = (await cl.query(`SELECT id,name,emoji,price FROM gift_catalog WHERE id=$1 AND active`, [gid])).rows[0];
      if (!g) fail(404, 'هذه الهدية غير متاحة');
      const price = Number(g.price), total = price * qty;
      if (!(total > 0)) fail(400, 'سعر الهدية غير صالح');
      if (Number(me.pts) < total) fail(402, 'رصيد النقاط غير كافٍ');
      const recv = Math.floor(total * c.postPct / 100), appCut = total - recv;
      await cl.query(`UPDATE sync_accounts SET pts=pts-$2 WHERE LOWER(email)=$1`, [myEmail, total]);
      await cl.query(`UPDATE users SET pts=GREATEST(0, pts-$2) WHERE LOWER(email)=$1`, [myEmail, total]);
      if (recv > 0) {
        await cl.query(`UPDATE sync_accounts SET pts=pts+$2 WHERE LOWER(email)=$1`, [toEmail, recv]);
        await cl.query(`UPDATE users SET pts=pts+$2 WHERE LOWER(email)=$1`, [toEmail, recv]);
      }
      await cl.query(`INSERT INTO post_gifts(news_id,from_email,to_email,name,emoji,price,qty,total,recv,app_cut) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [nid, myEmail, toEmail, g.name, g.emoji, price, qty, total, recv, appCut]);
      if (appCut > 0 && app.locals.revenue) await app.locals.revenue(cl, 'post_gift', appCut, 'news:' + nid, g.name + ' ×' + qty);
      await cl.query('COMMIT');
      out = { bal: Number(me.pts) - total, myName: me.name || myEmail.split('@')[0], g, qty, recv, toEmail, title: nw.title };
    } catch (err) { try { await cl.query('ROLLBACK'); } catch (_) {} throw err; } finally { cl.release(); }
    try { if (app.locals.liveBalKick) app.locals.liveBalKick(); } catch (_) { /* اختياري */ }
    try { if (app.locals.notify) app.locals.notify(out.toEmail, 'وصلتك هدية ' + out.g.emoji + ' على منشورك', out.myName + ' أهداك ' + out.g.name + (out.qty > 1 ? ' ×' + out.qty : '') + (out.recv ? ' — أُضيف ' + out.recv.toLocaleString('en') + ' نقطة لرصيدك' : ''), 'gift'); } catch (_) { /* اختياري */ }
    const cnt = (await q(`SELECT COALESCE(SUM(qty),0)::int n FROM post_gifts WHERE news_id=$1`, [nid])).rows[0].n;
    try { if (app.locals.broadcastStore) app.locals.broadcastStore({ k: 'news', id: nid }); } catch (_) { /* اختياري */ }
    res.json({ ok: true, bal: out.bal, gifts: cnt, recv: out.recv });
  }));

  /* ---------------- لوحة التحكم ---------------- */
  app.get('/api/ctl/gifts', ...ctl, wrap(async (_req, res) => {
    const gifts = (await q(`SELECT id,name,emoji,price::float8 AS price,active,sort FROM gift_catalog ORDER BY sort,id`)).rows;
    const st = (await q(`SELECT COUNT(*)::int n, COALESCE(SUM(qty),0)::int qty, COALESCE(SUM(total),0)::float8 pts, COALESCE(SUM(recv),0)::float8 recv FROM gift_log`)).rows[0];
    const top = (await q(`SELECT name,emoji,SUM(qty)::int qty,SUM(total)::float8 pts FROM gift_log GROUP BY name,emoji ORDER BY pts DESC LIMIT 5`)).rows;
    const log = (await q(`SELECT id,from_email,to_email,name,emoji,qty,total::float8 AS total,created_at FROM gift_log ORDER BY id DESC LIMIT 40`)).rows;
    res.json({ ok: true, cfg: await cfg(), gifts, stats: st, top, log });
  }));

  app.post('/api/ctl/gifts/save', ...ctl, jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const name = txt(b.name, 40).replace(/[|\[\]]/g, ' ').trim(), emoji = txt(b.emoji, 16), price = Math.floor(Number(b.price));
    if (!name) fail(400, 'اكتب اسم الهدية');
    if (!emoji) fail(400, 'اكتب رمز الهدية (إيموجي)');
    if (!Number.isFinite(price) || price < 1 || price > 1e12) fail(400, 'السعر غير صحيح');
    const active = b.active !== false && b.active !== 0, sort = Math.max(0, Math.min(100000, parseInt(b.sort, 10) || 0));
    const id = parseInt(b.id, 10);
    if (id) {
      const r = await q(`UPDATE gift_catalog SET name=$2,emoji=$3,price=$4,active=$5,sort=$6 WHERE id=$1`, [id, name, emoji, price, active, sort]);
      if (!r.rowCount) fail(404, 'الهدية غير موجودة');
      return res.json({ ok: true, id });
    }
    const mx = Number((await q(`SELECT COALESCE(MAX(sort),0) m FROM gift_catalog`)).rows[0].m);
    const r = await q(`INSERT INTO gift_catalog(name,emoji,price,active,sort) VALUES($1,$2,$3,$4,$5) RETURNING id`, [name, emoji, price, active, sort || mx + 10]);
    res.json({ ok: true, id: r.rows[0].id });
  }));

  app.post('/api/ctl/gifts/delete', ...ctl, jsonBody, wrap(async (req, res) => {
    const id = parseInt((req.body || {}).id, 10);
    if (!id) fail(400, 'هدية غير صحيحة');
    await q(`DELETE FROM gift_catalog WHERE id=$1`, [id]);
    res.json({ ok: true });
  }));

  app.post('/api/ctl/gifts/config', ...ctl, jsonBody, wrap(async (req, res) => {
    const b = req.body || {};
    const v = { enabled: !!b.enabled, pct: Math.max(0, Math.min(100, Number(b.pct) || 0)), postPct: b.postPct == null || b.postPct === '' ? 50 : Math.max(0, Math.min(100, Number(b.postPct) || 0)), maxQty: Math.max(1, Math.min(99, parseInt(b.maxQty, 10) || 10)) };
    await q(`INSERT INTO gift_settings(k,v) VALUES('cfg',$1) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [JSON.stringify(v)]);
    res.json({ ok: true, cfg: v });
  }));
};

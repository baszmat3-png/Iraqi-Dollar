/**
 * notes-ext.js — إشعارات التطبيق (من السيرفر إلى المستخدم)
 *  app.locals.notify(email, title, body, kind)  → يُحفظ ويُبثّ لحظياً (SSE: حدث store بنوع k='unote') لأجهزة صاحب الحساب
 *  POST /api/u/notes/pull {e,h,after}           → يسحب ما فات أثناء عدم الاتصال (after=null: يعيد آخر رقم فقط بلا إغراق)
 */
module.exports = (app, express, deps) => {
  const { pool, wrap, fail } = deps;
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const ready = pool.query(`CREATE TABLE IF NOT EXISTS app_notes(
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'sys', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    .then(() => pool.query(`CREATE INDEX IF NOT EXISTS app_notes_idx ON app_notes(email, id)`))
    .catch((e) => console.error('app_notes:', e.message));
  setInterval(() => { pool.query(`DELETE FROM app_notes WHERE created_at < NOW() - INTERVAL '14 days'`).catch(() => {}); }, 6 * 3600 * 1000).unref();

  app.locals.notify = async (email, title, body, kind) => {
    try {
      const e = String(email || '').trim().toLowerCase(); if (!e || !title) return;
      await ready;
      const r = (await pool.query(`INSERT INTO app_notes(email,kind,title,body) VALUES($1,$2,$3,$4) RETURNING id`,
        [e, txt(kind, 16) || 'sys', txt(title, 120), txt(body, 400)])).rows[0];
      if (app.locals.broadcastStore) app.locals.broadcastStore({ k: 'unote', id: Number(r.id), kind: txt(kind, 16) || 'sys', title: txt(title, 120), body: txt(body, 400) }, e);
    } catch (e) { /* الإشعار اختياري ولا يكسر العملية */ }
  };

  app.post('/api/u/notes/pull', express.json({ limit: '4kb' }), wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const b = req.body || {};
    const e = txt(b.e, 200).toLowerCase(), h = txt(b.h, 200);
    const au = app.locals.authEmail; const ok = au && e && h ? await au(e, h) : '';
    if (!ok || ok !== e) fail(401, 'غير مسجّل الدخول');
    await ready;
    const max = Number((await pool.query(`SELECT COALESCE(MAX(id),0) m FROM app_notes WHERE email=$1`, [e])).rows[0].m);
    if (b.after == null) return res.json({ ok: true, max, notes: [] });
    const after = Math.max(0, parseInt(b.after, 10) || 0);
    const rows = (await pool.query(`SELECT id,kind,title,body FROM app_notes WHERE email=$1 AND id>$2 ORDER BY id LIMIT 40`, [e, after])).rows;
    res.json({ ok: true, max, notes: rows.map((r) => ({ id: Number(r.id), kind: r.kind, title: r.title, body: r.body })) });
  }));
};

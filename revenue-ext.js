/**
 * revenue-ext.js — إيرادات التطبيق (حصة صاحب التطبيق من الهدايا ورسوم عرض العدادات وغيرها)
 *  app.locals.revenue(client, kind, pts, ref, note)  يُسجَّل داخل نفس المعاملة (نقاط تُخصم من المستخدمين وتبقى للتطبيق)
 *  GET /api/ctl/revenue  ملخص + آخر العمليات (لوحة التحكم)
 */
module.exports = (app, express, deps) => {
  const { pool, wrap, ctl } = deps;
  const ready = pool.query(`CREATE TABLE IF NOT EXISTS app_revenue(
      id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, pts BIGINT NOT NULL, ref TEXT, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    .catch((e) => console.error('app_revenue:', e.message));
  app.locals.revenue = async (c, kind, pts, ref, note) => {
    pts = Math.floor(Number(pts) || 0); if (pts <= 0) return;
    await ready;
    await (c || pool).query(`INSERT INTO app_revenue(kind,pts,ref,note) VALUES($1,$2,$3,$4)`, [String(kind).slice(0, 30), pts, ref == null ? null : String(ref).slice(0, 60), note ? String(note).slice(0, 200) : null]);
  };
  app.get('/api/ctl/revenue', ...ctl, wrap(async (_req, res) => {
    await ready;
    const by = (await pool.query(`SELECT kind, COUNT(*)::int n, COALESCE(SUM(pts),0)::float8 pts FROM app_revenue GROUP BY kind ORDER BY pts DESC`)).rows;
    const day = (await pool.query(`SELECT COALESCE(SUM(pts),0)::float8 pts FROM app_revenue WHERE created_at > NOW() - INTERVAL '24 hours'`)).rows[0].pts;
    const total = by.reduce((t, x) => t + x.pts, 0);
    const log = (await pool.query(`SELECT id,kind,pts::float8 pts,ref,note,created_at FROM app_revenue ORDER BY id DESC LIMIT 50`)).rows;
    res.json({ ok: true, total, day, by, log });
  }));
};

/* المرحلة 14 — الحسابات المستثناة من العمليات المالية والأرباح + ترتيب الأعلى مالياً
   الاستثناء محاسبي فقط: يبقى الحساب يعمل بشكل عادي، لكن حركاته وأرصدته لا تدخل في الإحصائيات والأرباح. */
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

let _pool = null, _set = new Set(), _t = 0;
async function reload() {
  if (!_pool) return _set;
  try {
    const r = await _pool.query('SELECT LOWER(email) e FROM fin_excl');
    _set = new Set(r.rows.map((x) => x.e)); _t = Date.now();
  } catch (e) { /* الجدول لم يُنشأ بعد */ }
  return _set;
}
const api = {
  init(pool) {
    if (_pool) return;
    _pool = pool;
    pool.query(`CREATE TABLE IF NOT EXISTS fin_excl(email TEXT PRIMARY KEY, note TEXT, added_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
      .then(reload).catch((e) => console.error('excl migrate', e));
    setInterval(reload, 30000).unref();
  },
  set: () => _set,                                  // Set بالبريد الصغير (متزامن، من الذاكرة)
  has: (e) => _set.has(String(e || '').trim().toLowerCase()),
  list: () => [..._set],                            // مصفوفة للاستعلامات: <> ALL($n::text[])
  reload,
  routes(app, { pool, wrap, ctl, GAME }) {
    const q = (s, p) => pool.query(s, p);
    const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };
    api.init(pool);

    async function rates() {
      const r = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
      const c = (r && r.val && r.val.cfg) || {};
      const pr = (num(c.agRate) > 0 ? num(c.agRate) : 132) / 1000;       // دينار لكل نقطة
      const gr = num(GAME && GAME.cfg ? GAME.cfg().gemRate : 0) || num(c.gemRate, 100) || 100; // نقاط لكل جوهرة
      const iqd = num(c.iqd) > 0 ? num(c.iqd) : 1620;                    // دينار لكل دولار
      return { pr, gr, iqd };
    }
    const wealth = (x, R) => {
      const iqd = num(x.pts) * R.pr + num(x.gems) * R.gr * R.pr + num(x.usd) * R.iqd;
      return { ...x, pts: num(x.pts), gems: num(x.gems), usd: num(x.usd), iqd: Math.round(iqd), usdEq: Math.round(iqd / R.iqd * 100) / 100 };
    };

    // القائمة + الحسابات المستثناة بتفاصيلها
    app.get('/api/ctl/excl', ...ctl, wrap(async (_req, res) => {
      await reload();
      const R = await rates();
      const rows = (await q(
        `SELECT x.email, x.note, x.added_by, x.created_at, a.name, a.phone, a.rcode, a.pts, a.gems, a.usd, a.blk
           FROM fin_excl x LEFT JOIN sync_accounts a ON LOWER(a.email)=LOWER(x.email) ORDER BY x.created_at DESC`)).rows;
      res.json({ ok: true, list: rows.map((r) => wealth(r, R)), emails: api.list() });
    }));

    // إضافة: بالبريد أو رمز الإحالة أو الهاتف
    app.post('/api/ctl/excl/add', ...ctl, wrap(async (req, res) => {
      const t = txt(req.body.q || req.body.email, 200);
      if (!t) fail(400, 'أدخل البريد أو الرمز');
      let a = (await q(`SELECT email,name FROM sync_accounts WHERE LOWER(email)=LOWER($1) OR phone=$1 OR UPPER(rcode)=UPPER($1) LIMIT 1`, [t])).rows[0];
      const email = (a ? a.email : t).toLowerCase();
      if (!a && !/^[^\s@]+@[^\s@]+$/.test(email)) fail(404, 'لا يوجد حساب بهذا البريد أو الرمز');
      await q(`INSERT INTO fin_excl(email,note,added_by) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET note=$2`,
        [email, txt(req.body.note, 200), txt(req.body.by, 60)]);
      await reload();
      res.json({ ok: true, email, name: a ? a.name : '' });
    }));

    app.post('/api/ctl/excl/del', ...ctl, wrap(async (req, res) => {
      await q('DELETE FROM fin_excl WHERE LOWER(email)=LOWER($1)', [txt(req.body.email, 200)]);
      await reload();
      res.json({ ok: true });
    }));

    // الأعلى مالياً (مجموع النقاط + الجواهر + الدولار بقيمة الدينار). المستثنون يُخفون ما لم يُطلب إظهارهم.
    app.get('/api/ctl/excl/top', ...ctl, wrap(async (req, res) => {
      await reload();
      const R = await rates(), lim = Math.min(100, Math.max(5, Math.floor(num(req.query.limit, 20)))), inc = req.query.all === '1';
      const rows = (await q(
        `SELECT email,name,pts,gems,usd,blk FROM sync_accounts WHERE demo=FALSE
           AND ($2::boolean OR NOT (LOWER(email)=ANY($1::text[])))`, [api.list(), inc])).rows;
      const ex = _set;
      const out = rows.map((r) => ({ ...wealth(r, R), excl: ex.has(String(r.email).toLowerCase()) }))
        .sort((a, b) => b.iqd - a.iqd).slice(0, lim);
      const tot = rows.reduce((t, r) => t + wealth(r, R).iqd, 0);
      res.json({ ok: true, top: out, total_iqd: tot, n: rows.length, rates: R, at: Date.now() });
    }));
  },
};
module.exports = api;

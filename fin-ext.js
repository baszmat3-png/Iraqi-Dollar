/* المرحلة 1ج — المالية: الأرباح + الالتزامات + سجل العمليات + أسعار الشراء والبيع */
const CATS = {
  counters: 'شراء عدادات', agency: 'رسوم وكالة', trade: 'رسوم تجارة', orders: 'دفعات طلبات المتجر', store: 'بطاقات وألعاب',
  yields: 'عوائد العدادات للمستخدمين', ref: 'عمولات إحالة', game_comm: 'عمولة الألعاب', wheel_in: 'دخل العجلة', wheel_prizes: 'جوائز العجلة', debt: 'تسديد استدانة',
};
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

exports.routes = (app, { pool, wrap, ctl, SYNC, GAME }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };

  q(`CREATE TABLE IF NOT EXISTS fin_costs(name TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'product', buy NUMERIC(16,2) NOT NULL DEFAULT 0, sell NUMERIC(16,2) NOT NULL DEFAULT 0)`)
    .catch((e) => console.error('fin-ext migrate', e));

  const DEF = { reset_ts: 0, resets: [], app_email: '', hide_app: false, months: 10, debt_pct: 5, open_bal: 0, open_src: '' };
  async function settings() {
    const r = (await q(`SELECT val FROM sync_kv WHERE key='fin_settings'`)).rows[0];
    return { ...DEF, ...(r ? r.val : {}) };
  }
  const saveSettings = (s) => q(`INSERT INTO sync_kv(key,val,updated_at) VALUES('fin_settings',$1,NOW()) ON CONFLICT(key) DO UPDATE SET val=$1,updated_at=NOW()`, [JSON.stringify(s)]);
  async function ptRate() { // دينار لكل نقطة
    const r = (await q(`SELECT val FROM sync_kv WHERE key='config'`)).rows[0];
    const c = (r && r.val && r.val.cfg) || {};
    return (num(c.agRate) > 0 ? num(c.agRate) : 300) / 1000;
  }

  async function compute() {
    const S = await settings(), pr = await ptRate(), since = new Date(S.reset_ts || 0);
    const app = S.hide_app && S.app_email ? S.app_email.toLowerCase() : '';
    const ev = (await q(
      `SELECT kind,cat,src,SUM(iqd)::float8 iqd,COUNT(*)::int n FROM fin_ev WHERE ts>=$1 AND ($2='' OR LOWER(COALESCE(email,''))<>$2) GROUP BY 1,2,3`, [since, app])).rows;
    const sum = (kind, cat) => ev.filter((r) => r.kind === kind && r.cat === cat && r.src !== 'manual').reduce((t, r) => t + r.iqd, 0);
    const cost = {}; (await q(`SELECT name,kind,buy::float8 buy,sell::float8 sell FROM fin_costs`)).rows.forEach((c) => (cost[c.name] = c));

    // مبيعات المنتجات من الطلبات المحفوظة على السيرفر
    const items = {};
    const add = (name, kind, units, rev) => {
      const c = cost[name], it = items[name] || (items[name] = { name, kind, units: 0, revenue: 0, profit: 0, missing: !(c && c.buy > 0 && c.sell > 0) });
      it.units += units; it.revenue += rev;
      if (!it.missing) it.profit = it.units * (c.sell - c.buy);
    };
    const ords = SYNC ? Object.values(SYNC.ords()) : [];
    ords.forEach((o) => {
      if (!o || o.rej || !Array.isArray(o.items) || (o.at || 0) < since.getTime()) return;
      if (app && String(o.u || '').toLowerCase() === app) return;
      const per = (num(o.t) * pr) / (o.items.length || 1);
      o.items.forEach((n) => add(String(n).slice(0, 80), 'product', 1, cost[n] && cost[n].sell > 0 ? cost[n].sell : per));
    });
    // بطاقات وألعاب مشتراة من المتجر
    (await q(`SELECT note,COUNT(*)::int n,SUM(iqd)::float8 iqd FROM fin_ev WHERE ts>=$1 AND cat='store' AND kind='in' AND ($2='' OR LOWER(COALESCE(email,''))<>$2) GROUP BY 1`, [since, app]))
      .rows.forEach((r) => { const name = String(r.note || '').replace(/^تم شراء\s*/, '').slice(0, 80) || 'بطاقة'; add(name, 'card', r.n, r.iqd); });

    let wheelNet = 0;
    if (GAME) {
      const gr = num(GAME.cfg().gemRate, 100), sd = since.toISOString().slice(0, 10);
      Object.entries(GAME.daily()).forEach(([d, b]) => { if (d >= sd) wheelNet += (b.w.gems * gr - (b.w.pts + b.w.gout * gr)) * pr; });
    }
    const list = Object.values(items).sort((a, b) => b.units - a.units);
    const prodProfit = list.reduce((t, i) => t + i.profit, 0), prodRev = list.reduce((t, i) => t + i.revenue, 0);
    const parts = [
      ['ربح بيع المنتجات والبطاقات', prodProfit],
      ['رسوم الوكالات', sum('in', 'agency')],
      ['رسوم التجارة', sum('in', 'trade')],
      ['ربح الاستدانة', sum('in', 'debt') * S.debt_pct / 100],
      ['عمولة الألعاب', sum('in', 'game_comm')],
      ['صافي العجلة', wheelNet],
    ].map(([label, iqd]) => ({ label, iqd: Math.round(iqd) }));
    const profit = parts.reduce((t, p) => t + p.iqd, 0);

    const manual = ev.filter((r) => r.src === 'manual');
    const mIn = manual.filter((r) => r.kind === 'in').reduce((t, r) => t + r.iqd, 0), mOut = manual.filter((r) => r.kind === 'out').reduce((t, r) => t + r.iqd, 0);
    const cIn = sum('in', 'counters'), yOut = sum('out', 'yields');
    const owner = S.open_bal + profit + mIn - mOut;
    const sources = [{ label: S.open_src || 'رصيد افتتاحي', iqd: Math.round(S.open_bal) }, ...parts.filter((p) => p.iqd), ...(mIn ? [{ label: 'إيرادات يدوية', iqd: Math.round(mIn) }] : []), ...(mOut ? [{ label: 'مصروفات يدوية', iqd: -Math.round(mOut) }] : [])];

    const u = (await q(`SELECT COUNT(*)::int n,COALESCE(SUM(pts),0)::float8 pts,COALESCE(SUM(gems),0)::float8 gems,COALESCE(SUM(usd),0)::float8 usd FROM sync_accounts WHERE $1='' OR LOWER(email)<>$1`, [app])).rows[0];
    return {
      settings: S, since: S.reset_ts || null, profit, parts, owner: { balance: Math.round(owner), sources },
      sales: { units: list.reduce((t, i) => t + i.units, 0), revenue: Math.round(prodRev), margin: prodRev ? Math.round(prodProfit / prodRev * 1000) / 10 : 0 },
      top: list.slice(0, 15).map((i) => ({ ...i, revenue: Math.round(i.revenue), profit: Math.round(i.profit) })),
      liability: { received: Math.round(cIn), paid: Math.round(yOut), outstanding: Math.round(Math.max(0, cIn - yOut)), months: S.months, monthly: Math.round(cIn / Math.max(1, S.months)) },
      users: { n: u.n, pts: u.pts, gems: u.gems, usd: u.usd }, hidden: !!app,
    };
  }

  app.get('/api/ctl/fin2/summary', ...ctl, wrap(async (_req, res) => res.json(await compute())));

  app.post('/api/ctl/fin2/settings', ...ctl, wrap(async (req, res) => {
    const b = req.body || {}, S = await settings();
    if ('app_email' in b) S.app_email = txt(b.app_email, 200).toLowerCase();
    if ('hide_app' in b) S.hide_app = !!b.hide_app;
    if ('months' in b) S.months = Math.min(120, Math.max(1, Math.floor(num(b.months, 10))));
    if ('debt_pct' in b) S.debt_pct = Math.min(100, Math.max(0, num(b.debt_pct, 5)));
    if ('open_bal' in b) S.open_bal = Math.max(-1e13, Math.min(1e13, num(b.open_bal)));
    if ('open_src' in b) S.open_src = txt(b.open_src, 100);
    await saveSettings(S); res.json({ ok: true });
  }));

  // إعادة تعيين الإحصائيات: يبدأ الحساب من الآن، والسجل القديم يبقى محفوظاً
  app.post('/api/ctl/fin2/reset', ...ctl, wrap(async (req, res) => {
    if (req.body.confirm !== true) fail(400, 'يلزم التأكيد');
    const S = await settings(), snap = await compute();
    S.resets = [{ at: Date.now(), profit: snap.profit, owner: snap.owner.balance }, ...S.resets].slice(0, 20);
    S.reset_ts = Date.now(); await saveSettings(S); res.json({ ok: true });
  }));

  app.get('/api/ctl/fin2/costs', ...ctl, wrap(async (_req, res) => {
    const names = new Set();
    (SYNC ? Object.values(SYNC.ords()) : []).forEach((o) => (o.items || []).forEach((n) => names.add(String(n).slice(0, 80))));
    const c = (await q(`SELECT name,kind,buy::float8 buy,sell::float8 sell FROM fin_costs`)).rows;
    c.forEach((x) => names.delete(x.name));
    res.json({ items: [...c, ...[...names].map((name) => ({ name, kind: 'product', buy: 0, sell: 0 }))] });
  }));

  app.post('/api/ctl/fin2/costs', ...ctl, wrap(async (req, res) => {
    const name = txt(req.body.name, 80), kind = req.body.kind === 'card' ? 'card' : 'product', buy = num(req.body.buy), sell = num(req.body.sell);
    if (!name || buy < 0 || sell < 0 || buy > 1e13 || sell > 1e13) fail(400, 'بيانات غير صحيحة');
    await q(`INSERT INTO fin_costs(name,kind,buy,sell) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET kind=$2,buy=$3,sell=$4`, [name, kind, buy, sell]);
    res.json({ ok: true });
  }));

  // سجل العمليات: كل الحركات مع المصدر والوجهة (لا يتأثر بإعادة التعيين)
  app.get('/api/ctl/fin2/ledger', ...ctl, wrap(async (req, res) => {
    const S = await settings(), kind = ['in', 'out'].includes(req.query.kind) ? req.query.kind : '', cat = txt(req.query.cat, 40), s = txt(req.query.q, 80).replace(/[%_]/g, '');
    const lim = Math.min(500, Math.max(10, Math.floor(num(req.query.limit, 200)))), off = Math.max(0, Math.floor(num(req.query.offset, 0)));
    const w = `($1='' OR kind=$1) AND ($2='' OR cat=$2) AND ($3='' OR COALESCE(email,'') ILIKE '%'||$3||'%' OR COALESCE(note,'') ILIKE '%'||$3||'%')`;
    const rows = (await q(`SELECT uid,ts,email,kind,cat,pts::float8 pts,iqd::float8 iqd,note,src FROM fin_ev WHERE ${w} ORDER BY ts DESC LIMIT $4 OFFSET $5`, [kind, cat, s, lim, off])).rows;
    const t = (await q(`SELECT kind,SUM(iqd)::float8 iqd,COUNT(*)::int n FROM fin_ev WHERE ${w} GROUP BY kind`, [kind, cat, s])).rows;
    const app = S.app_email.toLowerCase();
    res.json({
      rows: rows.map((r) => ({
        ...r, cat_label: CATS[r.cat] || r.cat,
        from: r.kind === 'in' ? (r.email || (r.src === 'manual' ? 'إدخال يدوي' : '—')) : 'المنصة',
        to: r.kind === 'in' ? 'المنصة' : (r.email || (CATS[r.cat] || r.cat)),
        app: !!(app && r.email && r.email.toLowerCase() === app), pre_reset: new Date(r.ts).getTime() < (S.reset_ts || 0),
      })),
      totals: { in: (t.find((x) => x.kind === 'in') || {}).iqd || 0, out: (t.find((x) => x.kind === 'out') || {}).iqd || 0 },
      cats: CATS,
    });
  }));
};

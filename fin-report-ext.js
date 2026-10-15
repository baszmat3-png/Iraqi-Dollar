/* المالية — التقارير: الوارد والأرباح والمصاريف + المطلوب دفعه (السنة / الشهر الحالي / القادم)
   + أقساط إرجاع مبالغ العدادات + عائد الاستثمار الخارجي + التزامات مجدولة + تصدير CSV */
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const R = (x) => Math.round(x);

/* ---------- أدوات الأشهر (بتوقيت بغداد UTC+3) ---------- */
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;            // m: 1..12
const nowYm = (t = Date.now()) => { const d = new Date(t + 3 * 3600e3); return ym(d.getUTCFullYear(), d.getUTCMonth() + 1); };
const addM = (k, n) => { const [y, m] = k.split('-').map(Number), i = y * 12 + (m - 1) + n; return ym(Math.floor(i / 12), (i % 12) + 1); };
const idx = (k) => { const [y, m] = k.split('-').map(Number); return y * 12 + m - 1; };
const daysIn = (k) => { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const MN = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const label = (k) => `${MN[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;

/* ---------- عائد الاستثمار الخارجي ----------
   inv: { amount, rate_pct (سنوي), start (YYYY-MM-DD), term_months (0 = مفتوح), mode: 'simple'|'compound' }
   يعيد { 'YYYY-MM': عائد الشهر المستحق } حتى نهاية الشهر upTo.
   simple: عائد يومي على أصل المبلغ.  compound: يُضاف عائد كل شهر كامل إلى الأساس (الشهر الجزئي الأول بالتناسب). */
function investAccrual(inv, upTo) {
  const out = {}, a = num(inv.amount), r = num(inv.rate_pct) / 100;
  if (!(a > 0) || !(r > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(inv.start))) return out;
  const sd = Number(inv.start.slice(8, 10)), s = inv.start.slice(0, 7);
  const term = Math.max(0, Math.floor(num(inv.term_months)));
  let base = a;
  const last = term ? Math.min(idx(upTo), idx(s) + term) : idx(upTo);
  for (let i = idx(s); i <= last; i++) {
    const k = addM(s, i - idx(s)), dm = daysIn(k);
    let frac = 1;
    if (i === idx(s)) frac = (dm - sd + 1) / dm;                           // الشهر الأول جزئي
    if (term && i === idx(s) + term) frac = i === idx(s) ? 0 : (sd - 1) / dm; // آخر شهر جزئي ينتهي في يوم البداية
    if (frac <= 0) continue;
    const y = inv.mode === 'compound' ? base * (r / 12) * frac : a * (r / 12) * frac;
    out[k] = (out[k] || 0) + y;
    if (inv.mode === 'compound') base += y;
  }
  return out;
}

/* ---------- المطلوب دفعه ---------- */
// أقساط العدادات: كل عملية شراء في شهر p تُعاد على N قسط شهري متساوٍ تبدأ من الشهر p+1
function meterDue(meterIn, N, k) {
  let t = 0;
  for (const [p, amt] of Object.entries(meterIn)) {
    const d = idx(k) - idx(p);
    if (d >= 1 && d <= N) t += amt / N;
  }
  return t;
}
// التزامات مجدولة: { name, amount, first (YYYY-MM), times (عدد الأشهر) }
function schedDue(dues, k) {
  const items = [];
  for (const d of dues) {
    const o = idx(k) - idx(d.first);
    if (o >= 0 && o < Math.max(1, d.times) && !(d.paid_to && idx(k) <= idx(d.paid_to))) items.push({ name: d.name, iqd: num(d.amount) });
  }
  return items;
}

/* ---------- بناء التقرير (دالة نقية: لا تلمس قاعدة البيانات) ----------
   in: { year, now:'YYYY-MM', months, debtPct,
         ev:{ 'YYYY-MM': { 'kind|cat|src': iqd } },   // من fin_ev (بتوقيت بغداد)
         meterIn:{ 'YYYY-MM': iqd }  // كل التاريخ (لحساب الأقساط)
         prod:{ym:iqd}, game:{ym:{comm,wheelIn,prizes}}, don:{ym:iqd}, invest:[...], dues:[...] } */
function buildReport(I) {
  const N = Math.max(1, Math.floor(I.months || 10)), Y = I.year, keys = Array.from({ length: 12 }, (_, i) => ym(Y, i + 1));
  const e = (k, kind, cat, srcNot) => {
    const o = (I.ev && I.ev[k]) || {};
    return Object.entries(o).reduce((t, [kk, v]) => { const [kd, c, s] = kk.split('|'); return kd === kind && (cat === '*' || c === cat) && (!srcNot || s !== srcNot) ? t + v : t; }, 0);
  };
  const eMan = (k, kind) => { const o = (I.ev && I.ev[k]) || {}; return Object.entries(o).reduce((t, [kk, v]) => { const [kd, , s] = kk.split('|'); return kd === kind && s === 'manual' ? t + v : t; }, 0); };
  // عائد الاستثمار لكل شهر (مجموع كل الاستثمارات)
  const lastK = addM(I.now, 14), invM = {}, invList = (I.invest || []).filter((x) => x.active !== false).map((x) => {
    const acc = investAccrual(x, lastK); Object.entries(acc).forEach(([k, v]) => (invM[k] = (invM[k] || 0) + v));
    const tillNow = Object.entries(acc).filter(([k]) => idx(k) <= idx(I.now)).reduce((t, [, v]) => t + v, 0);
    const yr = Object.entries(acc).filter(([k]) => k.startsWith(String(Y))).reduce((t, [, v]) => t + v, 0);
    return { ...x, accrued: R(tillNow), year: R(yr), monthly_now: R(acc[I.now] || 0) };
  });

  const month = (k) => {
    const g = (I.game && I.game[k]) || { comm: 0, wheelIn: 0, prizes: 0 };
    const inc = {
      agency: e(k, 'in', 'agency', 'manual'),
      trade: Math.max(0, e(k, 'in', 'trade', 'manual') - e(k, 'out', 'trade', 'manual')),
      store: (I.prod && I.prod[k]) || 0,
      debt: e(k, 'in', 'debt', 'manual') * num(I.debtPct, 5) / 100,
      games: g.comm + g.wheelIn,
      donations: (I.don && I.don[k]) || 0,
      invest: invM[k] || 0,
      manual: eMan(k, 'in'),
    };
    const ex = {
      ref: e(k, 'out', 'ref', 'manual'),
      wheel: g.prizes,
      manual: eMan(k, 'out'),
      other: Object.entries((I.ev && I.ev[k]) || {}).reduce((t, [kk, v]) => { const [kd, c, s] = kk.split('|'); return kd === 'out' && s !== 'manual' && !['yields', 'ref', 'trade'].includes(c) ? t + v : t; }, 0),
    };
    const income = Object.values(inc).reduce((t, v) => t + v, 0), expenses = Object.values(ex).reduce((t, v) => t + v, 0);
    const meter = (I.meterIn && I.meterIn[k]) || 0, yieldsPaid = e(k, 'out', 'yields');
    // الوارد النقدي = كل ما دخل الصندوق: كل حركات الدخول المسجلة + دخل الألعاب + التبرعات + عائد الاستثمار
    const inflow = e(k, 'in', '*') + g.comm + g.wheelIn + ((I.don && I.don[k]) || 0) + (invM[k] || 0);
    const mDue = meterDue(I.meterIn || {}, N, k), sd = schedDue(I.dues || [], k), sDue = sd.reduce((t, x) => t + x.iqd, 0);
    return { ym: k, label: label(k), inc, ex, income, expenses, net: income - expenses, inflow, meter_in: meter, yields_paid: yieldsPaid, due_meter: mDue, due_sched: sDue, sched: sd, due: mDue + sDue };
  };
  const rows = keys.map(month);
  const sumF = (f) => rows.reduce((t, r) => t + f(r), 0);
  const tot = {
    inflow: sumF((r) => r.inflow), income: sumF((r) => r.income), expenses: sumF((r) => r.expenses), net: sumF((r) => r.net),
    meter_in: sumF((r) => r.meter_in), yields_paid: sumF((r) => r.yields_paid),
    inc: {}, ex: {},
  };
  ['agency', 'trade', 'store', 'debt', 'games', 'donations', 'invest', 'manual'].forEach((c) => (tot.inc[c] = sumF((r) => r.inc[c])));
  ['ref', 'wheel', 'manual', 'other'].forEach((c) => (tot.ex[c] = sumF((r) => r.ex[c])));

  const cur = I.now, nxt = addM(I.now, 1), mm = (k) => { const r = month(k); return { ym: k, label: r.label, meter: R(r.due_meter), sched: r.sched, sched_total: R(r.due_sched), total: R(r.due), yields_paid: R(r.yields_paid) }; };
  // المطلوب خلال السنة: من الشهر الحالي (إن كانت السنة الحالية) أو كل السنة المختارة
  const yFrom = String(Y) === cur.slice(0, 4) ? idx(cur) : idx(ym(Y, 1)), yDue = rows.filter((r) => idx(r.ym) >= yFrom);
  const outstandingMeter = Object.entries(I.meterIn || {}).reduce((t, [p, amt]) => {
    const paidN = Math.min(N, Math.max(0, idx(cur) - idx(p)));     // الأقساط التي استحقت حتى نهاية الشهر الحالي
    return t + amt * (1 - paidN / N);
  }, 0);
  const due = {
    year: { from: yFrom === idx(ym(Y, 1)) ? 'كل السنة' : 'من ' + label(cur), meter: R(yDue.reduce((t, r) => t + r.due_meter, 0)), sched: R(yDue.reduce((t, r) => t + r.due_sched, 0)), total: R(yDue.reduce((t, r) => t + r.due, 0)) },
    current: mm(cur), next: mm(nxt),
    outstanding_meter: R(outstandingMeter),
    months: N,
  };
  const r2 = (r) => ({
    ...r, inc: Object.fromEntries(Object.entries(r.inc).map(([k, v]) => [k, R(v)])), ex: Object.fromEntries(Object.entries(r.ex).map(([k, v]) => [k, R(v)])),
    income: R(r.income), expenses: R(r.expenses), net: R(r.net), inflow: R(r.inflow), meter_in: R(r.meter_in), yields_paid: R(r.yields_paid), due_meter: R(r.due_meter), due_sched: R(r.due_sched), due: R(r.due),
  });
  const rt = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? rt(v) : R(v)]));
  // أنواع الإيراد: كل نوع في خانة (شراء عداد / وكالة / تجارة / تبرعات / ألعاب ...)
  const curRow = rows.find((r) => r.ym === cur), TYPES = [
    ['meters', 'شراء العدادات', 'meter_in', 'مبلغ يُرد للمستخدم بالتقسيط — وارد نقدي وليس ربحاً'], ['agency', 'شراء الوكالات (رسوم)', 'agency'], ['trade', 'رسوم التجارة', 'trade'],
    ['donations', 'التبرعات', 'donations'], ['games', 'الألعاب', 'games'], ['store', 'ربح المتجر والبطاقات', 'store'], ['debt', 'ربح الاستدانة', 'debt'],
    ['invest', 'الاستثمار الخارجي', 'invest'], ['manual', 'إيرادات يدوية', 'manual']];
  const types = TYPES.map(([key, name, f, note]) => ({
    key, name, note: note || '', liability: key === 'meters',
    year: R(key === 'meters' ? tot.meter_in : tot.inc[f]), month: R(curRow ? (key === 'meters' ? curRow.meter_in : curRow.inc[f]) : 0),
    months: rows.map((r) => R(key === 'meters' ? r.meter_in : r.inc[f])),
  }));
  return { year: Y, now: cur, months: rows.map(r2), totals: rt(tot), due, invest: invList, types };
}

/* ---------- CSV (UTF-8 + BOM ليفتح في Excel بالعربية) ---------- */
const INC_L = { agency: 'رسوم الوكالات', trade: 'رسوم التجارة (صافي)', store: 'ربح المتجر والبطاقات', debt: 'ربح الاستدانة', games: 'الألعاب (عمولة + دخل العجلة)', donations: 'التبرعات', invest: 'عائد الاستثمار الخارجي', manual: 'إيرادات يدوية' };
const EX_L = { ref: 'عمولات الإحالة', wheel: 'جوائز العجلة', manual: 'مصروفات يدوية', other: 'مصروفات أخرى' };
function toCsv(rep) {
  const c = (v) => { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const L = [];
  const add = (...a) => L.push(a.map(c).join(','));
  add(`التقرير المالي لسنة ${rep.year}`); add('الوحدة', 'دينار عراقي'); add();
  add('الملخص السنوي'); add('الوارد النقدي', rep.totals.inflow); add('الأرباح (الإيرادات)', rep.totals.income); add('المصاريف', rep.totals.expenses); add('صافي الربح', rep.totals.net);
  add('مبالغ العدادات المستلمة (التزام يُرد)', rep.totals.meter_in); add('عوائد العدادات المدفوعة فعلاً', rep.totals.yields_paid); add();
  add('مصادر الأرباح'); Object.entries(INC_L).forEach(([k, l]) => add(l, rep.totals.inc[k])); add();
  add('المصاريف'); Object.entries(EX_L).forEach(([k, l]) => add(l, rep.totals.ex[k])); add();
  add('المطلوب دفعه'); add(`خلال السنة (${rep.due.year.from})`, rep.due.year.total, `منها أقساط عدادات ${rep.due.year.meter}`, `التزامات مجدولة ${rep.due.year.sched}`);
  add(`الشهر الحالي (${rep.due.current.label})`, rep.due.current.total, `أقساط عدادات ${rep.due.current.meter}`, `التزامات مجدولة ${rep.due.current.sched_total}`);
  add(`الشهر القادم (${rep.due.next.label})`, rep.due.next.total, `أقساط عدادات ${rep.due.next.meter}`, `التزامات مجدولة ${rep.due.next.sched_total}`);
  add('المتبقي من مبالغ العدادات للإرجاع', rep.due.outstanding_meter); add();
  add('أنواع الإيراد', 'الشهر الحالي', 'السنة'); (rep.types || []).forEach((t) => add(t.name + (t.liability ? ' (التزام يُرد)' : ''), t.month, t.year)); add();
  add('التفصيل الشهري');
  add('الشهر', 'الوارد النقدي', ...Object.values(INC_L), 'إجمالي الأرباح', ...Object.values(EX_L), 'إجمالي المصاريف', 'صافي الربح', 'عدادات مستلمة', 'عوائد مدفوعة', 'مطلوب: أقساط عدادات', 'مطلوب: التزامات', 'مطلوب: المجموع');
  rep.months.forEach((m) => add(m.label, m.inflow, ...Object.keys(INC_L).map((k) => m.inc[k]), m.income, ...Object.keys(EX_L).map((k) => m.ex[k]), m.expenses, m.net, m.meter_in, m.yields_paid, m.due_meter, m.due_sched, m.due));
  if (rep.invest.length) { add(); add('الاستثمارات الخارجية'); add('الاسم', 'المبلغ', 'النسبة السنوية %', 'البداية', 'المدة (شهر)', 'النوع', 'المستحق حتى الآن', 'عائد السنة'); rep.invest.forEach((v) => add(v.name, v.amount, v.rate_pct, v.start, v.term_months || 'مفتوح', v.mode === 'compound' ? 'مركّب' : 'بسيط', v.accrued, v.year)); }
  return '﻿' + L.join('\r\n');
}

/* ---------- المسارات وجلب البيانات ---------- */
exports.buildReport = buildReport; exports.investAccrual = investAccrual; exports.nowYm = nowYm; exports.toCsv = toCsv; exports.meterDue = meterDue;

exports.routes = (app, { pool, wrap, ctl, SYNC, GAME, settings, ptRate }) => {
  const q = (s, p) => pool.query(s, p);
  const fail = (http, m) => { const e = new Error(m); e.http = http; throw e; };

  q(`CREATE TABLE IF NOT EXISTS fin_invest(id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, amount NUMERIC(16,2) NOT NULL, rate_pct NUMERIC(8,3) NOT NULL DEFAULT 0,
      start_date DATE NOT NULL, term_months INT NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'simple', active BOOLEAN NOT NULL DEFAULT TRUE, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    .then(() => q(`CREATE TABLE IF NOT EXISTS fin_due(id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, amount NUMERIC(16,2) NOT NULL, first_ym TEXT NOT NULL, times INT NOT NULL DEFAULT 1,
      note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`))
    .catch((e) => console.error('fin-report migrate', e));

  const invRows = async () => (await q(`SELECT id,name,amount::float8 amount,rate_pct::float8 rate_pct,to_char(start_date,'YYYY-MM-DD') AS start,term_months,mode,active,note FROM fin_invest ORDER BY id DESC`)).rows;
  const dueRows = async () => (await q(`SELECT id,name,amount::float8 amount,first_ym AS first,times,note FROM fin_due ORDER BY first_ym,id`)).rows;

  async function gather(year) {
    const S = await settings(), pr = await ptRate(), app = S.hide_app && S.app_email ? S.app_email.toLowerCase() : '';
    const b = year + 1 + '-01-01';
    const evRaw = (await q(
      `SELECT to_char(ts AT TIME ZONE 'Asia/Baghdad','YYYY-MM') m, kind, cat, src, SUM(iqd)::float8 iqd FROM fin_ev
        WHERE ts >= ($1::date) AND ts < ($2::date) AND ($3='' OR LOWER(COALESCE(email,''))<>$3) GROUP BY 1,2,3,4`, [year + '-01-01', b, app])).rows;
    const ev = {}; evRaw.forEach((r) => { (ev[r.m] || (ev[r.m] = {}))[`${r.kind}|${r.cat}|${r.src}`] = r.iqd; });
    // كل مشتريات العدادات (لحساب الأقساط المستقبلية والمتبقية)، بدون حدّ سنة
    const meterIn = {};
    (await q(`SELECT to_char(ts AT TIME ZONE 'Asia/Baghdad','YYYY-MM') m, SUM(iqd)::float8 iqd FROM fin_ev WHERE kind='in' AND cat='counters' AND ($1='' OR LOWER(COALESCE(email,''))<>$1) GROUP BY 1`, [app]))
      .rows.forEach((r) => (meterIn[r.m] = r.iqd));
    const don = {};
    (await q(`SELECT to_char(created_at AT TIME ZONE 'Asia/Baghdad','YYYY-MM') m, SUM(pts)::float8 p FROM campaign_donations WHERE created_at >= $1::date AND created_at < $2::date AND ($3='' OR LOWER(email)<>$3) GROUP BY 1`, [year + '-01-01', b, app])
      .catch(() => ({ rows: [] }))).rows.forEach((r) => (don[r.m] = r.p * pr));
    const game = {};
    if (GAME) {
      const gr = num(GAME.cfg().gemRate, 100);
      Object.entries(GAME.daily()).forEach(([d, x]) => {
        const k = d.slice(0, 7); if (!k.startsWith(String(year))) return;
        const o = game[k] || (game[k] = { comm: 0, wheelIn: 0, prizes: 0 });
        o.comm += num(x.g.comm) * pr; o.wheelIn += num(x.w.gems) * gr * pr; o.prizes += (num(x.w.pts) + num(x.w.gout) * gr) * pr;
      });
    }
    // ربح المتجر شهرياً (نفس منطق الملخص: ربح = (بيع − شراء) × العدد، لمن عُرف سعراه)
    const cost = {}; (await q(`SELECT name,buy::float8 buy,sell::float8 sell FROM fin_costs`)).rows.forEach((c) => (cost[c.name] = c));
    const prod = {}, bump = (k, v) => { if (k.startsWith(String(year))) prod[k] = (prod[k] || 0) + v; };
    (SYNC ? Object.values(SYNC.ords()) : []).forEach((o) => {
      if (!o || o.rej || !Array.isArray(o.items) || !o.at) return;
      if (app && String(o.u || '').toLowerCase() === app) return;
      const k = nowYm(o.at);
      o.items.forEach((n) => { const c = cost[n]; if (c && c.buy > 0 && c.sell > 0) bump(k, c.sell - c.buy); });
    });
    (await q(`SELECT to_char(ts AT TIME ZONE 'Asia/Baghdad','YYYY-MM') m, note, COUNT(*)::int n FROM fin_ev WHERE cat='store' AND kind='in' AND ts >= $1::date AND ts < $2::date AND ($3='' OR LOWER(COALESCE(email,''))<>$3) GROUP BY 1,2`, [year + '-01-01', b, app]))
      .rows.forEach((r) => { const c = cost[String(r.note || '').replace(/^تم شراء\s*/, '').slice(0, 80)]; if (c && c.buy > 0 && c.sell > 0) bump(r.m, r.n * (c.sell - c.buy)); });
    return { year, now: nowYm(), months: S.months, debtPct: S.debt_pct, ev, meterIn, prod, game, don, invest: await invRows(), dues: await dueRows() };
  }
  const yearOf = (v) => { const y = Math.floor(num(v, Number(nowYm().slice(0, 4)))); return y >= 2020 && y <= 2100 ? y : Number(nowYm().slice(0, 4)); };

  app.get('/api/ctl/fin2/report', ...ctl, wrap(async (req, res) => res.json(buildReport(await gather(yearOf(req.query.year))))));

  app.get('/api/ctl/fin2/report.csv', ...ctl, wrap(async (req, res) => {
    const y = yearOf(req.query.year), rep = buildReport(await gather(y));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finance-report-${y}.csv"`);
    res.send(toCsv(rep));
  }));

  /* ---- الاستثمار الخارجي ---- */
  app.get('/api/ctl/fin2/invest', ...ctl, wrap(async (_req, res) => {
    const rep = buildReport({ year: Number(nowYm().slice(0, 4)), now: nowYm(), months: 10, invest: await invRows() });
    res.json({ items: rep.invest });
  }));
  app.post('/api/ctl/fin2/invest', ...ctl, wrap(async (req, res) => {
    const b = req.body || {}, id = Math.floor(num(b.id)), name = txt(b.name, 100), amount = num(b.amount), rate = num(b.rate_pct), term = Math.max(0, Math.min(600, Math.floor(num(b.term_months))));
    const mode = b.mode === 'compound' ? 'compound' : 'simple', start = txt(b.start, 10), active = b.active !== false;
    if (!name || !(amount > 0) || amount > 1e13 || rate < 0 || rate > 1000 || !/^\d{4}-\d{2}-\d{2}$/.test(start) || isNaN(new Date(start))) fail(400, 'بيانات الاستثمار غير صحيحة');
    if (id) await q(`UPDATE fin_invest SET name=$2,amount=$3,rate_pct=$4,start_date=$5,term_months=$6,mode=$7,active=$8,note=$9 WHERE id=$1`, [id, name, amount, rate, start, term, mode, active, txt(b.note, 200)]);
    else await q(`INSERT INTO fin_invest(name,amount,rate_pct,start_date,term_months,mode,active,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [name, amount, rate, start, term, mode, active, txt(b.note, 200)]);
    res.json({ ok: true });
  }));
  app.post('/api/ctl/fin2/invest/del', ...ctl, wrap(async (req, res) => { await q(`DELETE FROM fin_invest WHERE id=$1`, [Math.floor(num((req.body || {}).id))]); res.json({ ok: true }); }));

  /* ---- التزامات مجدولة (إيجار، رواتب، أقساط...) ---- */
  app.get('/api/ctl/fin2/dues', ...ctl, wrap(async (_req, res) => res.json({ items: await dueRows() })));
  app.post('/api/ctl/fin2/dues', ...ctl, wrap(async (req, res) => {
    const b = req.body || {}, id = Math.floor(num(b.id)), name = txt(b.name, 100), amount = num(b.amount), first = txt(b.first, 7), times = Math.max(1, Math.min(240, Math.floor(num(b.times, 1))));
    if (!name || !(amount > 0) || amount > 1e13 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(first)) fail(400, 'بيانات الالتزام غير صحيحة');
    if (id) await q(`UPDATE fin_due SET name=$2,amount=$3,first_ym=$4,times=$5,note=$6 WHERE id=$1`, [id, name, amount, first, times, txt(b.note, 200)]);
    else await q(`INSERT INTO fin_due(name,amount,first_ym,times,note) VALUES($1,$2,$3,$4,$5)`, [name, amount, first, times, txt(b.note, 200)]);
    res.json({ ok: true });
  }));
  app.post('/api/ctl/fin2/dues/del', ...ctl, wrap(async (req, res) => { await q(`DELETE FROM fin_due WHERE id=$1`, [Math.floor(num((req.body || {}).id))]); res.json({ ok: true }); }));
};

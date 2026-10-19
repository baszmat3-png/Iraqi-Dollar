'use strict';
/**
 * game-ext.js — لعبة "العب معنا" (4 لاعبين حقيقيين) + عجلة الحظ + إحصائيات الأرباح
 *
 * التركيب في server.js (قبل مسارات /api/ctl الحالية):
 *     require('./game-ext')(app);
 * أو إذا كان فحص مفتاح الإدارة عندك مختلفاً:
 *     require('./game-ext')(app,{ isAdmin: req => /* ارجع true إذا كان المفتاح صحيحاً *\/ });
 *
 * المتغيرات الاختيارية: ADMIN_KEY (مفتاح الإدارة)، GAME_DATA (مسار ملف الحفظ).
 * على Render: استخدم Disk دائماً وضع GAME_DATA=/data/game-data.json حتى لا تضيع الإحصائيات عند إعادة النشر.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

module.exports = function mountGame(app, opts) {
  opts = opts || {};
  const express = require('express');
  const FILE = opts.file || process.env.GAME_DATA || path.join(__dirname, 'game-data.json');
  const REVEAL_MS = 7600;      // مدة عرض السحب قبل إضافة الجائزة
  const WHEEL_MS = 4700;       // مدة دوران العجلة قبل إضافة الجائزة
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}$/;

  const isAdmin = opts.isAdmin || (req => {
    const k = String(process.env.ADMIN_KEY || process.env.CTL_KEY || '');
    const h = String(req.headers['x-admin-key'] || '');
    if (!k || h.length !== k.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(k)); } catch (e) { return false; }
  });

  /* ---------- الإعدادات الافتراضية ---------- */
  const DEF = {
    on: true, wOn: true,
    entry: 1000, comm: 10, seats: 4, wait: 90,
    wCost: 100, wJack: 3, wLose: 37, jack: 3600, gemRate: 100,
    wheel: [
      { l: '3600', t: 'p', v: 3600 }, { l: 'حظ أوفر', t: 'x', v: 0 },
      { l: '200', t: 'p', v: 200 }, { l: 'حظ أوفر', t: 'x', v: 0 },
      { l: '500', t: 'p', v: 500 }, { l: '100', t: 'p', v: 100 },
      { l: 'جوهرة', t: 'g', v: 1 }, { l: '50', t: 'p', v: 50 }
    ]
  };

  /* ---------- التخزين ---------- */
  const zero = () => ({
    g: { n: 0, stake: 0, prize: 0, comm: 0, ref: 0 },
    w: { n: 0, gems: 0, pts: 0, gout: 0, jack: 0, lose: 0 }
  });
  let db = { seq: 1, cfg: Object.assign({}, DEF), rooms: {}, matches: [], spins: [], credits: {}, players: {}, daily: {}, tot: zero(), rids: {} };
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    db = Object.assign(db, j);
    db.cfg = Object.assign({}, DEF, j.cfg || {});
    if (!Array.isArray(db.cfg.wheel) || db.cfg.wheel.length !== 8) db.cfg.wheel = DEF.wheel;
  } catch (e) { /* ملف جديد */ }

  let dirty = false, wt = null;
  const save = () => {
    dirty = true;
    if (wt) return;
    wt = setTimeout(() => {
      wt = null;
      if (!dirty) return;
      dirty = false;
      try {
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, FILE);
      } catch (e) { console.error('[game] save failed', e.message); }
    }, 800);
  };
  process.on('SIGTERM', () => { try { fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) {} });

  /* ---------- أدوات ---------- */
  // بث فوري (SSE) للوحة التحكم عند أي حركة مالية في الألعاب
  let bt = null;
  const bc = () => {
    if (bt) return;
    bt = setTimeout(() => { bt = null; try { if (app.locals.broadcastStore) app.locals.broadcastStore({ k: 'game' }); } catch (e) {} }, 150);
  };
  const now = () => Date.now();
  const day = (t) => new Date((t || now()) + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت العراق
  const rnd = n => crypto.randomInt(0, n);
  const rndF = () => crypto.randomInt(0, 1000000) / 10000; // 0..100
  const num = (v, d, lo, hi) => { v = +v; if (!isFinite(v)) return d; return Math.min(hi, Math.max(lo, v)); };
  const nm = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 40) || 'لاعب';
  const key = e => String(e || '').trim().toLowerCase();
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const bucket = () => { const d = day(); return db.daily[d] || (db.daily[d] = zero()); };
  const P = (e, n) => {
    const p = db.players[e] || (db.players[e] = { n: nm(n), dkh: '', games: 0, won: 0, staked: 0, prizes: 0, spins: 0, wGems: 0, wPts: 0, wGemsWon: 0, cm: 0, last: 0 });
    if (n) p.n = nm(n);
    return p;
  };
  const addCredit = (e, c) => {
    (db.credits[e] || (db.credits[e] = [])).push(Object.assign({ id: 'c' + (db.seq++), at: now() }, c));
  };
  const rl = {};
  const limited = (k, max, ms) => {
    const t = now(), a = (rl[k] || []).filter(x => t - x < ms);
    a.push(t); rl[k] = a;
    return a.length > max;
  };
  const trimRids = () => {
    const ks = Object.keys(db.rids);
    if (ks.length > 6000) ks.slice(0, ks.length - 4000).forEach(k => delete db.rids[k]);
  };

  /* هوية الجهاز: أول جهاز يستخدم البريد يُربط به حتى لا يستطيع غيره سحب جوائزه */
  function who(req, res) {
    const b = req.method === 'GET' ? req.query : req.body || {};
    const e = key(b.e), dk = String(b.dk || '');
    if (!EMAIL.test(e)) { res.status(400).json({ error: 'حساب غير صالح' }); return null; }
    if (dk.length < 16 || dk.length > 80) { res.status(400).json({ error: 'جهاز غير معروف' }); return null; }
    const p = P(e, b.n), h = sha(dk);
    // السماح باللعب من أي جهاز: لا يوجد ربط بجهاز واحد (يُحدَّث آخر جهاز فقط)
    if (p.dkh !== h) { p.dkh = h; save(); }
    p.last = now();
    return { e, p, b };
  }

  /* ---------- اللعبة ---------- */
  const waitingRoom = e => Object.values(db.rooms).find(r => r.st === 'w' && r.players.some(p => p.e === e));
  const openRoom = () => Object.values(db.rooms).find(r => r.st === 'w' && r.players.length < r.seats);

  function finalize(r) {
    const n = r.players.length, total = r.entry * n;
    const w = rnd(n);
    r.prize = Math.floor(total * (100 - r.commPct) / 100);
    r.cm = total - r.prize;
    r.win = w; r.st = 'd'; r.dt = now(); r.rev = now() + REVEAL_MS;
    r.players.forEach((p, i) => {
      const pl = P(p.e, p.n);
      pl.games++; pl.staked += r.entry;
      pl.cm = (pl.cm || 0) + r.cm / n; // حصة هذا اللاعب من عمولة التطبيق (ربح صاحب التطبيق منه)
      if (i === w) {
        pl.won++; pl.prizes += r.prize;
        addCredit(p.e, { k: 'win', p: r.prize, g: 0, at: r.rev + 400, r: 'الفوز في لعبة العب معنا', x: 'جائزة الفائز ' + r.prize + ' نقطة (' + n + ' لاعبين × ' + r.entry + ')' });
      }
    });
    const d = bucket(), t = db.tot;
    // الحسابات المستثناة لا تدخل في أرباح اللعبة: يُحتسب نصيب غير المستثنين فقط
    const exs = (opts.excluded && opts.excluded()) || new Set(), nx = r.players.filter(p => !exs.has(key(p.e))).length;
    const sStake = r.entry * nx, sPrize = exs.has(key(r.players[w].e)) ? 0 : r.prize, sComm = Math.round(r.cm * nx / n);
    if (nx) [d.g, t.g].forEach(g => { g.n++; g.stake += sStake; g.prize += sPrize; g.comm += sComm; });
    db.matches.push({ id: r.id, t: r.dt, entry: r.entry, pct: r.commPct, total, prize: r.prize, cm: r.cm, win: r.players[w].n, we: r.players[w].e, ps: r.players.map(p => p.n) });
    if (db.matches.length > 3000) db.matches.splice(0, db.matches.length - 3000);
    save(); bc();
  }

  function cancel(r, why) {
    r.players.forEach(p => {
      addCredit(p.e, { k: 'refund', p: r.entry, g: 0, at: now(), r: 'استرجاع رسوم دخول اللعبة', x: why });
    });
    const k = db.tot.g; k.ref += r.players.length;
    bucket().g.ref += r.players.length;
    r.st = 'c'; r.dt = now();
    save(); bc();
  }

  setInterval(() => {
    const t = now();
    Object.values(db.rooms).forEach(r => {
      if (r.st === 'w' && t > r.exp) cancel(r, 'لم يكتمل عدد اللاعبين في الوقت المحدد');
      if (r.st !== 'w' && t - (r.dt || t) > 3 * 60e3) delete db.rooms[r.id];
    });
  }, 4000).unref();

  const roomView = (r, e) => {
    const t = now();
    const v = {
      id: r.id, st: r.st, seats: r.seats, entry: r.entry, pct: r.commPct,
      players: r.players.map(p => ({ n: p.n, me: p.e === e })),
      left: Math.max(0, r.exp - t)
    };
    if (r.st === 'd') { v.win = r.win; v.prize = r.prize; v.cm = r.cm; v.rev = Math.max(0, r.rev - t); v.total = r.entry * r.players.length; }
    if (r.st === 'c') v.why = 'لم يكتمل عدد اللاعبين، تم إرجاع رسوم الدخول';
    return v;
  };

  const R = express.Router();
  R.use(express.json({ limit: '20kb' }));
  R.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  R.get('/cfg', (req, res) => {
    const c = db.cfg;
    const waiting = openRoom();
    res.json({
      on: c.on, wOn: c.wOn, entry: c.entry, comm: c.comm, seats: c.seats, wait: c.wait,
      wCost: c.wCost, wheel: c.wheel, jack: c.jack,
      pool: c.entry * c.seats, prize: Math.floor(c.entry * c.seats * (100 - c.comm) / 100),
      waiting: waiting ? waiting.players.length : 0, now: now()
    });
  });

  R.get('/me', (req, res) => {
    const a = who(req, res); if (!a) return;
    const t = now();
    let room = Object.values(db.rooms).find(r => r.players.some(p => p.e === a.e) && (r.st === 'w' || (r.st === 'd' && r.rev + 1500 > t)));
    const p = a.p;
    const feed = db.matches.slice(-8).reverse().map(m => ({ n: m.win, p: m.prize, t: m.t }));
    const wfeed = db.spins.slice(-40).reverse().filter(s => s.pr && s.pr.t !== 'x').slice(0, 6).map(s => ({ n: s.n, l: s.pr.t === 'g' ? s.pr.v + ' جوهرة' : s.pr.v + ' نقطة', t: s.t }));
    res.json({
      room: room ? room.id : null,
      stats: { games: p.games, won: p.won, staked: p.staked, prizes: p.prizes, spins: p.spins, wGems: p.wGems, wPts: p.wPts },
      feed, wfeed, now: t
    });
  });

  R.post('/join', (req, res) => {
    const a = who(req, res); if (!a) return;
    const c = db.cfg, rid = String(a.b.rid || '').slice(0, 40);
    if (!c.on) return res.status(403).json({ error: 'اللعبة متوقفة مؤقتاً' });
    if (rid && db.rids[rid]) {
      const r = db.rooms[db.rids[rid].mid];
      if (r) return res.json({ ok: 1, room: roomView(r, a.e), dup: 1 });
      return res.json({ ok: 1, dup: 1, room: null });
    }
    if (limited('j:' + a.e, 6, 20000)) return res.status(429).json({ error: 'محاولات كثيرة، انتظر قليلاً' });
    if (waitingRoom(a.e)) return res.status(409).json({ error: 'أنت داخل لعبة بالفعل' });
    let r = openRoom();
    if (Math.round(+a.b.entry || 0) !== (r ? r.entry : c.entry)) return res.status(409).json({ error: 'تغيّرت رسوم الدخول، حدّث الصفحة وأعد المحاولة' });
    if (!r) {
      const id = 'G' + (db.seq++);
      r = db.rooms[id] = { id, st: 'w', entry: c.entry, commPct: c.comm, seats: c.seats, players: [], t0: now(), exp: now() + c.wait * 1000 };
    }
    r.players.push({ e: a.e, n: nm(a.b.n || a.p.n), rid, at: now() });
    if (rid) { db.rids[rid] = { k: 'j', mid: r.id, e: a.e }; trimRids(); }
    if (r.players.length >= r.seats) finalize(r);
    save();
    res.json({ ok: 1, room: roomView(r, a.e) });
  });

  R.get('/room', (req, res) => {
    const a = who(req, res); if (!a) return;
    const r = db.rooms[String(req.query.mid || '')];
    if (!r || !r.players.some(p => p.e === a.e)) return res.json({ st: 'gone' });
    res.json(roomView(r, a.e));
  });

  R.post('/leave', (req, res) => {
    const a = who(req, res); if (!a) return;
    const r = db.rooms[String(a.b.mid || '')];
    if (!r || r.st !== 'w') return res.json({ ok: 0, error: 'لا يمكن المغادرة الآن' });
    const i = r.players.findIndex(p => p.e === a.e);
    if (i < 0) return res.json({ ok: 0 });
    r.players.splice(i, 1);
    addCredit(a.e, { k: 'refund', p: r.entry, g: 0, at: now(), r: 'استرجاع رسوم دخول اللعبة', x: 'غادرت قبل اكتمال اللاعبين' });
    if (!r.players.length) delete db.rooms[r.id];
    save();
    res.json({ ok: 1 });
  });

  /* ---------- العجلة ---------- */
  R.post('/wheel/spin', (req, res) => {
    const a = who(req, res); if (!a) return;
    const c = db.cfg, rid = String(a.b.rid || '').slice(0, 40);
    if (!c.wOn) return res.status(403).json({ error: 'العجلة متوقفة مؤقتاً' });
    if (rid && db.rids[rid] && db.rids[rid].k === 's') {
      const s = db.spins.find(x => x.id === db.rids[rid].sid);
      if (s) return res.json({ ok: 1, id: s.id, idx: s.idx, prize: s.pr, wait: Math.max(0, s.t + WHEEL_MS - now()), dup: 1 });
    }
    if (limited('s:' + a.e, 8, 20000)) return res.status(429).json({ error: 'محاولات كثيرة، انتظر قليلاً' });
    if (Math.round(+a.b.cost || 0) !== c.wCost) return res.status(409).json({ error: 'تغيّرت تكلفة العجلة، حدّث الصفحة وأعد المحاولة' });
    const W = c.wheel, k = rndF();
    let idx;
    const lose = [], norm = [];
    W.forEach((w, i) => { if (i === 0) return; (w.t === 'x' ? lose : norm).push(i); });
    if (k < c.wJack) idx = 0;
    else if (k < c.wJack + c.wLose && lose.length) idx = lose[rnd(lose.length)];
    else idx = norm[rnd(norm.length)];
    const seg = W[idx];
    const pr = { t: seg.t, v: seg.v, l: seg.l };
    const id = 'S' + (db.seq++), t = now();
    db.spins.push({ id, t, e: a.e, n: a.p.n, idx, cost: c.wCost, pr });
    if (db.spins.length > 3000) db.spins.splice(0, db.spins.length - 3000);
    if (rid) { db.rids[rid] = { k: 's', sid: id, e: a.e }; trimRids(); }
    a.p.spins++; a.p.wGems += c.wCost;
    const ex1 = !!(opts.excluded && opts.excluded().has(a.e)); // حساب مستثنى: لا يدخل في إحصائيات العجلة
    const d = ex1 ? zero().w : bucket().w, T = ex1 ? zero().w : db.tot.w;
    [d, T].forEach(w => { w.n++; w.gems += c.wCost; });
    if (pr.t === 'p') {
      a.p.wPts += pr.v;
      [d, T].forEach(w => { w.pts += pr.v; if (idx === 0) w.jack++; });
      addCredit(a.e, { k: 'wheel', p: pr.v, g: 0, at: t + WHEEL_MS, r: 'ربح من عجلة الحظ', x: 'جائزة: ' + pr.v + ' نقطة' });
    } else if (pr.t === 'g') {
      a.p.wGemsWon += pr.v;
      [d, T].forEach(w => { w.gout += pr.v; });
      addCredit(a.e, { k: 'wheel', p: 0, g: pr.v, at: t + WHEEL_MS, r: 'ربح من عجلة الحظ', x: 'جائزة: ' + pr.v + ' جوهرة' });
    } else {
      [d, T].forEach(w => { w.lose++; });
    }
    save(); bc();
    res.json({ ok: 1, id, idx, prize: pr, wait: WHEEL_MS });
  });

  /* ---------- الأرصدة المستحقة ---------- */
  R.get('/credits', (req, res) => {
    const a = who(req, res); if (!a) return;
    const t = now(), l = (db.credits[a.e] || []).filter(c => c.at <= t);
    // جوائز يسلّمها الخادم: تُسجَّل كسماح في حارس الأرصدة (مرة واحدة لكل جائزة) كي لا تُقصّ عند رفعها كفرق من الجهاز
    try {
      const G = app.locals.balGuard; let any = false;
      l.forEach(c => { if (!c.al) { c.al = 1; any = true; if (G) G.allow(a.e, c.p || 0, c.g || 0, 0); } });
      if (any) save();
    } catch (e) { /* اختياري */ }
    res.json({ list: l.map(c => ({ id: c.id, k: c.k, p: c.p || 0, g: c.g || 0, r: c.r, x: c.x })) });
  });

  R.post('/ack', (req, res) => {
    const a = who(req, res); if (!a) return;
    const ids = Array.isArray(a.b.ids) ? a.b.ids.slice(0, 50).map(String) : [];
    const before = (db.credits[a.e] || []).length;
    db.credits[a.e] = (db.credits[a.e] || []).filter(c => !ids.includes(c.id));
    if (!db.credits[a.e].length) delete db.credits[a.e];
    if (before) save();
    res.json({ ok: 1 });
  });

  R.get('/check', (req, res) => {
    const a = who(req, res); if (!a) return;
    const x = db.rids[String(req.query.rid || '')];
    res.json({ ok: !!(x && x.e === a.e), k: x ? x.k : null });
  });

  app.use('/api/game', R);

  /* ---------- لوحة الإدارة ---------- */
  const A = express.Router();
  A.use(express.json({ limit: '20kb' }));
  A.use((req, res, next) => { if (!isAdmin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صحيح' }); res.set('Cache-Control', 'no-store'); next(); });

  /* كشف حساب كل لاعب: ربح/خسارة المستخدم وربح صاحب التطبيق منه في اللعبتين + الناتج النهائي */
  function ledger() {
    const R = +db.cfg.gemRate || 100;
    const exs = (opts.excluded && opts.excluded()) || new Set();
    const T = { users: 0, gStaked: 0, gPrizes: 0, gComm: 0, wGemsPaid: 0, wPtsWon: 0, wGemsWon: 0, userNet: 0, ownerG: 0, ownerW: 0, ownerProfit: 0, excluded: 0 };
    const rows = [];
    Object.keys(db.players).forEach(e => {
      const p = db.players[e];
      if (!p.games && !p.spins) return;
      const gCm = p.cm != null ? p.cm : p.staked * db.cfg.comm / 100; // سجلات قديمة: تقدير بنسبة العمولة الحالية
      const gNet = p.prizes - p.staked;
      const wNet = p.wPts + p.wGemsWon * R - p.wGems * R;
      const ex = exs.has(key(e));
      const row = {
        e, n: p.n, ex,
        games: p.games, won: p.won, staked: p.staked, prizes: p.prizes, gNet, gComm: Math.round(gCm),
        spins: p.spins, wGems: p.wGems, wPts: p.wPts, wGemsWon: p.wGemsWon, wNet: Math.round(wNet),
        userNet: Math.round(gNet + wNet), owner: Math.round(gCm - wNet), last: p.last || 0
      };
      rows.push(row);
      if (ex) { T.excluded++; return; }
      T.users++; T.gStaked += p.staked; T.gPrizes += p.prizes; T.gComm += gCm;
      T.wGemsPaid += p.wGems; T.wPtsWon += p.wPts; T.wGemsWon += p.wGemsWon;
      T.userNet += gNet + wNet; T.ownerG += gCm; T.ownerW += -wNet;
    });
    T.ownerProfit = Math.round(T.ownerG + T.ownerW);
    ['gComm', 'userNet', 'ownerG', 'ownerW'].forEach(k => { T[k] = Math.round(T[k]); });
    rows.sort((a, b) => b.owner - a.owner);
    return { rows: rows.slice(0, 2000), tot: T, rate: R };
  }

  A.get('/stats', (req, res) => {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 14));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = day(now() - i * 864e5), b = db.daily[d] || zero();
      series.push({ d, g: b.g, w: b.w });
    }
    const top = Object.keys(db.players).map(e => {
      const p = db.players[e];
      return { e, n: p.n, games: p.games, won: p.won, staked: p.staked, prizes: p.prizes, spins: p.spins, wGems: p.wGems, wPts: p.wPts, wGemsWon: p.wGemsWon, net: p.prizes - p.staked + p.wPts - 0 };
    }).filter(p => p.games || p.spins).sort((a, b) => b.prizes + b.wPts - (a.prizes + a.wPts)).slice(0, 25);
    const pending = Object.values(db.credits).reduce((t, l) => t + l.reduce((s, c) => s + (c.p || 0), 0), 0);
    res.json({
      cfg: db.cfg, tot: db.tot, series, top,
      matches: db.matches.slice(-40).reverse(),
      spins: db.spins.slice(-40).reverse().map(s => ({ id: s.id, t: s.t, n: s.n, cost: s.cost, pr: s.pr })),
      live: Object.values(db.rooms).filter(r => r.st === 'w').map(r => ({ id: r.id, n: r.players.length, seats: r.seats, left: Math.max(0, r.exp - now()) })),
      players: Object.keys(db.players).length, pending, now: now(), ledger: ledger()
    });
  });

  A.get('/config', (req, res) => res.json(db.cfg));

  A.post('/config', (req, res) => {
    const b = req.body || {}, c = db.cfg, old = c.entry + '|' + c.comm;
    c.on = !!b.on; c.wOn = !!b.wOn;
    c.entry = Math.round(num(b.entry, c.entry, 1, 1e7));
    c.comm = num(b.comm, c.comm, 0, 90);
    c.wait = Math.round(num(b.wait, c.wait, 15, 600));
    c.wCost = Math.round(num(b.wCost, c.wCost, 0, 1e6));
    c.wJack = num(b.wJack, c.wJack, 0, 50);
    c.wLose = num(b.wLose, c.wLose, 0, 100 - c.wJack);
    c.gemRate = Math.round(num(b.gemRate, c.gemRate, 1, 1e6));
    c.jack = Math.round(num(b.jack, c.jack, 1, 1e7));
    c.wheel[0] = { l: String(c.jack), t: 'p', v: c.jack };
    if (old !== c.entry + '|' + c.comm) Object.values(db.rooms).filter(r => r.st === 'w').forEach(r => cancel(r, 'تم تحديث إعدادات اللعبة'));
    save();
    res.json({ ok: 1, cfg: c });
  });

  A.post('/unbind', (req, res) => {
    const e = key((req.body || {}).e), p = db.players[e];
    if (!p) return res.status(404).json({ error: 'الحساب غير موجود في سجل الألعاب' });
    p.dkh = ''; save();
    res.json({ ok: 1 });
  });

  app.use('/api/ctl/game', A);
  console.log('[game] جاهز · الملف:', FILE);
  /* للقراءة فقط: تستخدمه لوحة المالية */
  return { daily: () => db.daily, cfg: () => db.cfg };
};

/* الرومات الصوتية — قائمة الرومات + غرفة بمايكات + دردشة + هدايا + موسيقى خلفية + إشراف
   الصوت يمر مباشرة بين الأجهزة (WebRTC) والسيرفر يُدير الغرفة والإشارات فقط. */
(function () {
  'use strict';
  if (typeof S === 'undefined' || typeof V === 'undefined') return;

  const $ = (s, r) => (r || document).querySelector(s);
  const idn = () => (S.acc && S.acc.e && S.acc.h ? { e: S.acc.e, h: S.acc.h } : null);
  const say = (m) => { try { toast(m); } catch (e) { alert(m); } };
  const fmt = (n) => { try { return f(n); } catch (e) { return Number(n).toLocaleString('en'); } };
  const myPts = () => { try { return +S.pts || 0; } catch (e) { return 0; } };
  const E = (s) => { try { return esc(s); } catch (e) { return String(s).replace(/[&<>"']/g, ''); } };
  const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const post = async (p, b) => {
    const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const er = new Error(j.error || 'تعذر الاتصال بالخادم'); er.status = r.status; throw er; }
    return j;
  };
  const get = async (p) => { const r = await fetch(p, { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'تعذر الاتصال'); return j; };

  /* ---------- أيقونات ---------- */
  const IP = {
    mic: 'M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 18v4M8 22h8',
    micoff: 'M2 2l20 20M9 9v2a3 3 0 005.1 2.1M15 9.3V5a3 3 0 00-5.9-.8M19 11a7 7 0 01-.9 3.4M5 11a7 7 0 009.9 6.4M12 18v4M8 22h8',
    crown: 'M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z', shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z',
    lock: 'M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z', gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C10 4 6 4 6 7s4 1 6 1zm0 0c2-4 6-4 6 -1s-4 1-6 1z',
    users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 5a3 3 0 010 6M21 20a6 6 0 00-3-5',
    music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
    hand: 'M8 13V5a1.5 1.5 0 013 0v6M11 10V3.5a1.5 1.5 0 013 0V10M14 10V5a1.5 1.5 0 013 0v8M17 8a1.5 1.5 0 013 0v6a8 8 0 01-8 8h-1a8 8 0 01-6.5-3.4L3 14a1.6 1.6 0 012.6-1.8L8 15',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', down: 'M6 9l6 6 6-6', dots: 'M5 12h.01M12 12h.01M19 12h.01',
    power: 'M12 2v10M18.4 6.6a9 9 0 11-12.8 0', vol: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14',
    voloff: 'M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6', plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12',
    play: 'M6 4l14 8-14 8V4z', pause: 'M6 4h4v16H6zM14 4h4v16h-4z', ban: 'M4.9 4.9l14.2 14.2M12 2a10 10 0 100 20 10 10 0 000-20z',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    chat: 'M21 12a8 8 0 01-11.5 7.2L3 21l1.8-5.5A8 8 0 1121 12z',
  };
  try { if (typeof P !== 'undefined' && !P.mic) P.mic = IP.mic; } catch (e) {}
  const I = (n, z) => `<svg class="rmi" ${z ? `style="width:${z}px;height:${z}px"` : ''} viewBox="0 0 24 24"><path d="${IP[n] || ''}"/></svg>`;

  const THEMES = [['#0e7c86', '#08141d', '#2bd4c4'], ['#6d28d9', '#12082a', '#c084fc'], ['#be185d', '#26091a', '#fb7185'], ['#b45309', '#1f1204', '#fbbf24'],
    ['#047857', '#04150e', '#34d399'], ['#1d4ed8', '#070f2a', '#60a5fa'], ['#b91c1c', '#260606', '#f87171'], ['#475569', '#0a0e16', '#cbd5e1']];
  const EMOJIS = ['🎙️', '🎧', '🎵', '🔥', '👑', '💎', '🌙', '⭐', '🎮', '❤️', '🦁', '🌹'];
  const th = (i) => THEMES[(+i || 0) % THEMES.length];

  /* ---------- أنماط ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .rm-hero{border-radius:22px;padding:18px;margin:6px 0 14px;color:#fff;background:linear-gradient(135deg,#0e7c86,#6d28d9);position:relative;overflow:hidden;box-shadow:0 10px 28px #0006}
  .rm-hero:after{content:"🎙️";position:absolute;left:-6px;bottom:-18px;font-size:6.2rem;opacity:.16;transform:rotate(-14deg)}
  .rm-hero h2{margin:0 0 4px;font-size:1.25rem}.rm-hero p{margin:0 0 12px;opacity:.9;font-size:.9rem}
  .rm-hero .row{display:flex;gap:8px;flex-wrap:wrap}
  .rm-b{font:inherit;font-weight:700;border:0;border-radius:14px;padding:11px 16px;cursor:pointer;color:#06232a;background:#fff;display:inline-flex;align-items:center;gap:7px}
  .rm-b.g{background:#ffffff26;color:#fff;backdrop-filter:blur(6px)}
  .rm-b:disabled{opacity:.55}
  .rm-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .rm-c{position:relative;border:0;border-radius:20px;padding:14px 12px 12px;color:#fff;text-align:right;cursor:pointer;font:inherit;min-height:138px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 22px #0005}
  .rm-c .em{position:absolute;left:-8px;top:-6px;font-size:3.6rem;opacity:.22;transform:rotate(-12deg)}
  .rm-c b{font-size:1.02rem;line-height:1.35;display:block;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .rm-c small{display:block;opacity:.85;font-size:.76rem;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm-c .ft{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:10px}
  .rm-pill{display:inline-flex;align-items:center;gap:5px;background:#0006;border-radius:99px;padding:3px 10px;font-size:.78rem;backdrop-filter:blur(4px)}
  .rm-live{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 #34d39988;animation:rmdot 1.6s infinite}
  @keyframes rmdot{70%{box-shadow:0 0 0 8px #34d39900}100%{box-shadow:0 0 0 0 #34d39900}}
  .rav{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;flex:none;color:#fff;font-weight:700;font-size:.85rem;background:linear-gradient(135deg,hsl(var(--hu) 65% 48%),hsl(calc(var(--hu) + 40) 70% 32%));background-size:cover;background-position:center;box-shadow:inset 0 0 0 2px #ffffff40}
  .rm-empty{text-align:center;padding:34px 16px;color:var(--mu)}.rm-empty b{display:block;color:#fff;margin:8px 0 2px}
  .rmi{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
  .rm-f1{display:grid;gap:10px}.rm-f1 label{font-size:.85rem;color:var(--mu);display:grid;gap:5px}
  .rm-f1 input[type=text],.rm-f1 input[type=password],.rm-f1 input:not([type]),.rm-f1 textarea{font:inherit;color:#fff;background:var(--inp);border:1.5px solid var(--line);border-radius:12px;padding:11px 12px;width:100%;box-sizing:border-box}
  .rm-ems,.rm-ths{display:flex;flex-wrap:wrap;gap:8px}
  .rm-ems button{width:42px;height:42px;border-radius:12px;border:1.5px solid var(--line);background:#ffffff0a;font-size:1.3rem;cursor:pointer}
  .rm-ems button.on{border-color:var(--cy);background:#ffffff1c}
  .rm-ths button{width:42px;height:42px;border-radius:50%;border:3px solid transparent;cursor:pointer}.rm-ths button.on{border-color:#fff}
  .rm-info{background:#ffffff0d;border-radius:14px;padding:10px 12px;font-size:.86rem;display:grid;gap:3px}.rm-info b{color:var(--am)}
  .rm-sw{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#ffffff0a;border-radius:12px;padding:10px 12px}
  .rm-sw input{width:20px;height:20px;accent-color:var(--cy)}
  .rm-act{font:inherit;color:#fff;border:0;background:#ffffff12;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;width:100%;cursor:pointer;text-align:right}
  .rm-act.r{background:#ef444422;color:#fca5a5}.rm-act.gd{background:#f5a52422;color:#fcd34d}
  .rm-mem{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:12px;cursor:pointer;width:100%;border:0;background:none;color:#fff;font:inherit;text-align:right}
  .rm-mem:active{background:#ffffff12}.rm-mem b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rm-rb{font-size:.68rem;border-radius:99px;padding:1px 8px;font-weight:700}.rm-rb.o{background:#f5a52433;color:#fbbf24}.rm-rb.a{background:#60a5fa33;color:#93c5fd}
  .gf2-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:40vh;overflow-y:auto;padding:2px}
  .gf2-it{font:inherit;color:inherit;display:grid;justify-items:center;gap:1px;padding:10px 4px;border-radius:16px;border:1.5px solid var(--line);background:#ffffff0a;cursor:pointer}
  .gf2-it .em{font-size:2.1rem;line-height:1.2}.gf2-it b{font-size:.82rem}.gf2-it small{color:var(--am);font-size:.74rem}
  .gf2-it.on{border-color:var(--am);background:#f5a52422;box-shadow:0 0 0 2px #f5a52455}.gf2-it.no{opacity:.45}
  .rm-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px}.rm-chips button{flex:none;font:inherit;font-size:.82rem;color:#fff;border:1.5px solid var(--line);background:#ffffff0a;border-radius:99px;padding:6px 12px;cursor:pointer}
  .rm-chips button.on{border-color:var(--am);background:#f5a52433}

  /* ===== الغرفة ===== */
  #rmx{position:fixed;inset:0;z-index:99990;color:#fff;direction:rtl;background:linear-gradient(180deg,var(--t1),var(--t2) 72%);overflow:hidden;padding-top:env(safe-area-inset-top,0px)}
  #rmx.hide{display:none}
  #rmx:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(520px 280px at 85% -8%,#ffffff26,transparent 62%),radial-gradient(460px 300px at -5% 42%,color-mix(in srgb,var(--ac) 22%,transparent),transparent 62%)}
  .rm-in #rmMicW{display:flex;align-items:center;flex:none}.rm-in{position:relative;display:flex;flex-direction:column;height:100%;width:min(520px,100%);margin:0 auto;padding-bottom:var(--kb,0px);box-sizing:border-box}
  .rm-h{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}
  .rm-h .t{flex:1;min-width:0}.rm-h .t b{display:block;font-size:1.08rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rm-h .t small{opacity:.9;font-size:.74rem;display:block;margin-top:2px}#rmSub{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;white-space:nowrap}
  .rm-ib{position:relative;width:40px;height:40px;border-radius:50%;border:0;background:#ffffff1f;color:#fff;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(8px);flex:none;padding:0}
  .rm-ib.r{background:#ef444455}.rm-ib .bd{position:absolute;top:-3px;inset-inline-start:-3px;background:#f59e0b;color:#1f1300;border-radius:99px;font-size:.66rem;font-weight:800;min-width:18px;height:18px;display:grid;place-items:center;padding:0 4px}
  .rm-wel{margin:2px 12px 0;font-size:.8rem;background:#0004;border-radius:12px;padding:7px 12px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rm-seats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 4px;padding:14px 10px 6px}
  .seat{position:relative;display:grid;justify-items:center;gap:5px;border:0;background:none;color:#fff;font:inherit;cursor:pointer;padding:0;min-width:0}
  .seat .av{position:relative;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font-size:1.5rem;font-weight:700;background:linear-gradient(135deg,hsl(var(--hu) 65% 48%),hsl(calc(var(--hu) + 40) 70% 32%));background-size:cover;background-position:center;box-shadow:0 6px 16px #0006}
  .seat .av.e{background:#ffffff14;border:2px dashed #ffffff40;box-shadow:none;color:#ffffffb0}
  .seat .ring{position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--ac);opacity:0;transform:scale(.92)}
  .seat.sp .ring{opacity:1;animation:rmring 1s ease-in-out infinite}
  @keyframes rmring{0%,100%{transform:scale(.94);opacity:.9}50%{transform:scale(1.1);opacity:.35}}
  .seat b{font-size:.74rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2}
  .seat .bg{position:absolute;bottom:20px;inset-inline-end:2px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#111c;border:1.5px solid #ffffff55}
  .seat .bg .rmi{width:13px;height:13px}.seat .bg.o{background:#b45309;color:#fde68a}.seat .bg.m{background:#b91c1c}.seat .bg.a{background:#1d4ed8}
  .seat.gt .av{animation:rmgt .9s ease}@keyframes rmgt{40%{transform:scale(1.18)}}
  .rm-mus{margin:6px 12px 0;display:flex;align-items:center;gap:9px;background:#0005;border-radius:16px;padding:8px 10px;backdrop-filter:blur(8px)}
  .rm-mus .eq{display:flex;gap:2px;align-items:flex-end;height:16px;flex:none}.rm-mus .eq i{width:3px;background:var(--ac);border-radius:2px;height:5px}
  .rm-mus.on .eq i{animation:rmeq .9s ease-in-out infinite}.rm-mus.on .eq i:nth-child(2){animation-delay:.2s}.rm-mus.on .eq i:nth-child(3){animation-delay:.4s}
  @keyframes rmeq{50%{height:16px}}
  .rm-mus span.t{flex:1;min-width:0;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rm-mus button{width:32px;height:32px;border-radius:50%;border:0;background:#ffffff20;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}
  .rm-mus button .rmi{width:16px;height:16px}
  .rm-chat{flex:1;min-height:0;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px;-webkit-mask-image:linear-gradient(transparent,#000 24px);mask-image:linear-gradient(transparent,#000 24px)}
  .cm{align-self:flex-start;max-width:90%;background:#0005;border-radius:14px;padding:6px 11px;font-size:.88rem;line-height:1.5;word-break:break-word;backdrop-filter:blur(6px)}
  .cm .n{font-weight:700;margin-inline-end:6px}.cm .rm-rb{margin-inline-end:5px}
  .cm.s{align-self:center;background:#ffffff14;color:#ffffffcc;font-size:.78rem;padding:3px 12px;border-radius:99px;max-width:96%;text-align:center}
  .rm-f{display:flex;align-items:center;gap:8px;padding:8px 10px calc(10px + env(safe-area-inset-bottom,0px))}
  .rm-f input{flex:1;min-width:0;font:inherit;color:#fff;background:#0006;border:1.5px solid #ffffff30;border-radius:99px;padding:11px 15px;backdrop-filter:blur(6px)}
  .rm-f input::placeholder{color:#ffffff90}
  .rm-f .rm-ib{width:44px;height:44px}.rm-f .go{background:var(--ac);color:#06232a}.rm-f .gf{background:linear-gradient(135deg,#7c3aed,#db2777)}
  .rm-f .mc{background:var(--ac);color:#06232a;width:50px;height:50px}.rm-f .mc.off{background:#ef4444;color:#fff}.rm-f .mc.hd{background:#ffffff24;color:#fff}.rm-f .mc.hd.on{background:#f59e0b;color:#1f1300}
  .rm-gb{position:absolute;bottom:calc(92px + env(safe-area-inset-bottom,0px));left:50%;transform:translate(-50%,30px);opacity:0;z-index:5;pointer-events:none;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7c3aed,#db2777);border:1.5px solid #fbbf2499;border-radius:99px;padding:7px 16px 7px 12px;box-shadow:0 10px 30px #000a;transition:.35s cubic-bezier(.2,.9,.3,1.3);white-space:nowrap;max-width:92vw}
  .rm-gb.on{transform:translate(-50%,0);opacity:1}.rm-gb .em{font-size:1.9rem;line-height:1}.rm-gb span{font-size:.84rem;line-height:1.3}
  .rm-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}
  .rm-fx i{position:absolute;bottom:-60px;font-style:normal;animation:rmup 2.6s ease-out forwards;filter:drop-shadow(0 6px 12px #0009)}
  @keyframes rmup{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-105vh) scale(1.25) rotate(16deg);opacity:0}}
  .rm-big{position:absolute;left:50%;top:38%;font-size:7rem;transform:translate(-50%,-50%) scale(.2);opacity:0;animation:rmbig 2.2s ease forwards;filter:drop-shadow(0 10px 30px #000b)}
  @keyframes rmbig{20%{transform:translate(-50%,-50%) scale(1.15);opacity:1}70%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-70%) scale(1.2);opacity:0}}
  #rmmini{position:fixed;z-index:99989;left:12px;bottom:calc(88px + env(safe-area-inset-bottom,0px));display:none;align-items:center;gap:8px;background:linear-gradient(135deg,var(--t1),var(--t2));border:1.5px solid var(--ac);color:#fff;border-radius:99px;padding:6px 8px 6px 14px;box-shadow:0 8px 26px #000a;cursor:pointer;direction:rtl;max-width:70vw}
  #rmmini.on{display:flex}#rmmini b{font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw}
  #rmmini .rm-ib{width:30px;height:30px}
  .rm-vol{width:100%;accent-color:var(--cy)}
  `;
  document.head.appendChild(css);

  /* ============================== الحالة العامة ============================== */
  const RM = (window.RM = { cfg: null, ice: [], list: [], mine: null, cd: { emoji: EMOJIS[0], theme: 0 }, ed: null, t: 0 });
  let RS = null; // جلسة الغرفة الحالية

  async function loadCfg() { try { const j = await get('/api/rooms/config'); RM.cfg = j.cfg; RM.ice = j.ice || []; } catch (e) {} return RM.cfg; }
  async function loadMine() { const me = idn(); if (!me) return; try { RM.mine = await post('/api/rooms/mine', me); } catch (e) {} }

  const avHtml = (uid, name, av, cls, z) => {
    const img = av ? `background-image:url('/api/soc/avatar/${E(uid)}?v=${av}');color:transparent;` : '';
    return `<span class="${cls}" style="--hu:${hue(uid || name)};${img}${z ? `width:${z}px;height:${z}px` : ''}">${E(String(name || '?').trim().charAt(0) || '?')}</span>`;
  };

  /* ============================== قائمة الرومات ============================== */
  function cardHtml(r) {
    const t = th(r.theme);
    return `<button class="rm-c" style="background:linear-gradient(145deg,${t[0]},${t[1]})" data-rm="open" data-v="${r.id}">
      <span class="em">${E(r.emoji)}</span>
      <div><b>${E(r.name)}</b><small>${E(r.descr || 'ادخل وتحدث مع الجميع')}</small></div>
      <div class="ft"><span style="display:flex;align-items:center;gap:6px;min-width:0">${avHtml(r.ouid, r.owner, r.oav, 'rav')}<small style="margin:0">${E(r.owner || '')}</small></span>
        <span class="rm-pill">${r.locked ? I('lock', 12) : ''}${r.n ? '<i class="rm-live"></i>' : ''}${I('users', 13)}${r.n}</span></div></button>`;
  }
  function listHtml() {
    if (!RM.list.length) return `<div class="rm-empty">${I('mic', 38)}<b>لا توجد رومات نشطة الآن</b>كن أول من ينشئ روماً ويجمع أصدقاءه</div>`;
    return `<div class="rm-g">${RM.list.map(cardHtml).join('')}</div>`;
  }
  function heroHtml() {
    const c = RM.cfg, mine = RM.mine && RM.mine.owned && RM.mine.owned[0];
    return `<div class="rm-hero"><h2>الرومات الصوتية</h2><p>تحدّث مباشرة مع المستخدمين، وارسل الهدايا، واستمتع بالموسيقى.</p><div class="row">
      ${mine ? `<button class="rm-b" data-rm="open" data-v="${mine.id}">${I('mic', 18)} دخول رومي</button><button class="rm-b g" data-rm="mydlg">${I('gear', 18)} إدارة</button>`
        : `<button class="rm-b" data-rm="newdlg">${I('plus', 18)} إنشاء روم${c ? ' · ' + fmt(c.createPrice) + ' نقطة' : ''}</button>`}
    </div></div>`;
  }
  async function loadList() {
    if (S.r !== 'rooms') return;
    try {
      const j = await get('/api/rooms/list');
      RM.list = j.rooms || []; RM.off = j.enabled === false;
      if (!RM.cfg) await loadCfg();
      if (!RM.mine) await loadMine();
      const box = $('#rmList'), hero = $('#rmHero');
      if (hero) hero.innerHTML = heroHtml();
      if (box) box.innerHTML = RM.off ? `<div class="rm-empty"><b>الرومات متوقفة حالياً</b></div>` : listHtml();
    } catch (e) {}
  }
  V.rooms = () => {
    if (!S.acc) return V.welcome();
    setTimeout(loadList, 0);
    return hd('الرومات', 'mic', { l: 1 }) + `<div id="rmHero">${heroHtml()}</div><div id="rmList">${listHtml()}</div>` + nav('rooms');
  };
  setInterval(() => { if (S.r === 'rooms' && !document.hidden) loadList(); }, 7000);

  /* ============================== إنشاء / إدارة الروم ============================== */
  const emojiRow = (cur) => `<div class="rm-ems">${EMOJIS.map((x) => `<button type="button" class="${x === cur ? 'on' : ''}" data-rm="pe" data-v="${x}">${x}</button>`).join('')}</div>`;
  const themeRow = (cur) => `<div class="rm-ths">${THEMES.map((t, i) => `<button type="button" class="${i === cur ? 'on' : ''}" style="background:linear-gradient(135deg,${t[0]},${t[2]})" data-rm="pt" data-v="${i}" aria-label="لون ${i + 1}"></button>`).join('')}</div>`;
  async function newDlg() {
    if (!idn()) return;
    if (S.acc && S.acc.demo) return say('الحساب التجريبي لا يمكنه إنشاء روم');
    const c = RM.cfg || (await loadCfg()); if (!c) return say('تعذر تحميل الإعدادات');
    RM.cd = { emoji: EMOJIS[0], theme: 0 };
    dlg(`<h2 style="margin-top:0">🎙️ إنشاء روم جديد</h2><div class="rm-f1">
      <label>اسم الروم<input id="rmN1" maxlength="40" placeholder="مثال: سهرة الأصدقاء"></label>
      <label>وصف قصير (اختياري)<input id="rmD1" maxlength="120" placeholder="عن ماذا سيتحدث الروم؟"></label>
      <label>الرمز</label><div id="rmE1">${emojiRow(RM.cd.emoji)}</div>
      <label>اللون</label><div id="rmT1">${themeRow(0)}</div>
      <div class="rm-info"><div>سعر الروم: <b>${fmt(c.createPrice)} نقطة</b> (يشمل ${c.baseMics} مايكات)</div><div>مايك إضافي: <b>${fmt(c.micPrice)} نقطة</b> (حتى ${c.maxMics} مايكات)</div><div>رصيدك: <b>${fmt(myPts())} نقطة</b></div>
        <div class="mu" style="font-size:.76rem">تكسب ${c.ownerPct}٪ من كل هدية تُرسل داخل رومك.</div></div>
      <button class="btn" data-rm="docreate">شراء الروم وإنشاؤه</button></div>`);
  }
  async function doCreate(btn) {
    const me = idn(), c = RM.cfg; if (!me || !c) return;
    const name = ($('#rmN1') || {}).value || '';
    if (name.trim().length < 3) return say('اسم الروم قصير (3 أحرف على الأقل)');
    if (myPts() < c.createPrice) return say('رصيد النقاط غير كافٍ');
    btn.disabled = true;
    try {
      const j = await post('/api/rooms/create', { ...me, name, descr: ($('#rmD1') || {}).value || '', emoji: RM.cd.emoji, theme: RM.cd.theme });
      try { $('#d').close(); } catch (e) {}
      await syncBal(); RM.mine = null; say('تم إنشاء رومك 🎉');
      openRoom(j.room.id);
    } catch (e) { say(e.message); btn.disabled = false; }
  }
  async function syncBal() { // تحديث الرصيد المحلي من أوامر السيرفر
    try { const r = await fetch('/api/sync?since=' + (+LS(SYNK, 0) || 0) + '&nocfg=1', { cache: 'no-store' }); const c = await r.json(); if (Array.isArray(c.cmds) && c.cmds.length) applyCmds(c.cmds); } catch (e) {}
  }
  async function myDlg() { // إدارة رومي من القائمة (خارج الغرفة)
    await loadMine(); const m = RM.mine && RM.mine.owned && RM.mine.owned[0]; if (!m) return newDlg();
    editDlg(m);
  }
  function editDlg(r) {
    const c = RM.cfg || {}, live = RS && RS.id === r.id ? RS.st.room : r;
    RM.ed = { id: r.id, emoji: live.emoji || r.emoji, theme: live.theme != null ? live.theme : r.theme, mics: live.mics || r.mics, r };
    dlg(`<h2 style="margin-top:0">⚙️ إعدادات الروم</h2><div class="rm-f1">
      <label>الاسم<input id="rmN2" maxlength="40" value="${E(live.name || r.name)}"></label>
      <label>الوصف<input id="rmD2" maxlength="120" value="${E(live.descr || r.descr || '')}"></label>
      <label>رسالة ترحيب تظهر في أعلى الروم<input id="rmW2" maxlength="160" value="${E(live.welcome || '')}"></label>
      <label>الرمز</label><div id="rmE1">${emojiRow(RM.ed.emoji)}</div>
      <label>اللون</label><div id="rmT1">${themeRow(RM.ed.theme)}</div>
      <label class="rm-sw"><span>مايك مفتوح (يصعد الجميع بلا موافقة)</span><input type="checkbox" id="rmO2" ${live.openMic ? 'checked' : ''}></label>
      <label>رمز دخول سري (اتركه فارغاً لروم عام)<input id="rmP2" maxlength="8" inputmode="numeric" placeholder="${live.locked ? 'الروم مقفل — اكتب رمزاً جديداً أو - للإزالة' : 'مثال: 1234'}"></label>
      <button class="btn" data-rm="esave">حفظ</button>
      <div class="rm-info"><div>المايكات الحالية: <b>${RM.ed.mics}</b> من ${c.maxMics || 8}</div></div>
      <button class="rm-act gd" data-rm="buymic" ${RM.ed.mics >= (c.maxMics || 8) ? 'disabled' : ''}>${I('mic', 18)} شراء مايك إضافي · ${fmt(c.micPrice || 0)} نقطة</button>
      <button class="rm-act r" data-rm="closeroom">${I('power', 18)} إغلاق الروم نهائياً</button></div>`);
  }
  async function saveEdit() {
    const me = idn(), e = RM.ed; if (!me || !e) return;
    const pin = (($('#rmP2') || {}).value || '').trim();
    try {
      await post('/api/rooms/update', { ...me, id: e.id, name: $('#rmN2').value, descr: $('#rmD2').value, welcome: $('#rmW2').value, emoji: e.emoji, theme: e.theme, openMic: $('#rmO2').checked, ...(pin ? { pin: pin === '-' ? '' : pin } : {}) });
      try { $('#d').close(); } catch (x) {} RM.mine = null; say('تم حفظ إعدادات الروم');
    } catch (x) { say(x.message); }
  }
  async function buyMic() {
    const me = idn(), e = RM.ed, c = RM.cfg; if (!me || !e || !c) return;
    if (myPts() < c.micPrice) return say('رصيد النقاط غير كافٍ');
    if (!confirm('شراء مايك إضافي مقابل ' + fmt(c.micPrice) + ' نقطة؟')) return;
    try { const j = await post('/api/rooms/buy-mic', { ...me, id: e.id }); e.mics = j.mics; await syncBal(); say('تمت إضافة مايك جديد 🎤'); editDlg(Object.assign({}, e.r, { mics: j.mics, emoji: e.emoji, theme: e.theme })); } catch (x) { say(x.message); }
  }
  async function closeRoom() {
    const me = idn(), e = RM.ed; if (!me || !e) return;
    if (!confirm('سيُغلق الروم نهائياً ويخرج منه الجميع ولا يمكن استرجاع ما دفعته. متأكد؟')) return;
    try { await post('/api/rooms/close', { ...me, id: e.id }); try { $('#d').close(); } catch (x) {} RM.mine = null; say('تم إغلاق الروم'); if (RS && RS.id === e.id) cleanup(); loadList(); } catch (x) { say(x.message); }
  }

  /* ============================== جلسة الغرفة ============================== */
  async function openRoom(id, pin) {
    const me = idn(); if (!me) return;
    if (RS && RS.id === id) { showRoom(); return; }
    if (RS) await leaveRoom(true);
    let j;
    try { j = await post('/api/rooms/join', { ...me, id, pin: pin || '' }); }
    catch (e) {
      if (e.message === 'pin' || /الرمز/.test(e.message)) {
        dlg(`<h2 style="margin-top:0">🔒 روم مقفل</h2><div class="rm-f1"><label>اكتب رمز الدخول<input id="rmPin" maxlength="8" inputmode="numeric" autofocus></label><button class="btn" data-rm="pin" data-v="${id}">دخول</button></div>`);
        if (pin) say('الرمز غير صحيح');
        return;
      }
      return say(e.message);
    }
    try { $('#d').close(); } catch (e) {}
    if (!RM.cfg) await loadCfg();
    RS = { id, pin: pin || '', tok: j.tok, me: j.me, st: j.state, chat: j.chat || [], es: null, out: {}, inn: {}, ice: {}, local: null, seat: -1, deaf: false, forced: false, selfMute: false,
      ac: null, an: {}, audios: {}, mus: new Audio(), mvol: 0.35, mmute: false, skew: 0, lastMus: '', fail: 0, gone: false };
    RS.mus.loop = true; RS.mus.preload = 'auto'; RS.mus.volume = RS.mvol;
    try { RS.ac = new (window.AudioContext || window.webkitAudioContext)(); RS.ac.resume && RS.ac.resume(); } catch (e) {}
    buildRoom(); connect(); applyState(j.state, true);
    try { RS.lv = setInterval(levels, 110); } catch (e) {}
  }

  function connect() {
    if (!RS) return;
    try { RS.es && RS.es.close(); } catch (e) {}
    const es = (RS.es = new EventSource('/api/rooms/stream?tok=' + encodeURIComponent(RS.tok)));
    const on = (ev, fn) => es.addEventListener(ev, (m) => { try { fn(JSON.parse(m.data || '{}')); } catch (e) {} });
    on('state', (s) => { RS.fail = 0; applyState(s); });
    on('chat', (c) => addChat(c));
    on('gift', (g) => giftFx(g));
    on('sig', (s) => onSig(s));
    on('mute', (m) => { RS.forced = !!m.on; applyMute(); say(m.on ? 'تم كتمك من قِبل المشرف' : 'أُلغي كتمك'); });
    on('unseat', () => say('تم إنزالك من المايك'));
    on('kicked', () => { say('تم طردك من الروم'); cleanup(); });
    on('banned', () => { say('تم حظرك من هذا الروم'); cleanup(); });
    on('closed', () => { say('أُغلق الروم'); cleanup(); });
    on('moved', () => { if (RS) cleanup(); });
    es.onerror = async () => {
      if (!RS || RS.gone) return;
      if (es.readyState === 2) { // رفض السيرفر الجلسة: نحاول الدخول من جديد مرة واحدة
        if (RS.fail++ > 1) { say('انقطع الاتصال بالروم'); return cleanup(); }
        const me = idn(); if (!me) return cleanup();
        try { const j = await post('/api/rooms/join', { ...me, id: RS.id, pin: RS.pin }); RS.tok = j.tok; RS.me = j.me; closeAllPcs(); connect(); applyState(j.state, true); } catch (e) { say(e.message); cleanup(); }
      }
    };
  }

  const act = async (a, x) => {
    if (!RS) return null;
    try { return await post('/api/rooms/act', { tok: RS.tok, a, ...x }); }
    catch (e) { if (a !== 'sig') say(e.message); return null; }
  };
  const mem = (uid) => RS && RS.st.members.find((m) => m.uid === uid);
  const meM = () => mem(RS.me.uid);
  const isMod = () => { const m = RS && meM(); return !!m && (m.role === 'owner' || m.role === 'admin'); };
  const isOwner = () => { const m = RS && meM(); return !!m && m.role === 'owner'; };

  /* ---------- بناء الواجهة ---------- */
  function buildRoom() {
    let x = $('#rmx'); if (x) x.remove();
    x = document.createElement('div'); x.id = 'rmx';
    x.innerHTML = `<div class="rm-in">
      <div class="rm-h"><button class="rm-ib" data-rm="min" aria-label="تصغير">${I('down')}</button>
        <div class="t"><b id="rmTitle"></b><small><span id="rmSub"></span></small></div>
        <button class="rm-ib" data-rm="hands" id="rmHandsB" style="display:none" aria-label="طلبات المايك">${I('hand')}<i class="bd" id="rmHandsN">0</i></button>
        <button class="rm-ib" data-rm="menu" aria-label="الإعدادات">${I('gear', 20)}</button>
        <button class="rm-ib r" data-rm="leave" aria-label="خروج">${I('power', 20)}</button></div>
      <div class="rm-wel" id="rmWel" style="display:none"></div>
      <div class="rm-seats" id="rmSeats"></div>
      <div class="rm-mus" id="rmMus" style="display:none"></div>
      <div class="rm-chat" id="rmChat"></div>
      <div class="rm-f"><button class="rm-ib" data-rm="members" aria-label="المتواجدون">${I('users', 20)}<i class="bd" id="rmN">0</i></button>
        <input id="rmIn" maxlength="300" placeholder="اكتب رسالة…" autocomplete="off"><button class="rm-ib go" data-rm="send" aria-label="إرسال">${I('send', 20)}</button>
        <button class="rm-ib gf" data-rm="gift" aria-label="هدية">${I('gift', 22)}</button><span id="rmMicW"></span></div>
      <div class="rm-gb" id="rmGb"></div><div class="rm-fx" id="rmFx"></div></div>`;
    document.body.appendChild(x);
    let mn = $('#rmmini'); if (!mn) { mn = document.createElement('div'); mn.id = 'rmmini'; document.body.appendChild(mn); }
    mn.classList.remove('on');
    $('#rmChat').innerHTML = ''; RS.chat.forEach((c) => addChat(c, true)); chatEnd(true);
    x.addEventListener('click', () => resumeAudio());
    $('#rmIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
  }
  function showRoom() { const x = $('#rmx'); if (x) x.classList.remove('hide'); const mn = $('#rmmini'); if (mn) mn.classList.remove('on'); resumeAudio(); }
  function minRoom() {
    const x = $('#rmx'); if (x) x.classList.add('hide');
    const mn = $('#rmmini'); if (!mn || !RS) return;
    const t = th(RS.st.room.theme); mn.style.setProperty('--t1', t[0]); mn.style.setProperty('--t2', t[1]); mn.style.setProperty('--ac', t[2]);
    mn.innerHTML = `<span class="rm-live"></span><b>${E(RS.st.room.name)}</b><span class="rm-pill">${I('users', 12)}${RS.st.n}</span><button class="rm-ib r" data-rm="leave" aria-label="خروج">${I('power', 15)}</button>`;
    mn.onclick = (e) => { if (e.target.closest('[data-rm]')) return; showRoom(); };
    mn.classList.add('on');
  }

  function paint() {
    const x = $('#rmx'); if (!x || !RS) return;
    const st = RS.st, r = st.room, t = th(r.theme);
    x.style.setProperty('--t1', t[0]); x.style.setProperty('--t2', t[1]); x.style.setProperty('--ac', t[2]);
    $('#rmTitle').textContent = r.emoji + ' ' + r.name;
    $('#rmSub').innerHTML = `<span class="rm-pill" style="padding:1px 8px">${I('users', 11)}${st.n}</span><span>رقم الروم ${r.id}</span>${r.locked ? I('lock', 12) : ''}${r.openMic ? '<span>🎤 مايك مفتوح</span>' : ''}`;
    $('#rmN').textContent = st.n;
    const w = $('#rmWel'); if (r.welcome) { w.style.display = ''; w.textContent = '📢 ' + r.welcome; } else w.style.display = 'none';
    const hands = st.members.filter((m) => m.hand).length, hb = $('#rmHandsB');
    hb.style.display = isMod() && hands ? '' : 'none'; $('#rmHandsN').textContent = hands;
    // المايكات
    $('#rmSeats').innerHTML = st.mics.map((s, i) => {
      const m = s.uid ? mem(s.uid) : null;
      if (m) {
        const bg = m.role === 'owner' ? `<span class="bg o">${I('crown')}</span>` : m.muted ? `<span class="bg m">${I('micoff')}</span>` : m.role === 'admin' ? `<span class="bg a">${I('shield')}</span>` : '';
        return `<button class="seat" data-rm="seat" data-v="${i}" data-uid="${E(m.uid)}">${avHtml(m.uid, m.name, m.av, 'av')}<i class="ring"></i>${bg}<b>${E(m.name)}</b></button>`;
      }
      if (s.locked) return `<button class="seat" data-rm="seat" data-v="${i}"><span class="av e">${I('lock', 22)}</span><b>مقفل</b></button>`;
      return `<button class="seat" data-rm="seat" data-v="${i}"><span class="av e">${I('plus', 22)}</span><b>${i + 1}</b></button>`;
    }).join('');
    paintMicBtn(); paintMusic();
  }
  function paintMicBtn() {
    const w = $('#rmMicW'); if (!w || !RS) return;
    const st = RS.st, m = meM(), mod = isMod();
    if (RS.seat >= 0) {
      const off = RS.forced || RS.selfMute;
      w.innerHTML = `<button class="rm-ib mc ${off ? 'off' : ''}" data-rm="mute" aria-label="كتم">${I(off ? 'micoff' : 'mic', 24)}</button><button class="rm-ib" style="width:36px;height:36px;margin-inline-start:6px" data-rm="down" aria-label="النزول من المايك">${I('x', 16)}</button>`;
    } else if (mod || st.room.openMic) w.innerHTML = `<button class="rm-ib mc" data-rm="take" aria-label="اصعد">${I('mic', 24)}</button>`;
    else w.innerHTML = `<button class="rm-ib mc hd ${m && m.hand ? 'on' : ''}" data-rm="hand" aria-label="طلب المايك">${I('hand', 24)}</button>`;
  }
  function addChat(c, quiet) {
    const box = $('#rmChat'); if (!box) return;
    if (!quiet) RS.chat.push(c);
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    const d = document.createElement('div');
    if (c.sys) { d.className = 'cm s'; d.textContent = c.text; }
    else {
      d.className = 'cm';
      d.innerHTML = (c.role === 'owner' ? '<span class="rm-rb o">صاحب الروم</span>' : c.role === 'admin' ? '<span class="rm-rb a">مشرف</span>' : '') + `<span class="n" style="color:hsl(${hue(c.uid)} 80% 72%)">${E(c.name)}</span>${E(c.text)}`;
    }
    box.appendChild(d); while (box.children.length > 90) box.firstChild.remove();
    if (!quiet && near) chatEnd();
  }
  function chatEnd(force) { const b = $('#rmChat'); if (b) b.scrollTop = b.scrollHeight; }
  async function sendChat() {
    const i = $('#rmIn'); if (!i) return; const text = i.value.trim(); if (!text) return; i.value = '';
    await act('chat', { text });
  }

  /* ---------- تطبيق الحالة ---------- */
  function applyState(s, first) {
    if (!RS) return;
    RS.st = s; RS.skew = (s.t || Date.now()) - Date.now();
    const m = meM();
    if (!m) { return; }
    RS.me.role = m.role;
    paint();
    const want = m.mic;
    if (want >= 0 && RS.seat < 0) startMic(want);
    else if (want < 0 && RS.seat >= 0) stopMic();
    else RS.seat = want;
    syncPeers();
    applyMusic();
  }

  /* ---------- الصوت: بث المتحدثين لكل الحاضرين (WebRTC) ---------- */
  const pcCfg = () => ({ iceServers: (RM.ice && RM.ice.length ? RM.ice : [{ urls: 'stun:stun.l.google.com:19302' }]), bundlePolicy: 'max-bundle' });
  const sig = (to, d) => act('sig', { to, d });
  const newId = () => Math.random().toString(36).slice(2, 9);

  async function startMic(slot) {
    if (!RS) return;
    RS.seat = slot;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say('المتصفح لا يدعم المايك (يلزم رابط https)'); RS.seat = -1; act('mic_leave'); return; }
    try {
      RS.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
    } catch (e) { RS.seat = -1; RS.local = null; say('اسمح للمتصفح باستخدام المايك ثم حاول مجدداً'); act('mic_leave'); paint(); return; }
    if (!RS || RS.seat < 0) { try { RS && RS.local && RS.local.getTracks().forEach((t) => t.stop()); } catch (e) {} if (RS) RS.local = null; return; }
    applyMute(); watch(RS.me.uid, RS.local, true); say('أنت الآن على المايك 🎤'); paintMicBtn(); syncPeers();
  }
  function stopMic() {
    if (!RS) return;
    Object.keys(RS.out).forEach(closeOut);
    try { RS.local && RS.local.getTracks().forEach((t) => t.stop()); } catch (e) {}
    RS.local = null; RS.seat = -1; unwatch(RS.me.uid); paintMicBtn();
  }
  function applyMute() {
    if (!RS || !RS.local) return;
    RS.local.getAudioTracks().forEach((t) => { t.enabled = !(RS.forced || RS.selfMute); });
    paintMicBtn();
  }
  function closeOut(uid) { const o = RS.out[uid]; if (o) { try { o.pc.close(); } catch (e) {} delete RS.out[uid]; } }
  function closeIn(uid) { const o = RS.inn[uid]; if (o) { try { o.pc.close(); } catch (e) {} delete RS.inn[uid]; } const a = RS.audios[uid]; if (a) { try { a.srcObject = null; a.remove(); } catch (e) {} delete RS.audios[uid]; } unwatch(uid); }
  function closeAllPcs() { if (!RS) return; Object.keys(RS.out).forEach(closeOut); Object.keys(RS.inn).forEach(closeIn); }

  function syncPeers() {
    if (!RS) return;
    const st = RS.st, ids = new Set(st.members.map((m) => m.uid)), spk = new Set(st.members.filter((m) => m.mic >= 0).map((m) => m.uid));
    // استقبال: نغلق ما لم يعد متحدثاً
    Object.keys(RS.inn).forEach((u) => { if ((!spk.has(u) || !ids.has(u)) && Date.now() - RS.inn[u].t > 4000) closeIn(u); });
    // إرسال (إن كنت على المايك): اتصال بكل حاضر
    if (RS.local && RS.seat >= 0) {
      Object.keys(RS.out).forEach((u) => { const m = mem(u); if (!m || RS.out[u].j !== m.j) closeOut(u); });
      st.members.forEach((m) => { if (m.uid !== RS.me.uid && !RS.out[m.uid]) makeOut(m); });
    }
  }
  async function makeOut(m) {
    if (!RS || !RS.local) return;
    const uid = m.uid, cid = newId(), pc = new RTCPeerConnection(pcCfg());
    const o = (RS.out[uid] = { pc, cid, j: m.j, q: [] });
    RS.local.getAudioTracks().forEach((t) => pc.addTrack(t, RS.local));
    try { const s = pc.getSenders()[0]; if (s && s.getParameters) { const p = s.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 28000; s.setParameters(p).catch(() => {}); } } catch (e) {}
    pc.onicecandidate = (e) => { if (e.candidate) sig(uid, { k: 'ice', c: cid, cand: e.candidate }); };
    pc.onconnectionstatechange = () => {
      if (!RS || RS.out[uid] !== o) return;
      if (pc.connectionState === 'failed') { closeOut(uid); setTimeout(() => { if (RS && RS.local && !RS.out[uid]) { const mm = mem(uid); if (mm) makeOut(mm); } }, 1500); }
    };
    try { const off = await pc.createOffer(); await pc.setLocalDescription(off); sig(uid, { k: 'offer', c: cid, sdp: pc.localDescription }); } catch (e) { closeOut(uid); }
  }
  async function onSig(s) {
    if (!RS) return;
    const d = s.d || {}, from = s.from;
    try {
      if (d.k === 'offer') {
        closeIn(from);
        const pc = new RTCPeerConnection(pcCfg()), o = (RS.inn[from] = { pc, cid: d.c, q: [], t: Date.now() });
        pc.onicecandidate = (e) => { if (e.candidate) sig(from, { k: 'ice', c: d.c, cand: e.candidate }); };
        pc.ontrack = (e) => attachAudio(from, e.streams[0] || new MediaStream([e.track]));
        pc.onconnectionstatechange = () => { if (RS && RS.inn[from] === o && pc.connectionState === 'failed') closeIn(from); };
        await pc.setRemoteDescription(d.sdp);
        o.q.splice(0).forEach((c) => pc.addIceCandidate(c).catch(() => {}));
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
        sig(from, { k: 'answer', c: d.c, sdp: pc.localDescription });
      } else if (d.k === 'answer') {
        const o = RS.out[from]; if (!o || o.cid !== d.c) return;
        await o.pc.setRemoteDescription(d.sdp); o.q.splice(0).forEach((c) => o.pc.addIceCandidate(c).catch(() => {}));
      } else if (d.k === 'ice') {
        const o = (RS.out[from] && RS.out[from].cid === d.c ? RS.out[from] : null) || (RS.inn[from] && RS.inn[from].cid === d.c ? RS.inn[from] : null);
        if (!o) return;
        if (o.pc.remoteDescription) o.pc.addIceCandidate(d.cand).catch(() => {}); else o.q.push(d.cand);
      }
    } catch (e) { /* تفاوض فاشل: سيُعاد عند تغير الحالة */ }
  }
  function attachAudio(uid, stream) {
    let a = RS.audios[uid];
    if (!a) { a = document.createElement('audio'); a.autoplay = true; a.playsInline = true; a.style.display = 'none'; $('#rmx').appendChild(a); RS.audios[uid] = a; }
    a.srcObject = stream; a.muted = RS.deaf;
    const p = a.play(); if (p && p.catch) p.catch(() => { RS.blocked = true; });
    watch(uid, stream, false);
  }
  function resumeAudio() {
    if (!RS) return;
    try { RS.ac && RS.ac.state === 'suspended' && RS.ac.resume(); } catch (e) {}
    Object.values(RS.audios).forEach((a) => { const p = a.play(); if (p && p.catch) p.catch(() => {}); });
    if (RS.mus && RS.mus.src && RS.st.room.music.playing && RS.mus.paused) RS.mus.play().catch(() => {});
  }
  function setDeaf(on) { RS.deaf = on; Object.values(RS.audios).forEach((a) => { a.muted = on; }); }

  /* ---------- كشف من يتكلم (حلقة حول الصورة) ---------- */
  function watch(uid, stream, local) {
    if (!RS || !RS.ac) return; unwatch(uid);
    try { const src = RS.ac.createMediaStreamSource(stream), an = RS.ac.createAnalyser(); an.fftSize = 512; src.connect(an); RS.an[uid] = { an, src, buf: new Uint8Array(an.fftSize), local }; } catch (e) {}
  }
  function unwatch(uid) { const w = RS && RS.an[uid]; if (w) { try { w.src.disconnect(); } catch (e) {} delete RS.an[uid]; } }
  function levels() {
    if (!RS) return;
    Object.keys(RS.an).forEach((uid) => {
      const w = RS.an[uid]; let on = false;
      try { w.an.getByteTimeDomainData(w.buf); let s = 0; for (let i = 0; i < w.buf.length; i++) { const v = (w.buf[i] - 128) / 128; s += v * v; } on = Math.sqrt(s / w.buf.length) > 0.035; } catch (e) {}
      if (w.local && (RS.forced || RS.selfMute)) on = false;
      const el = document.querySelector(`#rmSeats .seat[data-uid="${uid}"]`); if (el) el.classList.toggle('sp', on);
    });
  }

  /* ---------- الموسيقى الخلفية (متزامنة) ---------- */
  function applyMusic() {
    if (!RS) return;
    const m = RS.st.room.music || {}, a = RS.mus;
    if (!m.url) { if (!a.paused) a.pause(); a.removeAttribute('src'); RS.lastMus = ''; return; }
    if (RS.lastMus !== m.url) { RS.lastMus = m.url; a.src = m.url; }
    a.volume = RS.mmute ? 0 : RS.mvol;
    if (m.playing) {
      const pos = m.pos + (Date.now() + RS.skew - m.ts) / 1000;
      const go = () => { try { const dur = a.duration; const t = isFinite(dur) && dur > 0 ? pos % dur : pos; if (Math.abs(a.currentTime - t) > 2.5) a.currentTime = Math.max(0, t); } catch (e) {} };
      if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
      if (a.paused) a.play().catch(() => { RS.blocked = true; });
    } else if (!a.paused) a.pause();
  }
  function paintMusic() {
    const box = $('#rmMus'); if (!box || !RS) return;
    const m = RS.st.room.music || {}, mod = isMod();
    if (!m.url) { box.style.display = mod ? '' : 'none'; box.className = 'rm-mus'; box.innerHTML = mod ? `<span class="eq"><i></i><i></i><i></i></span><span class="t" style="opacity:.8">لا توجد موسيقى — أضف موسيقى خلفية للروم</span><button data-rm="music" aria-label="موسيقى">${I('plus')}</button>` : ''; return; }
    box.style.display = ''; box.className = 'rm-mus' + (m.playing ? ' on' : '');
    box.innerHTML = `<span class="eq"><i></i><i></i><i></i></span><span class="t">🎵 ${E(m.title || 'موسيقى')}</span>
      <button data-rm="mmute" aria-label="كتم الموسيقى">${I(RS.mmute ? 'voloff' : 'vol')}</button>
      ${mod ? `<button data-rm="mtoggle" aria-label="تشغيل/إيقاف">${I(m.playing ? 'pause' : 'play')}</button><button data-rm="music" aria-label="تغيير">${I('music')}</button>` : ''}`;
  }
  async function musicDlg() {
    let tracks = []; try { tracks = (await get('/api/rooms/music')).tracks || []; } catch (e) {}
    RS.tracks = tracks;
    dlg(`<h2 style="margin-top:0">🎵 موسيقى الروم</h2><div class="rm-f1">
      ${tracks.length ? `<label>من مكتبة التطبيق</label>${tracks.map((t, i) => `<button class="rm-act" data-rm="mplay" data-v="${i}">${I('play', 18)} ${E(t.title)}</button>`).join('')}` : '<div class="mu" style="font-size:.85rem">لا توجد مقاطع في مكتبة التطبيق بعد. يمكنك إضافة رابط مباشر.</div>'}
      <label>أو رابط مقطع صوتي مباشر (https://… .mp3)<input id="rmMu" placeholder="https://example.com/song.mp3" style="direction:ltr"></label>
      <label>اسم المقطع<input id="rmMt" maxlength="60" placeholder="اسم يظهر للجميع"></label>
      <button class="btn" data-rm="mcustom">تشغيل الرابط</button>
      <button class="rm-act r" data-rm="mstop">إيقاف الموسيقى وإزالتها</button>
      <div class="mu" style="font-size:.74rem">استخدم موسيقى مسموح لك باستخدامها. تُشغَّل للجميع بشكل متزامن ويستطيع كل شخص كتمها أو خفض صوتها لنفسه.</div></div>`);
  }

  /* ---------- الهدايا ---------- */
  async function giftDlg(toUid) {
    if (!RS) return; if (S.acc && S.acc.demo) return say('الحساب التجريبي لا يمكنه إرسال الهدايا');
    let j; try { j = await get('/api/gifts/list'); } catch (e) { return say('تعذر تحميل الهدايا'); }
    if (!j.enabled || !(j.gifts || []).length) return say('الهدايا غير متاحة الآن');
    const c = RM.cfg || {}, st = RS.st;
    RS.g = { list: j.gifts, max: j.maxQty || 10, sel: 0, qty: 1, to: toUid || '', busy: false };
    const spk = st.members.filter((m) => m.mic >= 0 && m.uid !== RS.me.uid);
    dlg(`<h2 style="margin-top:0">🎁 هدية للروم</h2>
      <div class="rm-chips" id="rmTo"><button class="${RS.g.to ? '' : 'on'}" data-rm="gto" data-v="">الروم كله</button>${spk.map((m) => `<button class="${RS.g.to === m.uid ? 'on' : ''}" data-rm="gto" data-v="${E(m.uid)}">${E(m.name)}</button>`).join('')}</div>
      <div class="rm-info" style="margin-bottom:8px"><div>رصيدك: <b>${fmt(myPts())} نقطة</b></div><div style="font-size:.78rem;color:var(--mu)">${c.ownerPct || 0}٪ لصاحب الروم · ${c.audPct || 0}٪ توزَّع بين المتواجدين في الروم</div></div>
      <div class="gf2-grid">${j.gifts.map((g) => `<button type="button" class="gf2-it ${g.price > myPts() ? 'no' : ''}" data-rm="gpick" data-v="${g.id}"><span class="em">${E(g.emoji)}</span><b>${E(g.name)}</b><small>${fmt(g.price)}</small></button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><div class="rm-sw" style="padding:4px 6px;gap:8px"><button type="button" class="rm-ib" style="width:34px;height:34px" data-rm="gq" data-v="1">${I('plus', 16)}</button><b id="rmQ">1</b><button type="button" class="rm-ib" style="width:34px;height:34px" data-rm="gq" data-v="-1">−</button></div><button class="btn" id="rmGs" data-rm="gsend" style="flex:1;margin:0" disabled>اختر هدية</button></div>`);
  }
  function gPaint() {
    const g = RS && RS.g; if (!g) return; const it = g.list.find((x) => x.id === g.sel), bal = myPts();
    document.querySelectorAll('.gf2-it').forEach((b) => b.classList.toggle('on', +b.dataset.v === g.sel));
    document.querySelectorAll('#rmTo button').forEach((b) => b.classList.toggle('on', (b.dataset.v || '') === g.to));
    const q = $('#rmQ'); if (q) q.textContent = g.qty;
    const btn = $('#rmGs'); if (btn) { const t = it ? it.price * g.qty : 0; btn.disabled = !it || g.busy; btn.innerHTML = it ? `إرسال ${E(it.emoji)} · ${fmt(t)} نقطة` : 'اختر هدية'; btn.style.opacity = it && t <= bal ? '' : '.55'; }
  }
  async function giftSend() {
    const g = RS && RS.g; if (!g || g.busy) return; const it = g.list.find((x) => x.id === g.sel); if (!it) return;
    if (myPts() < it.price * g.qty) return say('رصيد النقاط غير كافٍ');
    g.busy = true; gPaint();
    try { await post('/api/rooms/gift', { tok: RS.tok, gift: it.id, qty: g.qty, to: g.to }); try { $('#d').close(); } catch (e) {} await syncBal(); }
    catch (e) { say(e.message); }
    g.busy = false; gPaint();
  }
  function giftFx(g) {
    const x = $('#rmx'); if (!x) return;
    const gb = $('#rmGb'), fx = $('#rmFx');
    if (gb) { gb.innerHTML = `<span class="em">${E(g.emoji)}</span><span><b>${E(g.fromName)}</b> أرسل ${E(g.name)}${g.qty > 1 ? ' ×' + g.qty : ''}${g.toName ? '<br>إلى ' + E(g.toName) : ''}</span>`; gb.classList.add('on'); clearTimeout(gb._t); gb._t = setTimeout(() => gb.classList.remove('on'), 3200); }
    if (fx) {
      const n = g.total >= 100000 ? 16 : g.total >= 10000 ? 9 : 5;
      for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.textContent = g.emoji; e.style.left = 4 + Math.random() * 88 + '%'; e.style.fontSize = 28 + Math.random() * 40 + 'px'; e.style.animationDelay = Math.random() * 0.6 + 's'; fx.append(e); setTimeout(() => e.remove(), 3400); }
      if (g.total >= 100000) { const b = document.createElement('div'); b.className = 'rm-big'; b.textContent = g.emoji; fx.append(b); setTimeout(() => b.remove(), 2400); }
    }
    if (g.to) { const el = document.querySelector(`#rmSeats .seat[data-uid="${g.to}"]`); if (el) { el.classList.add('gt'); setTimeout(() => el.classList.remove('gt'), 1000); } }
    try { navigator.vibrate && navigator.vibrate(g.total >= 100000 ? [60, 40, 90] : 40); } catch (e) {}
  }

  /* ---------- القوائم: المتواجدون / عضو / مقعد / الإعدادات ---------- */
  const rb = (r) => (r === 'owner' ? '<span class="rm-rb o">صاحب الروم</span>' : r === 'admin' ? '<span class="rm-rb a">مشرف</span>' : '');
  function membersDlg(onlyHands) {
    if (!RS) return; const st = RS.st, mod = isMod();
    const list = st.members.slice().sort((a, b) => (b.hand - a.hand) || ({ owner: 0, admin: 1, member: 2 }[a.role] - { owner: 0, admin: 1, member: 2 }[b.role]));
    dlg(`<h2 style="margin-top:0">👥 المتواجدون (${st.n})</h2><div style="max-height:62vh;overflow-y:auto">${list.map((m) => `<button class="rm-mem" data-rm="mem" data-v="${E(m.uid)}">${avHtml(m.uid, m.name, m.av, 'rav', 40)}<b>${E(m.name)}</b>${rb(m.role)}${m.hand ? `<span class="rm-pill" style="background:#f59e0b44">${I('hand', 14)} يطلب المايك</span>` : ''}${m.mic >= 0 ? I('mic', 16) : ''}</button>`).join('')}</div>`);
  }
  function memDlg(uid) {
    const m = mem(uid); if (!m || !RS) return; const mod = isMod(), owner = isOwner(), self = uid === RS.me.uid;
    const canCtl = mod && !self && m.role !== 'owner' && (owner || m.role !== 'admin');
    dlg(`<div style="text-align:center;margin-bottom:12px">${avHtml(m.uid, m.name, m.av, 'rav', 64)}<h3 style="margin:8px 0 2px">${E(m.name)}</h3>${rb(m.role)}</div><div class="rm-f1">
      ${!self ? `<button class="rm-act gd" data-rm="giftto" data-v="${E(uid)}">${I('gift', 18)} إرسال هدية</button>` : ''}
      ${self && m.mic >= 0 ? `<button class="rm-act" data-rm="down">${I('down', 18)} النزول من المايك</button>` : ''}
      ${mod && m.mic < 0 ? `<button class="rm-act" data-rm="up" data-v="${E(uid)}">${I('mic', 18)} إصعاده إلى المايك</button>` : ''}
      ${canCtl && m.mic >= 0 ? `<button class="rm-act" data-rm="down" data-v="${E(uid)}">${I('down', 18)} إنزاله من المايك</button><button class="rm-act" data-rm="mmuteu" data-v="${E(uid)}" data-on="${m.muted ? 0 : 1}">${I(m.muted ? 'mic' : 'micoff', 18)} ${m.muted ? 'إلغاء الكتم' : 'كتمه'}</button>` : ''}
      ${owner && !self && m.role !== 'owner' ? `<button class="rm-act" data-rm="adm" data-v="${E(uid)}" data-on="${m.role === 'admin' ? 0 : 1}">${I('shield', 18)} ${m.role === 'admin' ? 'إزالة الإشراف' : 'تعيينه مشرفاً'}</button>` : ''}
      ${canCtl ? `<button class="rm-act r" data-rm="kick" data-v="${E(uid)}">${I('x', 18)} طرد من الروم</button><button class="rm-act r" data-rm="ban" data-v="${E(uid)}">${I('ban', 18)} حظر من الروم</button>` : ''}</div>`);
  }
  function seatDlg(i) {
    if (!RS) return; const st = RS.st, s = st.mics[i], mod = isMod(), m = s.uid ? mem(s.uid) : null;
    if (m) return memDlg(m.uid);
    if (s.locked) { if (!mod) return say('هذا المايك مقفل'); return dlg(`<h3 style="margin-top:0">المايك ${i + 1} مقفل</h3><button class="rm-act" data-rm="lock" data-v="${i}" data-on="0">${I('lock', 18)} فتح المايك</button>`); }
    if (mod) {
      const others = st.members.filter((x) => x.mic < 0);
      return dlg(`<h3 style="margin-top:0">المايك ${i + 1}</h3><div class="rm-f1">
        <button class="rm-act" data-rm="takeslot" data-v="${i}">${I('mic', 18)} اصعد أنت هنا</button>
        <button class="rm-act" data-rm="lock" data-v="${i}" data-on="1">${I('lock', 18)} قفل المايك</button>
        ${others.length ? `<label style="font-size:.85rem;color:var(--mu)">أو أصعد عضواً:</label><div style="max-height:36vh;overflow-y:auto">${others.map((o) => `<button class="rm-mem" data-rm="upslot" data-v="${E(o.uid)}" data-s="${i}">${avHtml(o.uid, o.name, o.av, 'rav', 36)}<b>${E(o.name)}</b>${o.hand ? '<span class="rm-pill" style="background:#f59e0b44">✋</span>' : ''}</button>`).join('')}</div>` : ''}</div>`);
    }
    if (st.room.openMic) return act('mic_take', { slot: i });
    const me = meM(); act('hand', { on: !(me && me.hand) }); say(me && me.hand ? 'تم إلغاء طلب المايك' : 'تم إرسال طلبك لصاحب الروم ✋');
  }
  function menuDlg() {
    if (!RS) return; const mod = isMod(), owner = isOwner();
    dlg(`<h2 style="margin-top:0">${E(RS.st.room.emoji)} ${E(RS.st.room.name)}</h2><div class="rm-f1">
      <label class="rm-sw"><span>${I(RS.deaf ? 'voloff' : 'vol', 18)} كتم أصوات المتحدثين لدي</span><input type="checkbox" id="rmDf" ${RS.deaf ? 'checked' : ''}></label>
      <label>صوت الموسيقى لدي<input type="range" class="rm-vol" id="rmVol" min="0" max="100" value="${Math.round(RS.mvol * 100)}"></label>
      <label class="rm-sw"><span>${I('voloff', 18)} كتم الموسيقى لدي</span><input type="checkbox" id="rmMm" ${RS.mmute ? 'checked' : ''}></label>
      ${mod ? `<button class="rm-act" data-rm="music">${I('music', 18)} موسيقى الروم</button>` : ''}
      ${owner ? `<button class="rm-act gd" data-rm="editroom">${I('gear', 18)} تعديل الروم وشراء المايكات</button>` : ''}
      <button class="rm-act r" data-rm="leave">${I('power', 18)} مغادرة الروم</button></div>`);
  }

  /* ---------- الخروج ---------- */
  function cleanup() {
    const rs = RS; if (!rs) return; rs.gone = true; RS = null;
    try { clearInterval(rs.lv); rs.es && rs.es.close(); } catch (e) {}
    try { Object.values(rs.out).forEach((o) => o.pc.close()); Object.values(rs.inn).forEach((o) => o.pc.close()); } catch (e) {}
    try { rs.local && rs.local.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { rs.mus.pause(); rs.mus.removeAttribute('src'); } catch (e) {}
    try { Object.values(rs.audios).forEach((a) => { a.srcObject = null; }); rs.ac && rs.ac.close(); } catch (e) {}
    const x = $('#rmx'); if (x) x.remove(); const mn = $('#rmmini'); if (mn) mn.classList.remove('on');
    try { if (S.r === 'rooms') loadList(); } catch (e) {}
  }
  async function leaveRoom(quiet) {
    const rs = RS; if (!rs) return;
    try { await fetch('/api/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tok: rs.tok }), keepalive: true }); } catch (e) {}
    cleanup(); if (!quiet) { try { $('#d').close(); } catch (e) {} }
  }
  window.addEventListener('pagehide', () => { if (RS) { try { navigator.sendBeacon('/api/rooms/leave', new Blob([JSON.stringify({ tok: RS.tok })], { type: 'application/json' })); } catch (e) {} } });

  /* ============================== الأوامر (نقرات) ============================== */
  async function handle(a, v, b) {
    switch (a) {
      case 'open': return openRoom(+v);
      case 'pin': { const p = (($('#rmPin') || {}).value || '').trim(); return openRoom(+v, p); }
      case 'newdlg': return newDlg();
      case 'mydlg': return myDlg();
      case 'pe': RM.cd.emoji = v; if (RM.ed) RM.ed.emoji = v; document.querySelectorAll('#rmE1 button').forEach((x) => x.classList.toggle('on', x.dataset.v === v)); return;
      case 'pt': RM.cd.theme = +v; if (RM.ed) RM.ed.theme = +v; document.querySelectorAll('#rmT1 button').forEach((x) => x.classList.toggle('on', +x.dataset.v === +v)); return;
      case 'docreate': return doCreate(b);
      case 'esave': return saveEdit();
      case 'buymic': return buyMic();
      case 'closeroom': return closeRoom();
      case 'editroom': { const r = { id: RS.id, name: RS.st.room.name, descr: RS.st.room.descr, emoji: RS.st.room.emoji, theme: RS.st.room.theme, mics: RS.st.room.mics }; if (!RM.cfg) await loadCfg(); return editDlg(r); }
      case 'min': return minRoom();
      case 'leave': return leaveRoom();
      case 'menu': return menuDlg();
      case 'members': return membersDlg();
      case 'hands': return membersDlg(true);
      case 'send': return sendChat();
      case 'gift': return giftDlg();
      case 'giftto': try { $('#d').close(); } catch (e) {} return giftDlg(v);
      case 'gpick': RS.g.sel = +v; return gPaint();
      case 'gq': RS.g.qty = Math.max(1, Math.min(RS.g.max, RS.g.qty + +v)); return gPaint();
      case 'gto': RS.g.to = v || ''; return gPaint();
      case 'gsend': return giftSend();
      case 'mute': RS.selfMute = !RS.selfMute; if (RS.forced) say('كتمك المشرف ولا يمكنك فتح المايك الآن'); return applyMute();
      case 'take': { const r = await act('mic_take', {}); return r; }
      case 'hand': { const me = meM(); const r = await act('hand', { on: !(me && me.hand) }); if (r && me && !me.hand) say('تم إرسال طلبك لصاحب الروم ✋'); return; }
      case 'seat': return seatDlg(+v);
      case 'mem': return memDlg(v);
      case 'up': try { $('#d').close(); } catch (e) {} return act('mod_up', { uid: v });
      case 'upslot': try { $('#d').close(); } catch (e) {} return act('mod_up', { uid: v, slot: +b.dataset.s });
      case 'takeslot': try { $('#d').close(); } catch (e) {} return act('mic_take', { slot: +v });
      case 'down': try { $('#d').close(); } catch (e) {} return v ? act('mod_down', { uid: v }) : act('mic_leave', {});
      case 'mmuteu': try { $('#d').close(); } catch (e) {} return act('mod_mute', { uid: v, on: b.dataset.on === '1' });
      case 'adm': try { $('#d').close(); } catch (e) {} return act('mod_admin', { uid: v, on: b.dataset.on === '1' });
      case 'lock': try { $('#d').close(); } catch (e) {} return act('mod_lock', { slot: +v, on: b.dataset.on === '1' });
      case 'kick': if (!confirm('طرد هذا المستخدم من الروم؟')) return; try { $('#d').close(); } catch (e) {} return act('mod_kick', { uid: v, ban: false });
      case 'ban': if (!confirm('حظر هذا المستخدم من الروم نهائياً؟')) return; try { $('#d').close(); } catch (e) {} return act('mod_kick', { uid: v, ban: true });
      case 'music': return musicDlg();
      case 'mplay': { const t = (RS.tracks || [])[+v]; if (!t) return; try { $('#d').close(); } catch (e) {} return act('music', { op: 'play', url: t.url, title: t.title }); }
      case 'mcustom': { const url = (($('#rmMu') || {}).value || '').trim(), title = (($('#rmMt') || {}).value || '').trim(); if (!url) return say('ألصق رابط المقطع'); const r = await act('music', { op: 'play', url, title }); if (r) { try { $('#d').close(); } catch (e) {} } return; }
      case 'mstop': try { $('#d').close(); } catch (e) {} return act('music', { op: 'stop' });
      case 'mtoggle': return act('music', { op: RS.st.room.music.playing ? 'pause' : 'play' });
      case 'mmute': RS.mmute = !RS.mmute; RS.mus.volume = RS.mmute ? 0 : RS.mvol; return paintMusic();
    }
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-rm]'); if (!b || b.disabled) return;
    ev.stopPropagation(); ev.preventDefault();
    Promise.resolve(handle(b.dataset.rm, b.dataset.v, b)).catch((e) => console.error('rooms', e));
  }, true);
  document.addEventListener('change', (ev) => {
    if (!RS) return; const t = ev.target;
    if (t.id === 'rmDf') setDeaf(t.checked);
    if (t.id === 'rmMm') { RS.mmute = t.checked; RS.mus.volume = RS.mmute ? 0 : RS.mvol; paintMusic(); }
  });
  document.addEventListener('input', (ev) => { if (RS && ev.target.id === 'rmVol') { RS.mvol = ev.target.value / 100; if (!RS.mmute) RS.mus.volume = RS.mvol; } });
  window.RMX = { open: openRoom, leave: leaveRoom, inRoom: () => !!RS };
})();

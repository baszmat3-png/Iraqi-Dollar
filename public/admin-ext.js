/* لوحة الإدارة المتقدمة: المستخدمون · البلاغات · الدعم · الأسئلة الشائعة (تعمل على السيرفر) */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = () => { try { return JSON.parse(localStorage.getItem('adminkey')) || ''; } catch (e) { return localStorage.getItem('adminkey') || ''; } };
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const dt = (t) => new Date(t).toLocaleString('ar-IQ');
  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'X-Admin-Key': key(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
    return j;
  }
  const shrink = (file, max = 1000) => new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onerror = no;
    fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75));
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });

  const css = document.createElement('style');
  css.textContent = `
#axb{position:fixed;bottom:18px;inset-inline-start:16px;z-index:9998;display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#00b6d4,#2bcfe2);color:#04222a;border:0;border-radius:99px;padding:12px 20px;font:700 15px Cairo,Tahoma,sans-serif;box-shadow:0 8px 26px #2bcfe255,0 2px 8px #000a;cursor:pointer}
#axb i{background:#ef5350;color:#fff;border-radius:99px;padding:1px 8px;font-style:normal;font-size:12px}#axb svg{width:20px;height:20px}
#axo{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#fff;background:radial-gradient(circle at 1px 1px,#ffffff10 1px,transparent 0) 0 0/28px 28px,#0E1621;font-size:15px;line-height:1.6}
#axo.on{display:flex}#axo *{box-sizing:border-box}
#axo .axh{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 10px;border-bottom:1px solid #ffffff0d;background:#0E1621ee}
#axo .axh h1{margin:0;font-size:1.35rem;flex:1;font-weight:700}#axo .axh .ci{width:42px;height:42px;border-radius:50%;background:hsl(193 55% 17%);color:#2bcfe2;display:grid;place-items:center}
#axo .axx{width:42px;height:42px;border-radius:13px;border:1.5px solid #27566b;background:hsl(193 58% 20%);color:#2bcfe2;display:grid;place-items:center;cursor:pointer;padding:0}
#axo svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#axo .axn{display:flex;gap:8px;padding:10px 12px;overflow-x:auto;border-bottom:1px solid #ffffff0d;scrollbar-width:none}#axo .axn::-webkit-scrollbar{display:none}
#axo .axn button{flex:none;display:flex;align-items:center;gap:7px;font:inherit;font-weight:600;border:1.5px solid #27566b;background:hsl(193 58% 17%);color:#2bcfe2;border-radius:99px;padding:7px 16px;cursor:pointer;white-space:nowrap}
#axo .axn button.on{background:#2bcfe2;color:#04222a;border-color:#2bcfe2}#axo .axn button svg{width:17px;height:17px}
#axo .axn button i{font-style:normal;background:#ef5350;color:#fff;border-radius:99px;font-size:.72rem;padding:0 7px;min-width:19px;text-align:center}
#axm{flex:1;overflow:auto;padding:14px 14px calc(30px + env(safe-area-inset-bottom,0px));max-width:880px;width:100%;margin:0 auto}
#axo .c{background:#1F2A37;border:1.5px solid #27566b;border-radius:22px;padding:14px;margin-bottom:12px}
#axo .c.hero{background:linear-gradient(135deg,hsl(187 67% 38%),hsl(187 74% 25%));border-color:hsl(187 63% 50%)}
#axo .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#axo .g{flex:1;min-width:0}
#axo .mu{color:#9AA9B5;font-size:.85rem}
#axo .b,#axo header button{font:inherit;font-weight:700;border:1.5px solid #2c4658;background:#1c2a36;color:#e8eef5;border-radius:14px;padding:9px 15px;cursor:pointer;white-space:nowrap}
#axo .b.p{background:linear-gradient(90deg,#00b6d4,#2bcfe2);color:#04222a;border-color:transparent;box-shadow:0 6px 18px #2bcfe233}
#axo .b.ok{background:linear-gradient(90deg,#1f9d55,#3ddc68);color:#06210f;border-color:transparent}
#axo .b.d{color:#ff7a75;background:#3a2025;border-color:#7a3a3a}#axo .b.s{padding:6px 12px;font-size:.85rem;border-radius:11px}
#axo .b:active{transform:scale(.97)}
#axo input,#axo textarea,#axo select{width:100%;background:#0b141c;color:#fff;border:1.5px solid #27566b;border-radius:16px;padding:12px 14px;margin:5px 0;font:inherit}
#axo input:focus,#axo textarea:focus,#axo select:focus{outline:0;border-color:#2bcfe2;box-shadow:0 0 0 3px #2bcfe229}
#axo input[type=checkbox]{width:22px;height:22px;margin:0;accent-color:#2bcfe2;flex:none}
#axo .kg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
@media(min-width:640px){#axo .kg{grid-template-columns:repeat(3,1fr)}}
#axo .k{background:linear-gradient(160deg,hsl(193 50% 21%),hsl(193 45% 15%));border:1.5px solid #27566b;border-radius:20px;padding:12px 14px}
#axo .k small{display:flex;align-items:center;gap:6px;color:#9AA9B5;font-size:.8rem}#axo .k small svg{width:16px;height:16px;color:#2bcfe2}
#axo .k b{display:block;font-size:1.45rem;line-height:1.3;margin-top:2px}#axo .k em{font-style:normal;font-size:.75rem;color:#6fd3a0}
#axo .sh{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 8px;font-weight:700;font-size:1.1rem}#axo .sh:before{content:"";width:5px;height:20px;border-radius:3px;background:#2bcfe2;margin-inline-end:10px}
#axo .sh span{flex:1}
#axo .av{position:relative;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;overflow:hidden;box-shadow:inset 0 0 0 2px #ffffff30;background:linear-gradient(135deg,hsl(var(--hu) 65% 48%),hsl(calc(var(--hu) + 40) 70% 32%))}
#axo .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#axo .uc{display:flex;gap:12px;align-items:flex-start}#axo .uc .g b{font-size:1.05rem}
#axo .bal{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
#axo .bal span{display:flex;align-items:center;gap:6px;background:#0b141c;border:1px solid #27566b;border-radius:12px;padding:4px 11px;font-size:.88rem}#axo .bal span svg{width:15px;height:15px;color:#2bcfe2}
#axo .tg{display:inline-block;font-size:.72rem;font-weight:700;border-radius:99px;padding:1px 10px;margin-inline-start:6px;vertical-align:middle}
#axo .tg.d{background:#ef535033;color:#ff7a75}#axo .tg.w{background:#f1c40f26;color:#f1c40f}#axo .tg.o{background:#1f9d5540;color:#5fe58b}#axo .tg.i{background:#2bcfe226;color:#2bcfe2}
#axo .bb{max-width:85%;padding:9px 14px;border-radius:18px;margin:6px 0;overflow-wrap:anywhere}#axo .u{background:#1f2a37;border:1px solid #27566b}#axo .a{background:hsl(187 67% 33%);margin-inline-start:auto}
#axo img.s{max-width:100%;border-radius:12px;margin-top:6px}
#axo .lst{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d}#axo .lst:last-child{border:0}
#axo .pg{height:8px;border-radius:99px;background:#0b141c;overflow:hidden}#axo .pg i{display:block;height:100%;background:linear-gradient(90deg,#00b6d4,#2bcfe2)}
#axmod{position:absolute;inset:0;background:#000b;display:none;align-items:flex-end;justify-content:center;z-index:5}#axmod.on{display:flex}
#axmod .sheet{width:min(520px,100%);max-height:92vh;overflow:auto;background:#212c39;border:1.5px solid #27566b;border-radius:28px 28px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));animation:axup .25s ease}
@media(min-width:640px){#axmod{align-items:center}#axmod .sheet{border-radius:28px}}
@keyframes axup{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#axmod h2{margin:0 0 12px;font-size:1.25rem}
#axo .seg{display:flex;border:1.5px solid #27566b;border-radius:16px;padding:4px;background:#0b141c;margin:6px 0 10px}#axo .seg button{flex:1;border:0;background:none;color:#9AA9B5;border-radius:12px;padding:8px;font:inherit;font-weight:700;cursor:pointer}#axo .seg button.on{background:#2bcfe2;color:#04222a}
#axo .fl{display:flex;align-items:center;gap:10px;background:#0b141c;border:1.5px solid #27566b;border-radius:16px;padding:2px 12px;margin:8px 0}#axo .fl svg{color:#2bcfe2;flex:none}#axo .fl input{border:0;background:none;margin:0;padding:10px 0;box-shadow:none!important}#axo .fl label{min-width:62px;color:#9AA9B5;font-size:.9rem}
#axt{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);z-index:9;background:#2bcfe2;color:#04222a;font-weight:700;border-radius:99px;padding:10px 22px;box-shadow:0 8px 26px #000a;max-width:92vw;text-align:center;display:none}#axt.on{display:block}#axt.bad{background:#ef5350;color:#fff}
/* ===== التصميم الموحّد (على نمط «تقارير مالية») ===== */
#axo{--ta:#22d3ee}
#axo .axn button{--c:#22d3ee;color:var(--c);border-color:color-mix(in srgb,var(--c) 40%,#0b141c);background:color-mix(in srgb,var(--c) 12%,#0f1a24)}
#axo .axn button.on{background:var(--c);color:#06222b;border-color:var(--c);box-shadow:0 6px 18px color-mix(in srgb,var(--c) 35%,transparent)}
#axo .c{background:linear-gradient(180deg,#1b2938,#172330);border:1.5px solid #264a5d;border-top:4px solid var(--ta);border-radius:24px}
#axo .c.hero,#axo .hx{position:relative;overflow:hidden;border-radius:28px;padding:18px 16px 14px;margin-bottom:14px;color:#fff;background:linear-gradient(135deg,color-mix(in srgb,var(--ta) 62%,#06202e) 0%,color-mix(in srgb,var(--ta) 34%,#08263a) 55%,color-mix(in srgb,var(--ta) 16%,#0a1b2b) 100%);border:1.5px solid color-mix(in srgb,var(--ta) 70%,#0b141c);box-shadow:0 10px 36px color-mix(in srgb,var(--ta) 16%,transparent)}
#axo .hx:before{content:"";position:absolute;inset-inline-start:-40px;top:-60px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,#ffffff24,transparent 70%);pointer-events:none}
#axo .hx .t{color:#c9eff6;font-size:.95rem;position:relative;display:flex;align-items:center;gap:8px}#axo .hx .t svg{width:18px;height:18px}
#axo .hx .v{font-size:2.1rem;font-weight:800;line-height:1.3;margin:2px 0 12px;position:relative}#axo .hx .v small{font-size:.95rem;font-weight:600;color:#bfe9f1;margin-inline-start:6px}
#axo .hx .hs{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:6px;position:relative}
#axo .hx .hs>div{background:#06304a80;border:1px solid #ffffff1a;border-radius:18px;padding:9px 10px;min-width:0}
#axo .hx .hs small{display:block;color:#bfe3ec;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#axo .hx .hs b{display:block;font-size:clamp(.8rem,3.5vw,1.02rem);white-space:nowrap}
#axo .hx.neg{background:linear-gradient(135deg,#a3283d,#7a1f33 55%,#4d1624);border-color:#e0566f}
#axo .tg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
@media(min-width:760px){#axo .tg2{grid-template-columns:repeat(3,1fr)}}
#axo .tl2{position:relative;background:linear-gradient(180deg,#1b2938,#172330);border:1.5px solid #264a5d;border-top:4px solid var(--c);border-radius:24px;padding:14px;min-width:0}
#axo .tl2 small{display:block;color:#b4c2cf;font-size:.9rem;line-height:1.4}#axo .tl2 b{display:block;font-size:1.45rem;line-height:1.4;margin:4px 0 2px;overflow-wrap:anywhere}
#axo .tl2 .mu{display:block;font-size:.78rem}#axo .tl2.lb{border-style:dashed;border-top-style:solid}
#axo .pgb{height:8px;border-radius:99px;background:#0b141c;margin-top:12px;overflow:hidden}#axo .pgb i{display:block;height:100%;border-radius:99px;background:var(--c)}
#axo .kg .k{border-top:4px solid var(--c,#22d3ee);background:linear-gradient(180deg,#1b2938,#172330)}
#axo .kg .k:nth-child(6n+1){--c:#22d3ee}#axo .kg .k:nth-child(6n+2){--c:#f5b82e}#axo .kg .k:nth-child(6n+3){--c:#f0628c}#axo .kg .k:nth-child(6n+4){--c:#34d399}#axo .kg .k:nth-child(6n+5){--c:#2dd4bf}#axo .kg .k:nth-child(6n){--c:#a78bfa}
#axo .kg .k small svg{color:var(--c,#22d3ee)}
#axo .sh:before{background:var(--ta);width:6px}#axo .sh .tg{flex:none}
#axo .note{display:flex;gap:8px;align-items:flex-start;color:#9AA9B5;font-size:.82rem;line-height:1.6;margin:0 2px 12px}#axo .note svg{flex:none;margin-top:4px;color:var(--ta);width:16px;height:16px}
#axo .b.p{background:linear-gradient(90deg,color-mix(in srgb,var(--ta) 70%,#000),var(--ta));color:#06222b}
#axo .bal span svg,#axo .fl svg,#axo .k small svg{color:var(--ta)}
#axo input:focus,#axo textarea:focus,#axo select:focus{border-color:var(--ta);box-shadow:0 0 0 3px color-mix(in srgb,var(--ta) 25%,transparent)}
#axo .seg button.on{background:var(--ta)}
@media(max-width:360px){#axo .hx .v{font-size:1.7rem}#axo .hx .hs b{font-size:.9rem}}

/* ===== مركز العدادات ===== */
#axo .cth{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px}
#axo .ctt{position:relative;overflow:hidden;background:linear-gradient(180deg,#1b2938,#172330);border:1.5px solid #264a5d;border-radius:20px;padding:12px 14px 12px}
#axo .ctt:before{content:"";position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:var(--c)}
#axo .ctt small{display:flex;align-items:center;gap:7px;color:#cfdbe6;font-weight:700;font-size:.9rem}#axo .ctt small i{width:11px;height:11px;border-radius:50%;background:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 28%,transparent)}
#axo .ctt b{display:block;font-size:1.5rem;line-height:1.3;margin-top:4px}#axo .ctt .mu{font-size:.76rem;display:block}
#axo .cbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}#axo .cbar .fl{flex:1;min-width:200px;margin:0}
#axo .cmore{display:flex;gap:8px;margin:4px 0 18px}#axo .cmore .b{flex:1;padding:13px 10px;font-weight:800}
#axo .cc{animation:none!important;transition:none!important;contain:layout paint}#axo #clist{min-height:40px}
#axo .cc{--cc:#22d3ee;position:relative;overflow:hidden;background:linear-gradient(180deg,#1c2b3a 0%,#152230 100%);border:1.5px solid color-mix(in srgb,var(--cc) 38%,#1f3a4c);border-radius:26px;margin-bottom:14px;box-shadow:0 10px 30px #00000040}
#axo .cc:before{content:"";position:absolute;inset:0 0 auto 0;height:96px;background:linear-gradient(135deg,color-mix(in srgb,var(--cc) 34%,#0d1b27),transparent 85%);pointer-events:none}
#axo .cc>div{position:relative}
#axo .cc .cch{display:flex;gap:12px;align-items:center;padding:16px 16px 6px}
#axo .cc .cch .av{box-shadow:0 0 0 3px color-mix(in srgb,var(--cc) 70%,#0b141c),0 6px 16px #0008}
#axo .cc .cch .g b{font-size:1.1rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#axo .cc .cpt{text-align:end;flex:none}#axo .cc .cpt small{display:block;color:#9fb2c2;font-size:.74rem}#axo .cc .cpt b{display:flex;align-items:center;gap:5px;justify-content:flex-end;font-size:1.05rem;color:#ffd34d}#axo .cc .cpt svg{width:16px;height:16px}
#axo .cc .ccy{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:8px 16px 4px}
#axo .cc .ccy small{display:block;color:#a9bccb;font-size:.8rem}
#axo .cc .ccy b{display:block;font-size:2.3rem;line-height:1.1;font-weight:800;letter-spacing:.5px;color:#fff;text-shadow:0 0 22px color-mix(in srgb,var(--cc) 55%,transparent)}#axo .cc .ccy b em{font-style:normal;font-size:.85rem;font-weight:600;color:#a9bccb;margin-inline-start:6px;text-shadow:none}
#axo .cc .ccn{flex:none;min-width:64px;text-align:center;border:1.5px solid color-mix(in srgb,var(--cc) 60%,#0b141c);background:color-mix(in srgb,var(--cc) 14%,#0b141c);border-radius:18px;padding:6px 12px}#axo .cc .ccn b{display:block;font-size:1.5rem;line-height:1.2;color:var(--cc);text-shadow:none}#axo .cc .ccn small{font-size:.7rem}
#axo .cc .cch2{display:flex;flex-wrap:wrap;gap:7px;padding:10px 16px 2px}
#axo .cc .cchip{display:flex;align-items:center;gap:7px;background:#0b141c;border:1px solid color-mix(in srgb,var(--c) 55%,#0b141c);border-radius:99px;padding:4px 12px 4px 10px;font-size:.84rem;font-weight:700}
#axo .cc .cchip i{width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}#axo .cc .cchip span{color:#9fb2c2;font-weight:600;font-size:.76rem}
#axo .cc .cex{padding:10px 16px 2px}#axo .cc .cex .r{justify-content:space-between;font-size:.78rem;color:#9fb2c2}#axo .cc .cex .pg{margin-top:5px;height:9px}
#axo .cc .cex .pg i{background:linear-gradient(90deg,var(--cc),color-mix(in srgb,var(--cc) 50%,#fff))}
#axo .cc .cex .pg.low i{background:linear-gradient(90deg,#ef5350,#ff9a6b)}
#axo .cc .cca{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px 16px}#axo .cc .cca .b{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-width:96px}#axo .cc .cca .b svg{width:17px;height:17px}
#axo .cc.empty .ccy b{color:#8fa3b3;text-shadow:none}
#axo .shot{display:flex;flex-direction:column;gap:10px;align-items:center}#axo .shot img{max-width:100%;border-radius:16px;border:1.5px solid #27566b;box-shadow:0 10px 30px #000a}
#axo .tsel{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin:8px 0}
#axo .tsel button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;font:inherit;text-align:start;cursor:pointer;color:#e8eef5;background:#0b141c;border:1.5px solid #27566b;border-radius:16px;padding:9px 12px}
#axo .tsel button b{display:flex;align-items:center;gap:7px;font-size:.92rem}#axo .tsel button b i{width:11px;height:11px;border-radius:50%;background:var(--c)}#axo .tsel button span{font-size:.74rem;color:#9fb2c2}
#axo .tsel button.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,#0b141c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 25%,transparent)}
#axo .qty{display:flex;align-items:center;gap:8px;margin:8px 0}#axo .qty input{text-align:center;width:90px;margin:0;font-weight:800;font-size:1.1rem}#axo .qty .b{width:46px;padding:8px 0;font-size:1.3rem;text-align:center}
#axo .sum{background:color-mix(in srgb,var(--ta) 10%,#0b141c);border:1.5px dashed color-mix(in srgb,var(--ta) 50%,#0b141c);border-radius:16px;padding:10px 14px;margin:8px 0 10px;font-size:.9rem;line-height:1.7}
`;
  document.head.appendChild(css);

  const I = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', head: '<path d="M4 14v-2a8 8 0 0116 0v2M4 14h3v5H4zM17 14h3v5h-3zM20 19a4 4 0 01-4 3h-3"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9M10 20v-5h4v5"/>', coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 00-2.5-1.5c-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.8 2.2 0 01-2.7-1.6M12 6v2M12 16v2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17h.01"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l-2 6 5 12M15 3l2 6-5 12"/>', dollar: '<path d="M12 2v20M17 6.5C16 5 14.3 4.5 12 4.5c-2.8 0-4.5 1.1-4.5 3 0 4.5 9 2.2 9 7 0 1.900-1.800 3-4.500 3-2.300 0-4.100-.7-5-2.500"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', chat: '<path d="M21 12a8 8 0 01-11.700 7L4 20l1.200-4.200A8 8 0 1121 12z"/>', shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  I.info = '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>';
  I.gauge = '<path d="M4 17a8 8 0 1116 0"/><path d="M12 17l4-5"/><path d="M12 6v1.5M6.3 8.3l1 1M17.7 8.3l-1 1M4.2 13h1.500M18.300 13h1.500"/>';
  I.cam = '<path d="M4 8h3l1.500-2.500h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.500" r="3.500"/>';
  I.dl = '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>';
  I.refresh = '<path d="M20 11a8 8 0 00-14.500-4M4 4v4h4M4 13a8 8 0 0014.500 4M20 20v-4h-4"/>';
  I.heart = '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.5-9.5 9-9.5 9z"/>';
  const ico = (n) => `<svg viewBox="0 0 24 24">${I[n] || ''}</svg>`;
  const TABS = [['overview', 'نظرة عامة', 'home', '#22d3ee'], ['users', 'المستخدمون', 'users', '#a78bfa'], ['counters', 'العدادات', 'gauge', '#ffb020'], ['reports', 'البلاغات', 'flag', '#fb7185'], ['merchants', 'التجار', 'store', '#34d399'], ['agbuys', 'طلبات الوكلاء', 'coin', '#f5b82e'], ['ptsreq', 'طلبات النقاط', 'coin', '#22d3ee'], ['finset', 'المالية', 'coin', '#2dd4bf'], ['fin', 'تقارير مالية', 'list', '#22d3ee'], ['ledger', 'سجل العمليات', 'list', '#38bdf8'], ['faq', 'الأسئلة الشائعة', 'help', '#c084fc'], ['campaigns', 'حملات التبرع', 'heart', '#f472b6'], ['agents', 'مراقبة الوكلاء', 'users', '#fb923c']];
  const TC = Object.fromEntries(TABS.map((t) => [t[0], t[3]]));
  const btn = document.createElement('button');
  btn.id = 'axb'; btn.innerHTML = ico('shield') + 'إدارة متقدمة<i hidden></i>';
  const ov = document.createElement('div');
  ov.id = 'axo';
  ov.innerHTML = `<div class="axh"><div class="ci">${ico('shield')}</div><h1>الإدارة المتقدمة</h1><button class="axx" data-x="1" aria-label="إغلاق">${ico('x')}</button></div>
<div class="axn">${TABS.map((t) => `<button data-t="${t[0]}" style="--c:${t[3]}">${ico(t[2])}<span>${t[1]}</span><i hidden data-bd="${t[0]}"></i></button>`).join('')}</div><div id="axm"></div><div id="axmod"></div><div id="axt"></div>`;
  document.body.append(btn, ov);
  const M = ov.querySelector('#axm');

  const cpImg = {};
  let agSel = '';
  let lf = { kind: '', cat: '', q: '' }, tab = 'overview', thread = null, rep = 'open', busy = false, shot = null, uq = '';

  const err = (e) => { M.insertAdjacentHTML('afterbegin', `<div class="c" style="color:#ef5350">${esc(e.message)}</div>`); };

  const hue = (x) => { let h = 7; for (const c of String(x || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const av = (u, z) => `<span class="av" style="width:${z}px;height:${z}px;font-size:${Math.round(z * 0.42)}px;--hu:${hue(u.email)}">${esc(String(u.name || u.email || '?').trim().charAt(0).toUpperCase() || '?')}${u.av ? `<img loading="lazy" alt="" src="/api/m/avatar?e=${encodeURIComponent(String(u.email).toLowerCase())}&v=${u.av}" onerror="this.remove()">` : ''}</span>`;
  const flash = (m, bad) => { const t = ov.querySelector('#axt'); t.textContent = m; t.className = 'on' + (bad ? ' bad' : ''); clearTimeout(flash.k); flash.k = setTimeout(() => (t.className = ''), 3200); };
  const modal = (html) => {
    const m = ov.querySelector('#axmod'), old = m.querySelector('.sheet');
    // إن كانت النافذة مفتوحة نحدّث محتواها في نفس العنصر: لا حركة دخول جديدة ولا قفز ولا وميض
    if (old && m.classList.contains('on')) { const y = old.scrollTop; old.innerHTML = html; old.scrollTop = y; return; }
    m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.add('on');
  };
  const closeModal = () => { const m = ov.querySelector('#axmod'); m.classList.remove('on'); m.innerHTML = ''; };
  let chMode = 'add';
  function chargeModal(email, name, mode) {
    chMode = mode || 'add';
    const T = { add: ['شحن رصيد', 'تنفيذ الشحن فوراً'], sub: ['خصم من الرصيد', 'تنفيذ الخصم فوراً'], set: ['تعيين الرصيد', 'تعيين الرصيد فوراً'] };
    modal(`<h2>${T[chMode][0]}: ${esc(name)}</h2><div class="mu" dir="ltr" style="text-align:start;margin-bottom:6px">${esc(email)}</div>
<div class="seg"><button data-m="add" class="${chMode === 'add' ? 'on' : ''}">شحن +</button><button data-m="sub" class="${chMode === 'sub' ? 'on' : ''}">خصم −</button><button data-m="set" class="${chMode === 'set' ? 'on' : ''}">تعيين =</button></div>
<div class="fl">${ico('coin')}<label>النقاط</label><input id="cp" type="number" inputmode="numeric" min="0" placeholder="0"></div>
<div class="fl">${ico('gem')}<label>الجواهر</label><input id="cg" type="number" inputmode="numeric" min="0" placeholder="0"></div>
<div class="fl">${ico('dollar')}<label>الدولار</label><input id="cu" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></div>
<input id="cn" placeholder="ملاحظة (اختياري)">
<div class="mu" style="margin:6px 0 10px">${chMode === 'set' ? 'اترك الحقل فارغاً لعدم تغيير ذلك الرصيد.' : 'يُنفَّذ فوراً ويصل إلى جهاز المستخدم خلال ثوانٍ.'}</div>
<div class="r"><button class="b p g" data-a="cgo" data-e="${esc(email)}" data-n="${esc(name)}">${T[chMode][1]}</button><button class="b" data-mc="1">إلغاء</button></div>`);
    const sg = ov.querySelector('#axmod .seg'); sg.onclick = (ev) => { const b = ev.target.closest('[data-m]'); if (b) chargeModal(email, name, b.dataset.m); };
  }
  function zeroModal(email, name) {
    modal(`<h2>تصفير رصيد: ${esc(name)}</h2><div class="mu" dir="ltr" style="text-align:start;margin-bottom:10px">${esc(email)}</div>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zp" checked>${ico('coin')}<span class="g">النقاط</span></label>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zg" checked>${ico('gem')}<span class="g">الجواهر</span></label>
<label class="fl" style="cursor:pointer"><input type="checkbox" id="zd" checked>${ico('dollar')}<span class="g">الدولار</span></label>
<div class="mu" style="margin:8px 0 10px">يُنفَّذ فوراً ولا يمكن التراجع عنه.</div>
<div class="r"><button class="b d g" data-a="zgo" data-e="${esc(email)}" data-n="${esc(name)}">تصفير فوري</button><button class="b" data-mc="1">إلغاء</button></div>`);
  }
  const fmtAfter = (a) => `الرصيد الآن: ${nf(a.pts)} نقطة · ${nf(a.gems)} جوهرة · $${nf(a.usd)}`;

  /* ---------- مكونات التصميم الموحّد ---------- */
  const hero = (icn, title, big, unit, boxes, neg) => `<div class="hx${neg ? ' neg' : ''}"><div class="t">${ico(icn)}${title}</div><div class="v">${big}${unit ? `<small>${unit}</small>` : ''}</div><div class="hs" style="--n:${boxes.length}">${boxes.map((b) => `<div><small>${b[0]}</small><b>${b[1]}</b></div>`).join('')}</div></div>`;
  const tile = (l, v, sub, c, pct, cls) => `<div class="tl2 ${cls || ''}" style="--c:${c}"><small>${l}</small><b>${v}</b>${sub ? `<span class="mu">${sub}</span>` : ''}${pct != null ? `<div class="pgb"><i style="width:${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%"></i></div>` : ''}</div>`;
  const note = (t) => `<div class="note">${ico('info')}<span>${t}</span></div>`;
  const PAL = ['#22d3ee', '#f5b82e', '#f0628c', '#34d399', '#2dd4bf', '#a78bfa', '#60a5fa', '#fb923c'];

  /* ---------- مركز العدادات: بيانات مؤقتة + التصوير + الشحن ---------- */
  let cq = '', ctLimit = 20, CTD = { types: [], users: [], base: 100 }, ctMode = 'add', ctIdx = 0, ctN = 1, lastShot = null;
  const dOnly = (t) => new Date(t).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
  const topColor = (u) => (u.groups && u.groups[0] ? u.groups[0].color : '#22d3ee');
  function avatarImg(u) {
    return new Promise((ok) => {
      if (!u.av) return ok(null);
      const im = new Image(); const t = setTimeout(() => ok(null), 2500);
      im.onload = () => { clearTimeout(t); ok(im); }; im.onerror = () => { clearTimeout(t); ok(null); };
      im.src = `/api/m/avatar?e=${encodeURIComponent(String(u.email).toLowerCase())}&v=${u.av}`;
    });
  }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function mkCanvas(w, h) { const k = 2, cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k; const c = cv.getContext('2d'); c.scale(k, k); return [cv, c]; }
  const FONT = 'Cairo, Tahoma, Arial, sans-serif';
  function T(c, str, x, y, size, col, o) {
    o = o || {}; c.font = `${o.w || 600} ${size}px ${FONT}`; c.fillStyle = col; c.direction = o.dir || 'rtl'; c.textAlign = o.al || 'right'; c.textBaseline = 'middle';
    let s2 = String(str); if (o.max) { while (c.measureText(s2).width > o.max && s2.length > 1) s2 = s2.slice(0, -2) + '…'; }
    c.fillText(s2, x, y);
  }
  function frame(c, w, h, accent, title, sub) {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0f1b27'); g.addColorStop(1, '#0a131c');
    c.fillStyle = g; rr(c, 0, 0, w, h, 34); c.fill();
    const t = c.createLinearGradient(0, 0, w, 0); t.addColorStop(0, accent); t.addColorStop(1, '#22d3ee'); c.fillStyle = t; c.fillRect(0, 0, w, 8);
    const gl = c.createRadialGradient(w, 0, 10, w, 0, 340); gl.addColorStop(0, accent + '55'); gl.addColorStop(1, 'transparent'); c.fillStyle = gl; c.fillRect(0, 0, w, 340);
    T(c, title, w - 36, 44, 20, '#fff', { w: 800 }); T(c, sub, w - 36, 70, 13, '#8fa3b3');
    T(c, dOnly(Date.now()) + ' · ' + new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }), 36, 44, 13, '#8fa3b3', { al: 'left' });
  }
  async function renderUser(u) {
    await (document.fonts && document.fonts.ready).catch(() => {});
    const im = await avatarImg(u), W = 760, rows = Math.max(1, u.groups.length), H = 372 + rows * 60 + 56, [cv, c] = mkCanvas(W, H), acc = topColor(u);
    frame(c, W, H, acc, 'بطاقة العدادات', 'تقرير عدادات المستخدم');
    // الصورة والاسم
    const cx = W - 76, cy = 140;
    c.save(); c.beginPath(); c.arc(cx, cy, 42, 0, 7); c.closePath(); c.lineWidth = 5; c.strokeStyle = acc; c.stroke(); c.clip();
    if (im) c.drawImage(im, cx - 42, cy - 42, 84, 84); else { c.fillStyle = `hsl(${hue(u.email)} 60% 40%)`; c.fillRect(cx - 42, cy - 42, 84, 84); T(c, String(u.name || u.email || '?').trim().charAt(0).toUpperCase(), cx, cy + 2, 40, '#fff', { w: 800, al: 'center' }); }
    c.restore();
    T(c, u.name || u.email, cx - 58, cy - 14, 26, '#fff', { w: 800, max: W - 230 });
    T(c, u.email, cx - 58, cy + 18, 14, '#9fb2c2', { dir: 'ltr', max: W - 230 });
    if (u.rcode) T(c, 'كود الإحالة: ' + u.rcode, cx - 58, cy + 42, 13, '#ffd34d', { w: 700, max: W - 230 });
    // ثلاث بطاقات إحصائية
    const bw = (W - 72 - 24) / 3, by = 208, bh = 104;
    [['العائد اليومي', nf(u.daily), 'نقطة / يوم', acc], ['رصيد النقاط', nf(u.pts), 'نقطة', '#ffd34d'], ['عدد العدادات', nf(u.n), 'عداد فعّال', '#34d399']].forEach((b, k) => {
      const x = W - 36 - bw - k * (bw + 12);
      c.fillStyle = '#111f2b'; rr(c, x, by, bw, bh, 22); c.fill(); c.lineWidth = 1.5; c.strokeStyle = b[3] + '88'; c.stroke();
      c.fillStyle = b[3]; rr(c, x + bw - 6, by + 22, 6, bh - 44, 3); c.fill();
      T(c, b[0], x + bw - 22, by + 26, 14, '#a9bccb'); T(c, b[1], x + bw - 22, by + 62, 30, '#fff', { w: 800 }); T(c, b[2], x + bw - 22, by + 88, 12, '#8fa3b3');
    });
    // صفوف العدادات
    T(c, 'العدادات الفعّالة', W - 36, 344, 17, '#fff', { w: 800 });
    if (!u.groups.length) T(c, 'لا توجد عدادات فعّالة', W - 36, 392, 15, '#8fa3b3');
    u.groups.forEach((g, k) => {
      const y = 364 + k * 60;
      c.fillStyle = '#111f2b'; rr(c, 36, y, W - 72, 50, 16); c.fill(); c.lineWidth = 1; c.strokeStyle = g.color + '66'; c.stroke();
      c.fillStyle = g.color; c.beginPath(); c.arc(W - 62, y + 25, 8, 0, 7); c.fill();
      T(c, 'عداد ' + g.name, W - 82, y + 25, 17, '#fff', { w: 800 });
      T(c, '× ' + g.n, W - 230, y + 25, 17, g.color, { w: 800, al: 'center' });
      T(c, nf(g.daily) + ' نقطة / يوم', W / 2 - 20, y + 25, 15, '#e8eef5', { al: 'center' });
      T(c, 'ينتهي ' + dOnly(g.exp), 56, y + 25, 13, '#9fb2c2', { al: 'left' });
    });
    // التذييل: شريط الصلاحية
    const fy = 364 + rows * 60 + 6;
    if (u.n) {
      const pct = Math.max(0, Math.min(100, Math.round(u.days * 100 / u.life))); c.fillStyle = '#0b141c'; rr(c, 36, fy + 8, W - 72, 12, 6); c.fill();
      c.fillStyle = pct < 12 ? '#ef5350' : acc; rr(c, 36 + (W - 72) * (1 - pct / 100), fy + 8, Math.max(12, (W - 72) * pct / 100), 12, 6); c.fill();
      T(c, 'أقرب انتهاء بعد ' + u.days + ' يوم', W - 36, fy + 36, 13, '#a9bccb');
    }
    T(c, 'الإدارة المتقدمة', 36, fy + 36, 12, '#6f8396', { al: 'left' });
    return cv;
  }
  async function renderSummary() {
    await (document.fonts && document.fonts.ready).catch(() => {});
    const us = CTD.users.filter((x) => x.n).slice(0, 10), W = 760, H = 392 + us.length * 52 + 44 + CTD.types.length * 0, [cv, c] = mkCanvas(W, H);
    frame(c, W, H, '#ffb020', 'ملخص العدادات', CTD.search ? 'نتائج البحث' : 'كل المستخدمين الذين يملكون عدادات');
    const bw = (W - 72 - 24) / 3, by = 96, bh = 92;
    [['عدادات فعّالة', nf(CTD.total), '#ffb020'], ['العائد اليومي الكلي', nf(CTD.daily), '#22d3ee'], ['مستخدمون بعدادات', nf(CTD.withC), '#34d399']].forEach((b, k) => {
      const x = W - 36 - bw - k * (bw + 12); c.fillStyle = '#111f2b'; rr(c, x, by, bw, bh, 22); c.fill(); c.lineWidth = 1.5; c.strokeStyle = b[2] + '88'; c.stroke();
      T(c, b[0], x + bw - 18, by + 28, 14, '#a9bccb'); T(c, b[1], x + bw - 18, by + 64, 28, '#fff', { w: 800 });
    });
    T(c, 'حسب النوع', W - 36, 222, 16, '#fff', { w: 800 });
    const tw = (W - 72 - 8 * 8) / 9; CTD.types.forEach((t, k) => {
      const x = W - 36 - tw - k * (tw + 8); c.fillStyle = '#111f2b'; rr(c, x, 238, tw, 70, 14); c.fill(); c.fillStyle = t.color; c.fillRect(x + 10, 238, tw - 20, 4);
      T(c, t.name, x + tw / 2, 264, 11, '#cfdbe6', { al: 'center', max: tw - 8 }); T(c, nf(t.count), x + tw / 2, 288, 19, '#fff', { w: 800, al: 'center' });
    });
    T(c, 'أعلى المستخدمين عائداً', W - 36, 340, 16, '#fff', { w: 800 });
    us.forEach((u, k) => {
      const y = 358 + k * 52; c.fillStyle = k % 2 ? '#0e1a25' : '#111f2b'; rr(c, 36, y, W - 72, 44, 14); c.fill();
      T(c, (k + 1) + '.', W - 54, y + 22, 15, '#8fa3b3', { al: 'center' }); T(c, u.name || u.email, W - 76, y + 22, 16, '#fff', { w: 700, max: 260 });
      T(c, u.groups.map((g) => g.name + '×' + g.n).join(' · '), W / 2 - 40, y + 22, 12, '#9fb2c2', { al: 'center', max: 200 });
      T(c, nf(u.daily) + ' / يوم', 56, y + 22, 15, '#ffd34d', { w: 800, al: 'left' });
    });
    return cv;
  }
  async function showShot(cv, name) {
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); lastShot = { blob, name };
    const url = URL.createObjectURL(blob), canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name + '.png', { type: 'image/png' })] })), canCopy = !!(navigator.clipboard && window.ClipboardItem);
    modal(`<h2>لقطة جاهزة</h2><div class="shot"><img alt="" src="${url}"><div class="r" style="width:100%"><button class="b p g" data-a="shotdl">${ico('dl')} حفظ الصورة</button>${canShare ? `<button class="b g" data-a="shotsh">مشاركة</button>` : ''}${canCopy ? `<button class="b g" data-a="shotcp">نسخ</button>` : ''}<button class="b" data-mc="1">إغلاق</button></div></div>`);
  }
  const ctDelta = () => { const t = CTD.types[ctIdx] || { daily: 0 }; return t.daily * ctN; };
  function counterModal(email, name) {
    const u = CTD.users.find((x) => x.email === email) || { n: 0, groups: [], daily: CTD.base, pts: 0 }, t = CTD.types[ctIdx] || CTD.types[0] || { name: '', daily: 0, color: '#22d3ee' };
    modal(`<h2>شحن العدادات: ${esc(name)}</h2><div class="mu" dir="ltr" style="text-align:start;margin-bottom:6px">${esc(email)} · يملك الآن ${nf(u.n)} عداد · عائده ${nf(u.daily)} نقطة/يوم</div>
<div class="seg"><button data-cm="add" class="${ctMode === 'add' ? 'on' : ''}">إضافة عدادات +</button><button data-cm="renew" class="${ctMode === 'renew' ? 'on' : ''}">تجديد 12 شهراً ↻</button></div>
${ctMode === 'add' ? `<div class="mu">اختر نوع العداد</div><div class="tsel">${CTD.types.map((x) => `<button data-a="ctpick" data-i="${x.i}" style="--c:${x.color}" class="${x.i === ctIdx ? 'on' : ''}"><b><i></i>${esc(x.name)}</b><span>${nf(x.daily)} نقطة/يوم</span></button>`).join('')}</div>
<div class="mu">الكمية</div><div class="qty"><button class="b" data-a="ctq" data-d="-1">−</button><input id="ctn" type="number" min="1" max="20" value="${ctN}"><button class="b" data-a="ctq" data-d="1">+</button></div>
<div class="sum">سيُضاف <b>${ctN} × عداد ${esc(t.name)}</b> بصلاحية 12 شهراً · يزيد العائد اليومي بمقدار <b style="color:#ffd34d">${nf(ctDelta())}</b> نقطة.</div>`
    : `<div class="sum">${u.n ? `سيُمدَّد كل عدادات الحساب الفعّالة (<b>${nf(u.n)}</b>) إلى 12 شهراً كاملة من اليوم.` : 'لا توجد عدادات فعّالة لتجديدها، اختر «إضافة عدادات» أولاً.'}</div>`}
<input id="ctnote" placeholder="ملاحظة (اختياري)"><div class="mu" style="margin:6px 0 10px">يُنفَّذ فوراً ويصل إلى جهاز المستخدم خلال ثوانٍ مع إشعار.</div>
<div class="r"><button class="b p g" data-a="ctgo" data-e="${esc(email)}" data-n="${esc(name)}"${ctMode === 'renew' && !u.n ? ' disabled style="opacity:.5"' : ''}>${ctMode === 'add' ? 'شحن الآن' : 'تجديد الآن'}</button><button class="b" data-mc="1">إلغاء</button></div>`);
    ov.querySelector('#axmod .seg').onclick = (ev) => { const b = ev.target.closest('[data-cm]'); if (b) { ctMode = b.dataset.cm; counterModal(email, name); } };
    const qi = ov.querySelector('#ctn'); if (qi) qi.oninput = () => { ctN = Math.max(1, Math.min(20, Math.floor(+qi.value) || 1)); const sm = ov.querySelector('#axmod .sum'); if (sm) sm.innerHTML = `سيُضاف <b>${ctN} × عداد ${esc(t.name)}</b> بصلاحية 12 شهراً · يزيد العائد اليومي بمقدار <b style="color:#ffd34d">${nf(ctDelta())}</b> نقطة.`; };
  }
  const ucard = (u) => {
    const acc = topColor(u), pct = u.n ? Math.max(0, Math.min(100, Math.round(u.days * 100 / u.life))) : 0, nm = esc(u.name || u.email);
    return `<div class="cc${u.n ? '' : ' empty'}" style="--cc:${acc}" data-ce="${esc(u.email)}">
<div class="cch">${av(u, 56)}<div class="g"><b>${nm}${u.kyc ? '<span class="tg o">موثق</span>' : ''}${u.blk ? '<span class="tg d">محظور</span>' : ''}${u.demo ? '<span class="tg i">تجريبي</span>' : ''}</b><div class="mu" dir="ltr" style="text-align:start;overflow:hidden;text-overflow:ellipsis">${esc(u.email)}</div>${u.rcode ? `<div class="mu">كود الإحالة: <b dir="ltr" style="color:#ffd34d">${esc(u.rcode)}</b></div>` : ''}</div><div class="cpt"><small>رصيد النقاط</small><b>${ico('coin')}<i style="font-style:normal" data-lb="${esc(String(u.email).toLowerCase())}" data-k="0" data-nf="1">${nf(u.pts)}</i></b></div></div>
<div class="ccy"><div><small>العائد اليومي</small><b>${nf(u.daily)}<em>نقطة / يوم</em></b></div><div class="ccn"><b>${nf(u.n)}</b><small>عداد فعّال</small></div></div>
${u.groups.length ? `<div class="cch2">${u.groups.map((g) => `<div class="cchip" style="--c:${g.color}"><i></i>${esc(g.name)} <span>× ${g.n}</span></div>`).join('')}</div>
<div class="cex"><div class="r"><span>أقرب انتهاء: ${dOnly(u.minExp)}</span><b>${u.days} يوم</b></div><div class="pg${pct < 12 ? ' low' : ''}"><i style="width:${Math.max(3, pct)}%"></i></div></div>` : '<div class="cch2"><span class="mu">لا يملك عدادات فعّالة حالياً</span></div>'}
<div class="cca"><button class="b" data-a="cshot" data-e="${esc(u.email)}">${ico('cam')} تصوير</button><button class="b p" data-a="cchg" data-e="${esc(u.email)}" data-n="${nm}">${ico('bolt')} شحن العداد</button></div></div>`;
  };

  const V = {
    async overview() {
      const j = await api('/api/ctl/overview'), u = j.users || {}, rp = j.reports || {}, sp = j.support || {}, mc = j.merchants || {}, fr = j.friends || {}, ms = j.msgs || {}, wd = j.withdrawals || {};
      const k = (ic, l, v, em) => `<div class="k"><small>${ico(ic)}${l}</small><b>${v}</b>${em ? `<em>${em}</em>` : ''}</div>`;
      const att = (n, l, t, ic) => `<div class="lst"><span class="av" style="width:38px;height:38px;--hu:187">${ico(ic)}</span><div class="g"><b>${l}</b><div class="mu">${n ? 'يحتاج إلى معالجة' : 'لا يوجد شيء معلّق'}</div></div><span class="tg ${n ? 'd' : 'o'}">${nf(n)}</span>${t ? `<button class="b s" data-t="${t}">فتح</button>` : ''}</div>`;
      return hero('shield', 'نظرة عامة على المنصة', nf(u.real), 'مستخدم حقيقي', [['متصلون الآن', nf(u.online)], ['جدد اليوم', nf(u.new_day)], ['حسابات موثقة', nf(u.kyc)]]) + `<div class="kg">${k('users', 'المستخدمون الحقيقيون', nf(u.real), 'جدد اليوم: ' + nf(u.new_day) + ' · الأسبوع: ' + nf(u.new_week))}${k('bolt', 'متصلون الآن', nf(u.online), 'نشطون خلال 24 ساعة: ' + nf(u.day))}${k('shield', 'حسابات موثقة', nf(u.kyc), 'محظورة: ' + nf(u.blk) + ' · تجريبية: ' + nf(u.demo))}
${k('coin', 'إجمالي النقاط', nf(u.pts))}${k('gem', 'إجمالي الجواهر', nf(u.gems))}${k('dollar', 'إجمالي الدولار', '$' + nf(u.usd))}</div>
<div class="sh"><span>يحتاج إلى إجراء</span></div><div class="c">${att(rp.open, 'بلاغات مفتوحة', 'reports', 'flag')}${att(mc.pending, 'طلبات تجار بانتظار الموافقة', 'merchants', 'store')}${att((j.agbuys || {}).pending, 'طلبات شراء نقاط من الوكلاء', 'agbuys', 'coin')}${att((j.ptsreq || {}).pending, 'طلبات شراء نقاط من المستخدمين', 'ptsreq', 'coin')}${att(wd.pending, 'طلبات سحب معلقة', '', 'coin')}</div>
<div class="sh"><span>النشاط الاجتماعي</span></div><div class="kg">${k('users', 'صداقات مقبولة', nf(fr.accepted), 'طلبات معلقة: ' + nf(fr.pending))}${k('chat', 'رسائل المستخدمين', nf(ms.total), 'آخر 24 ساعة: ' + nf(ms.day))}${k('store', 'التجار', nf(mc.active), 'مستلم: ' + nf(mc.received) + ' نقطة')}</div>
<div class="sh"><span>أعلى الأرصدة</span><button class="b s" data-t="users">كل المستخدمين</button></div><div class="c">${(j.top || []).map((x) => `<div class="lst">${av(x, 40)}<div class="g"><b>${esc(x.name || x.email)}</b><div class="mu" dir="ltr" style="text-align:start">${esc(x.email)}</div></div><div style="text-align:end"><b>${nf(x.pts)}</b><div class="mu">${nf(x.gems)} جوهرة · $${nf(x.usd)}</div></div></div>`).join('') || '<div class="mu">لا بيانات</div>'}</div>
<div class="sh"><span>أحدث المنضمين</span></div><div class="c">${(j.joined || []).map((x) => `<div class="lst">${av(x, 38)}<div class="g"><b>${esc(x.name || x.email)}</b><div class="mu" dir="ltr" style="text-align:start">${esc(x.email)}</div></div><span class="mu">${dt(x.created_at)}</span></div>`).join('') || '<div class="mu">لا بيانات</div>'}</div>
<div class="sh"><span>آخر عمليات الشحن والتصفير</span></div><div class="c">${(j.recent || []).map((x) => `<div class="lst"><span class="tg ${x.op === 'add' ? 'o' : x.op === 'sub' || x.op === 'zero' ? 'd' : 'i'}">${{ add: 'شحن', sub: 'خصم', zero: 'تصفير', set: 'تعيين' }[x.op] || x.op}</span><div class="g" dir="ltr" style="text-align:start">${esc(x.email)}</div><div class="mu" style="text-align:end">${x.pts ? nf(x.pts) + ' نقطة ' : ''}${x.gems ? nf(x.gems) + ' جوهرة ' : ''}${x.usd ? '$' + nf(x.usd) : ''}<div>${dt(x.created_at)}</div></div></div>`).join('') || '<div class="mu">لا عمليات بعد</div>'}</div>`;
    },
    async users() {
      const j = await api('/api/ctl/users?q=' + encodeURIComponent(uq));
      return hero('users', 'إدارة المستخدمين', nf(j.total.n), 'حساب', [['تجريبية', nf(j.total.demo)], ['محظورة', nf(j.total.blk)], ['المعروضون', nf(j.users.length)]]) + `<div class="c"><div class="r"><input id="uq" class="g" placeholder="بحث بالبريد أو الاسم أو الرقم أو الكود" value="${esc(uq)}"><button class="b p" data-a="usearch">بحث</button></div>
<div class="mu" style="margin-top:6px">كل الحسابات: ${j.total.n} · تجريبية: ${j.total.demo} · محظورة: ${j.total.blk}</div>
<button class="b d s" data-a="purge" style="margin-top:8px">حذف الحسابات التجريبية فقط</button></div>` +
        j.users.map((u) => `<div class="c"><div class="uc">${av(u, 56)}<div class="g"><b>${esc(u.name || '—')}</b>${u.kyc ? '<span class="tg o">موثق</span>' : ''}${u.demo ? '<span class="tg i">تجريبي</span>' : ''}${u.blk ? '<span class="tg d">محظور</span>' : ''}
<div class="mu" dir="ltr" style="text-align:start">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</div><div class="mu">${u.rcode ? 'الكود: <b dir="ltr">' + esc(u.rcode) + '</b> · ' : ''}آخر ظهور: ${u.last_seen ? dt(u.last_seen) : '—'}</div></div></div>
<div class="bal"><span>${ico('coin')}<i style="font-style:normal" data-lb="${esc(String(u.email).toLowerCase())}" data-k="0" data-nf="1">${nf(u.pts)}</i> نقطة</span><span>${ico('gem')}<i style="font-style:normal" data-lb="${esc(String(u.email).toLowerCase())}" data-k="1" data-nf="1">${nf(u.gems)}</i> جوهرة</span><span>${ico('dollar')}$<i style="font-style:normal" data-lb="${esc(String(u.email).toLowerCase())}" data-k="2" data-nf="1">${nf(u.usd)}</i></span></div>
<div class="r"><button class="b p s" data-a="uch" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">شحن</button><button class="b s" data-a="udd" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">خصم</button><button class="b s" data-a="uzero" data-e="${esc(u.email)}" data-n="${esc(u.name || u.email)}">تصفير</button>
<button class="b s" data-a="${u.blk ? 'unban' : 'ban'}" data-e="${esc(u.email)}">${u.blk ? 'فك الحظر' : 'حظر'}</button><button class="b d s" data-a="del" data-e="${esc(u.email)}">حذف</button></div></div>`).join('');
    },
    async counters() {
      const j = await api('/api/ctl/counters-hub?q=' + encodeURIComponent(cq) + '&limit=' + ctLimit);
      CTD = j; if (ctIdx >= j.types.length) ctIdx = 0;
      const tot = j.allCount != null ? j.allCount : j.users.length, mx = Math.max(1, ...j.types.map((t) => t.count));
      const tiles = j.types.map((t) => `<div class="ctt" style="--c:${t.color}"><small><i></i>${esc(t.name)}</small><b>${nf(t.count)}</b><span class="mu">${nf(t.daily)} نقطة/يوم · ${nf(t.users)} مستخدم</span><div class="pgb"><i style="width:${Math.round(t.count * 100 / mx)}%;background:${t.color}"></i></div></div>`).join('');
      return hero('gauge', j.search ? 'نتائج البحث عن مستخدم' : 'مركز العدادات', j.search ? nf(tot) : nf(j.total), j.search ? 'حساب' : 'عداد فعّال', j.search ? [['يملكون عدادات', nf(j.users.filter((u) => u.n).length)], ['بلا عدادات', nf(j.users.filter((u) => !u.n).length)], ['العائد الأساسي', nf(j.base)]] : [['أصحاب عدادات', nf(j.withC)], ['العائد اليومي الكلي', nf(j.daily)], ['تنتهي خلال 30 يوماً', nf(j.soon)]]) +
        `<div class="cbar"><div class="fl">${ico('users')}<input id="cq" placeholder="ابحث بكود الإحالة أو الاسم أو البريد أو الرقم لشحن عداد لأي مستخدم" value="${esc(cq)}"></div><button class="b p" data-a="cqs">بحث</button>${cq ? '<button class="b" data-a="cqc">مسح</button>' : ''}<button class="b" data-a="cshotall">${ico('cam')} تصوير الملخص</button></div>` +
        (j.search ? '' : `<div class="sh"><span>توزيع العدادات حسب النوع</span></div><div class="cth">${tiles}</div>`) +
        `<div class="sh"><span>${j.search ? 'الحسابات المطابقة' : 'بطاقات المستخدمين'}</span><span class="tg i">${nf(tot)}</span></div>` +
        `<div id="clist">${tot ? j.users.map(ucard).join('') : `<div class="c mu" style="text-align:center">${j.search ? 'لا توجد حسابات مطابقة' : 'لا يوجد مستخدمون بعد'}</div>`}</div>` +
        (j.hasMore ? `<div class="cmore"><button class="b p" data-a="cmore">عرض المزيد (${nf(j.users.length)} من ${nf(tot)})</button><button class="b" data-a="cmoreall">عرض الكل</button></div>` : (tot > 20 ? `<div class="mu" style="text-align:center;margin:8px 0 14px">تم عرض كل المستخدمين (${nf(tot)})</div>` : '')) +
        (!j.search && j.log.length ? `<div class="sh"><span>آخر عمليات الشحن</span></div><div class="c">${j.log.map((x) => `<div class="lst"><span class="tg ${x.op === 'renew' ? 'i' : 'o'}">${x.op === 'renew' ? 'تجديد' : 'شحن'}</span><div class="g" dir="ltr" style="text-align:start">${esc(x.email)}</div><div class="mu" style="text-align:end">${esc(x.note || '')}<div>${dt(x.created_at)}</div></div></div>`).join('')}</div>` : '');
    },
    async merchants() {
      const j = await api('/api/ctl/merchants'), B = { pending: ['بانتظار الموافقة', 'w'], active: ['معتمد', 'o'], suspended: ['موقوف', 'd'], rejected: ['مرفوض', 'd'] };
      const row = (l, v) => (v ? `<div class="r" style="margin-top:4px"><span class="mu" style="min-width:92px">${l}</span><b class="g">${esc(v)}</b></div>` : '');
      const card = (m) => `<div class="c" data-m="${m.id}">${m.img ? `<div class="r" style="margin-bottom:8px;align-items:center"><img src="${m.img}" alt="" style="width:64px;height:64px;border-radius:14px;object-fit:cover"><button class="b d" data-a="mimgdel">حذف صورة المتجر</button></div>` : ''}<div class="r"><b style="font-size:1.1rem" class="g">${esc(m.name)}</b><span class="tg ${(B[m.status] || ['', 'i'])[1]}">${(B[m.status] || [m.status])[0]}</span></div>
${row('صاحب الحساب', (m.owner_name ? m.owner_name + ' — ' : '') + m.owner)}${row('الهاتف', m.phone)}${row('المحافظة', m.province)}${row('المنطقة', m.area)}${row('أقرب دالة', m.landmark)}${row('رمز الإحالة', m.ref_code)}${m.fee ? row('الرسوم المدفوعة', nf(m.fee) + ' نقطة') : ''}
<div class="mu" style="margin-top:6px">خصم ${m.discount}% · السقف اليومي: ${m.cap ? nf(m.cap) : 'غير محدد'} · اليوم: ${nf(m.today)} · الإجمالي: ${nf(m.total)}</div>
${m.status === 'pending' ? `<div class="r" style="margin-top:8px"><input class="mcap g" type="number" placeholder="السقف اليومي (نقاط)" value="${m.cap || ''}"><input class="mdis" type="number" placeholder="الخصم %" value="${m.discount}" style="max-width:100px"></div><input class="mnote" placeholder="سبب الرفض (اختياري)">
<div class="r" style="margin-top:6px"><button class="b ok" data-a="msave" data-st="active">موافقة وتفعيل</button><button class="b d" data-a="mreject">رفض وإعادة الرسوم</button></div>`
          : `<div class="r" style="margin-top:8px"><input class="mcap g" type="number" placeholder="السقف اليومي (نقاط)" value="${m.cap || ''}"><input class="mdis" type="number" placeholder="الخصم %" value="${m.discount}" style="max-width:100px"></div>
<div class="r" style="margin-top:6px"><button class="b p" data-a="msave" data-st="${m.status === 'rejected' ? 'pending' : 'active'}">${m.status === 'active' ? 'حفظ' : m.status === 'rejected' ? 'إعادة للمراجعة' : 'تفعيل'}</button>${m.status === 'active' ? '<button class="b" data-a="msave" data-st="suspended">إيقاف</button>' : ''}<button class="b d" data-a="mdel">حذف</button></div>`}</div>`;
      const pend = j.merchants.filter((m) => m.status === 'pending'), rest = j.merchants.filter((m) => m.status !== 'pending');
      const lim = Number(j.pay_limit) || 0, act = j.merchants.filter((m) => m.status === 'active'), sT = (k) => act.reduce((t, m) => t + (+m[k] || 0), 0);
      return hero('store', 'التجار المعتمدون', nf(act.length), 'تاجر', [['بانتظار الموافقة', nf(pend.length)], ['مستلم اليوم', nf(sT('today'))], ['إجمالي المستلم', nf(sT('total'))]]) + `<div class="c"><b>الحد اليومي للدفع للتجار</b><div class="mu" style="margin:4px 0 6px">أقصى عدد نقاط يستطيع المستخدم الواحد دفعه للتجار خلال اليوم (يُصفَّر منتصف الليل بتوقيت بغداد). اكتب 0 لإلغاء الحد.</div><div class="r"><input id="mpl" class="g" type="number" inputmode="numeric" min="0" value="${lim}" placeholder="1000000"><button class="b p" data-a="mplsave">حفظ</button></div></div>` +
        `<div class="c"><button class="b p" data-a="madd">${ico('plus')} إضافة تاجر معتمد</button><div class="mu" style="margin-top:6px">طلبات التجار تصل هنا بعد استقطاع الرسوم من المستخدم. عند الرفض تُعاد الرسوم تلقائياً.</div></div>` +
        (pend.length ? `<div class="sh"><span>طلبات بانتظار الموافقة</span><span class="tg d">${pend.length}</span></div>` + pend.map(card).join('') : '') +
        `<div class="sh"><span>المتاجر</span></div>` + (rest.length ? rest.map(card).join('') : '<div class="c mu">لا توجد متاجر بعد</div>');
    },
    async reports() {
      const j = await api('/api/ctl/reports?status=' + rep);
      return hero('flag', rep === 'open' ? 'البلاغات المفتوحة' : 'البلاغات المعالجة', nf(j.reports.length), 'بلاغ', [['بصورة', nf(j.reports.filter((r) => r.shot).length)], ['محظورة', nf(j.reports.filter((r) => r.target_blk).length)], ['الحالة', rep === 'open' ? 'تحتاج معالجة' : 'مغلقة']]) + `<div class="r" style="margin-bottom:10px"><button class="b ${rep === 'open' ? 'p' : ''}" data-a="rtab" data-v="open">المفتوحة</button><button class="b ${rep === 'closed' ? 'p' : ''}" data-a="rtab" data-v="closed">المعالجة</button></div>` +
        (j.reports.map((r) => `<div class="c"><div class="r"><b>${esc(r.reason)}</b><span class="g"></span><span class="mu">${dt(r.created_at)}</span></div>
<div class="mu" dir="ltr">المبلِّغ: ${esc(r.reporter)}</div><div dir="ltr">المبلَّغ عنه: <b>${esc(r.target)}</b> ${r.target_blk ? '<span style="color:#ef5350">[محظور]</span>' : ''}</div>
<p>${esc(r.details)}</p>${r.shot ? `<img class="s" src="${r.shot}">` : ''}${r.status !== 'open' ? `<div class="mu">الحالة: ${esc(r.status)} ${esc(r.note || '')}</div>` : `
<textarea id="rn${r.id}" rows="2" placeholder="ملاحظة أو نص التنبيه لصاحب الحساب"></textarea>
<div class="r"><button class="b d" data-a="rban" data-id="${r.id}">حظر الحساب</button><button class="b" data-a="rwarn" data-id="${r.id}">تنبيه صاحب الحساب</button><button class="b" data-a="rclose" data-id="${r.id}">إغلاق</button></div>`}</div>`).join('') || '<div class="c mu">لا توجد بلاغات</div>');
    },
    async fin() {
      const j = await api('/api/ctl/fin2/summary'), L = j.liability, types = j.types || [], cash = j.cash_in || 0, net = j.net || 0;
      const typeCards = types.map((t, i) => tile(esc(t.label), nf(t.iqd), 'هذا الشهر ' + nf(t.mon) + (t.liab ? ' · التزام يُرد' : ''), PAL[i % PAL.length], cash ? Math.round(t.iqd * 100 / cash) : 0, t.liab ? 'lb' : '')).join('');
      const pTot = j.parts.reduce((t, x) => t + Math.max(0, x.iqd), 0);
      const partCards = j.parts.map((x, i) => tile(esc(x.label), (x.iqd < 0 ? '-' : '') + nf(Math.abs(x.iqd)), x.iqd < 0 ? 'خسارة' : 'د.ع', x.iqd < 0 ? '#ff7a75' : PAL[(i + 3) % PAL.length], pTot && x.iqd > 0 ? Math.round(x.iqd * 100 / pTot) : 0)).join('');
      const k = (ic, l, v, em) => `<div class="k"><small>${ico(ic)}${l}</small><b>${v}</b>${em ? `<em>${em}</em>` : ''}</div>`;
      return hero('list', 'صافي الربح ' + (j.year || new Date().getFullYear()), (net < 0 ? '-' : '') + nf(Math.abs(net)), 'د.ع', [['الوارد النقدي', nf(cash)], ['الأرباح', nf(j.profit)], ['المصاريف', nf(j.expenses)]], net < 0) +
        note('تُحسب الأرقام منذ ' + (j.since ? dt(j.since) : 'بداية التشغيل') + '. إعادة التعيين (من تبويب «المالية») لا تحذف السجل، وتستثني حساب التطبيق إن فعّلت إخفاءه.') +
        `<div class="sh"><span>أنواع الإيراد</span></div>` + (typeCards ? `<div class="tg2">${typeCards}</div>` : '<div class="c mu" style="text-align:center">لا إيرادات مسجّلة بعد</div>') +
        `<div class="sh"><span>مصادر الأرباح</span></div><div class="tg2">${partCards}</div>` +
        `<div class="sh"><span>المبيعات</span></div><div class="kg">${k('coin', 'القطع المباعة', nf(j.sales.units))}${k('dollar', 'إجمالي البيع', nf(j.sales.revenue) + ' د.ع')}${k('bolt', 'هامش الربح', j.sales.margin + '%')}</div>` +
        `<div class="sh"><span>الأكثر طلباً</span></div><div class="c">${j.top.map((t) => `<div class="lst"><div class="g"><b>${esc(t.name)}</b> ${t.missing ? '<span class="tg w">بلا سعر شراء/بيع</span>' : ''}<div class="mu">العدد ${nf(t.units)} · البيع ${nf(t.revenue)} د.ع</div></div><b style="color:${t.profit < 0 ? '#ff7a75' : '#3ddc68'}">${nf(t.profit)}</b></div>`).join('') || '<div class="mu">لا مبيعات بعد</div>'}</div>` +
        `<div class="sh"><span>أموال المستخدمين الواجب إرجاعها (${L.months} أشهر)</span></div><div class="tg2">${tile('المستلم من العدادات', nf(L.received), 'د.ع', '#22d3ee', 100)}${tile('رُدّ كعوائد', nf(L.paid), 'د.ع', '#34d399', L.received ? Math.round(L.paid * 100 / L.received) : 0)}${tile('المتبقي', nf(L.outstanding), 'د.ع', '#f5b82e', L.received ? Math.round(L.outstanding * 100 / L.received) : 0)}${tile('المطلوب تحويله شهرياً', nf(L.monthly), 'د.ع', '#a78bfa')}</div>`;
    },
    async finset() {
      const [j, c] = await Promise.all([api('/api/ctl/fin2/summary'), api('/api/ctl/fin2/costs')]);
      const S = j.settings, row = (a, b, col) => `<div class="lst"><span class="g">${a}</span><b${col ? ` style="color:${col}"` : ''}>${b}</b></div>`;
      const names = new Set(c.items.map((x) => x.name)), extra = (typeof PR !== 'undefined' ? PR.map((p) => p[0]) : []).filter((n) => !names.has(n)).map((name) => ({ name, kind: 'product', buy: 0, sell: 0 }));
      const costRow = (x) => `<div class="c" data-cn="${esc(x.name)}" data-ck="${x.kind}"><b>${esc(x.name)}</b><div class="r"><input class="cb" type="number" placeholder="سعر الشراء (د.ع)" value="${x.buy || ''}"><input class="cs" type="number" placeholder="سعر البيع (د.ع)" value="${x.sell || ''}"><button class="b p" data-a="csave">حفظ</button></div></div>`;
      return hero('coin', 'رصيد صاحب التطبيق', nf(j.owner.balance), 'د.ع', [['الأرباح', nf(j.profit)], ['الرصيد الافتتاحي', nf(S.open_bal)], ['أشهر الإرجاع', nf(S.months)]], j.owner.balance < 0) +
        `<div class="sh"><span>مصدر الرصيد${j.since ? ' · منذ ' + dt(j.since) : ''}</span></div><div class="c">${j.owner.sources.map((x) => row(esc(x.label), nf(x.iqd) + ' د.ع', x.iqd < 0 ? '#ef5350' : '')).join('') || '<div class="mu">لا بيانات</div>'}</div>` +
        `<div class="sh"><span>إعدادات المالية</span></div><div class="c"><div class="mu">إيميل حساب التطبيق (يُخفى من الإحصائيات)</div><input id="fa" dir="ltr" value="${esc(S.app_email)}"><label class="r"><input id="fh" type="checkbox" style="width:auto" ${S.hide_app ? 'checked' : ''}> إخفاء رصيد حساب التطبيق وعدم احتسابه</label>
<div class="r"><input id="fm" type="number" placeholder="أشهر الإرجاع" value="${S.months}"><input id="fd" type="number" placeholder="% ربح الاستدانة من القسط" value="${S.debt_pct}"></div>
<div class="r"><input id="fo" type="number" placeholder="الرصيد الافتتاحي (د.ع)" value="${S.open_bal || ''}"><input id="fs" placeholder="مصدر الرصيد الافتتاحي" value="${esc(S.open_src)}"></div>
<div class="r"><button class="b p" data-a="fset">حفظ</button><button class="b d" data-a="freset">إعادة تعيين الإحصائيات والبدء من جديد</button></div><div class="mu">إعادة التعيين لا تحذف السجل، فقط تبدأ الحساب من الآن.</div></div>` +
        `<div class="sh"><span>أسعار الشراء والبيع</span></div><div class="mu" style="margin-bottom:6px">الربح = (البيع − الشراء) × العدد، ويُحسب بعد حفظ السعرين.</div>${c.items.concat(extra).map(costRow).join('')}`;
    },
    async ledger() {
      const j = await api(`/api/ctl/fin2/ledger?kind=${lf.kind}&cat=${lf.cat}&q=${encodeURIComponent(lf.q)}`);
      const lnet = j.totals.in - j.totals.out;
      return hero('list', 'سجل العمليات', (lnet < 0 ? '-' : '') + nf(Math.abs(lnet)), 'د.ع الصافي', [['الإيرادات', nf(j.totals.in)], ['المصروفات', nf(j.totals.out)], ['عدد الحركات', nf(j.rows.length)]], lnet < 0) + `<div class="c"><div class="r"><select id="lk"><option value="">الكل</option><option value="in" ${lf.kind === 'in' ? 'selected' : ''}>إيرادات</option><option value="out" ${lf.kind === 'out' ? 'selected' : ''}>مصروفات</option></select>
<select id="lc"><option value="">كل التصنيفات</option>${Object.entries(j.cats).map(([k, v]) => `<option value="${k}" ${lf.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
<div class="r"><input id="lq" class="g" placeholder="بحث بالبريد أو التفاصيل" value="${esc(lf.q)}"><button class="b p" data-a="lfilter">تطبيق</button></div>
<div class="mu">إيرادات ${nf(j.totals.in)} · مصروفات ${nf(j.totals.out)} · الصافي ${nf(j.totals.in - j.totals.out)} د.ع</div></div>
<div class="c"><b>إضافة قيد يدوي</b><div class="r"><select id="mk"><option value="in">إيراد</option><option value="out">مصروف</option></select><input id="mc" placeholder="التصنيف (مثل: إيجار)"></div><div class="r"><input id="mi" type="number" placeholder="المبلغ (د.ع)"><input id="mn" class="g" placeholder="التفاصيل"></div><button class="b p" data-a="ladd">إضافة</button></div>` +
        (j.rows.map((r) => `<div class="c" style="${r.pre_reset ? 'opacity:.6' : ''}"><div class="r"><b style="color:${r.kind === 'in' ? '#4caf50' : '#ef5350'}">${r.kind === 'in' ? '+' : '−'}${nf(r.iqd)} د.ع</b><span class="mu">${esc(r.cat_label)}</span><span class="g"></span><span class="mu">${dt(r.ts)}</span></div>
<div class="mu" dir="ltr">من: ${esc(r.from)} ← إلى: ${esc(r.to)}${r.app ? ' [حساب التطبيق]' : ''}</div><div>${esc(r.note || '')}</div>${r.src === 'manual' ? `<button class="b d" data-a="ldel" data-id="${esc(r.uid)}">حذف</button>` : ''}</div>`).join('') || '<div class="c mu">لا توجد حركات</div>');
    },
    async agbuys() {
      const j = await api('/api/ctl/agent-buys'), S = { pending: ['بانتظار الموافقة', 'w'], approved: ['تمت الموافقة', 'o'], rejected: ['مرفوض', 'd'] };
      const card = (r) => `<div class="c" data-ab="${r.id}"><div class="r"><b style="font-size:1.1rem" class="g">${esc(r.agent || r.name || r.email)}</b><span class="tg ${(S[r.status] || ['', 'i'])[1]}">${(S[r.status] || [r.status])[0]}</span></div>
<div class="mu" dir="ltr" style="text-align:start">${esc(r.email)}${r.name ? ' — ' + esc(r.name) : ''}</div>
<div class="r" style="margin-top:4px"><span class="mu">📞 رقم الهاتف:</span><b dir="ltr" class="g" style="text-align:start">${r.phone ? esc(r.phone) : 'غير مسجّل'}</b>${r.phone ? `<a class="b s" style="text-decoration:none" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ''))}">اتصال</a>` : ''}</div>
<div class="kg" style="margin:10px 0 6px"><div class="k"><small>${ico('dollar')}المبلغ المطلوب منه بالدينار</small><b>${nf(r.iqd)} د.ع</b><em>≈ $${nf(r.usd)} · ${nf(r.rate)} د.ع / 1000 نقطة</em></div><div class="k"><small>${ico('coin')}النقاط التي سيحصل عليها</small><b>${nf(r.pts)}</b></div></div>
<div class="mu">${dt(r.at)}${r.decided ? ' · عولج: ' + dt(r.decided) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div>` +
        (r.status === 'pending' ? `<input class="abn" placeholder="ملاحظة / سبب الرفض (اختياري)"><div class="r" style="margin-top:6px"><button class="b ok g" data-a="abok">موافق — شحن السيولة بـ ${nf(r.pts)} نقطة</button><button class="b d" data-a="abno">رفض</button></div>` : '') + '</div>';
      const pend = j.items.filter((r) => r.status === 'pending'), rest = j.items.filter((r) => r.status !== 'pending');
      const apr = j.items.filter((r) => r.status === 'approved');
      return hero('coin', 'طلبات شراء نقاط الوكلاء', nf(pend.length), 'طلب معلّق', [['نقاط معلّقة', nf(pend.reduce((t, r) => t + (+r.pts || 0), 0))], ['تمت الموافقة', nf(apr.length)], ['نقاط معتمدة', nf(apr.reduce((t, r) => t + (+r.pts || 0), 0))]]) + '<div class="c mu">يقدّم الوكيل من لوحته طلب شراء نقاط بالسعر الرسمي، فتظهر هنا بياناته والمبلغ المطلوب منه بالدينار ورقم هاتفه. عند «موافق» تُشحن سيولته بالنقاط المطلوبة فوراً وتصله على جهازه لحظياً، ويُسجَّل المبلغ في المالية.</div>' +
        (pend.length ? `<div class="sh"><span>طلبات بانتظار الموافقة</span><span class="tg d">${pend.length}</span></div>` + pend.map(card).join('') : '<div class="c mu" style="text-align:center">لا توجد طلبات معلّقة</div>') +
        (rest.length ? '<div class="sh"><span>السجل</span></div>' + rest.map(card).join('') : '');
    },
    async ptsreq() {
      const j = await api('/api/ctl/pts-requests'), S = { pending: ['بانتظار الموافقة', 'w'], approved: ['تمت الموافقة', 'o'], rejected: ['مرفوض', 'd'] };
      const card = (r) => `<div class="c" data-pr="${r.id}"><div class="r"><b style="font-size:1.1rem" class="g">${esc(r.name || r.email)}</b><span class="tg ${(S[r.status] || ['', 'i'])[1]}">${(S[r.status] || [r.status])[0]}</span></div>
<div class="mu" dir="ltr" style="text-align:start">${esc(r.email)}</div>
<div class="r" style="margin-top:4px"><span class="mu">📞 رقم الهاتف:</span><b dir="ltr" class="g" style="text-align:start">${r.phone ? esc(r.phone) : 'غير مسجّل'}</b>${r.phone ? `<a class="b s" style="text-decoration:none" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ''))}">اتصال</a>` : ''}</div>
<div class="kg" style="margin:10px 0 6px"><div class="k"><small>${ico('coin')}النقاط المطلوبة (ستُشحن لحسابه)</small><b>${nf(r.pts)}</b></div><div class="k"><small>${ico('dollar')}المبلغ المقابل بالدينار</small><b>${nf(r.iqd)} د.ع</b><em>≈ $${nf(r.usd)} · ${nf(r.rate)} د.ع / 1000 نقطة</em></div></div>
<div class="mu">رصيده الحالي: ${nf(r.bal)} نقطة · ${dt(r.at)}${r.decided ? ' · عولج: ' + dt(r.decided) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div>` +
        (r.status === 'pending' ? `<input class="prn" placeholder="ملاحظة / سبب الرفض (اختياري)"><div class="r" style="margin-top:6px"><button class="b ok g" data-a="prok">موافق — شحن ${nf(r.pts)} نقطة لحسابه</button><button class="b d" data-a="prno">رفض</button></div>` : '') + '</div>';
      const pend = j.items.filter((r) => r.status === 'pending'), rest = j.items.filter((r) => r.status !== 'pending'), apr = j.items.filter((r) => r.status === 'approved');
      const wa = `<div class="c"><div class="r"><b class="g">أزرار واتساب في شاشة «طلب شراء وكالة»</b><span class="tg ${j.wa ? 'o' : 'd'}">${j.wa ? 'ظاهرة' : 'مخفية'}</span></div><div class="mu" style="margin:4px 0 8px">عند الإخفاء يرى المستخدم زر «تقديم طلب عبر لوحة التحكم» فقط. عند الإظهار تظهر أزرار واتساب بجانبه.</div><button class="b ${j.wa ? 'd' : 'ok g'}" data-a="prwa" data-v="${j.wa ? 0 : 1}">${j.wa ? 'إخفاء أزرار واتساب' : 'إظهار أزرار واتساب'}</button></div>`;
      return hero('coin', 'طلبات شراء النقاط', nf(pend.length), 'طلب معلّق', [['نقاط معلّقة', nf(pend.reduce((t, r) => t + (+r.pts || 0), 0))], ['تمت الموافقة', nf(apr.length)], ['نقاط مشحونة', nf(apr.reduce((t, r) => t + (+r.pts || 0), 0))]]) + wa +
        '<div class="c mu">يقدّم المستخدم طلب نقاط من شاشة «طلب شراء وكالة»، فيصلك هنا اسمه وبريده ورقم هاتفه والمبلغ المقابل. عند «موافق» يُشحن رصيده بالنقاط التي طلبها فوراً وتصله على جهازه لحظياً، ويُسجَّل المبلغ في المالية.</div>' +
        (pend.length ? `<div class="sh"><span>طلبات بانتظار الموافقة</span><span class="tg d">${pend.length}</span></div>` + pend.map(card).join('') : '<div class="c mu" style="text-align:center">لا توجد طلبات معلّقة</div>') +
        (rest.length ? '<div class="sh"><span>السجل</span></div>' + rest.map(card).join('') : '');
    },
    async agents() {
      if (agSel) {
        const [L, J] = await Promise.all([api('/api/ctl/agents/log?email=' + encodeURIComponent(agSel)), api('/api/ctl/agents')]);
        const a = J.items.find((x) => x.email === agSel) || { name: agSel };
        return `<button class="b s" data-a="agback">← كل الوكلاء</button><div class="sh"><span>${esc(a.name)} · حركات الوكيل</span></div><div class="mu" dir="ltr" style="text-align:start;margin-bottom:8px">${esc(agSel)}</div>` + (L.items.map((r) => `<div class="c"><div class="r"><b>${esc(r.label)}</b><span class="g"></span><b style="color:${r.pts < 0 ? '#ef5350' : '#3ddc68'}">${r.pts ? (r.pts > 0 ? '+' : '') + nf(r.pts) + ' نقطة' : r.usd ? '$' + nf(r.usd) : ''}</b></div>${r.who ? `<div class="mu">${esc(r.who)}</div>` : ''}${r.note ? `<div class="mu">${esc(r.note)}</div>` : ''}<div class="mu" style="font-size:.75rem">${dt(r.t)}</div></div>`).join('') || '<div class="c mu">لا توجد حركات مسجلة لهذا الوكيل بعد</div>');
      }
      const j = await api('/api/ctl/agents');
      const st = (l, v) => `<div style="flex:1;min-width:46%;margin:4px 0"><div class="mu">${l}</div><b>${v}</b></div>`;
      return hero('users', 'مراقبة الوكلاء', nf(j.items.length), 'وكيل', [['مجموع الأرصدة', nf(j.items.reduce((t, a) => t + (+a.balance || 0), 0))], ['الرصيد الرسمي', nf(j.items.reduce((t, a) => t + (+a.off || 0), 0))], ['نشطون', nf(j.items.filter((a) => a.last).length)]]) + '<div class="mu" style="margin-bottom:8px">إجمالي كل وكيل: ما باعه، وما حُوّل إليه، وما أضافه لرصيده الرسمي، وسحوباته. الحركات تُسجَّل منذ تحديث هذه النسخة.</div>' + (j.items.map((a) => `<div class="c"><div class="r"><b>${esc(a.name)}</b><span class="g"></span><span class="mu">${a.last ? 'آخر حركة ' + dt(a.last) : 'لا حركات'}</span></div><div class="mu" dir="ltr" style="text-align:start">${esc(a.email)}</div><div class="r" style="flex-wrap:wrap;margin-top:6px">${st('رصيد حسابه', nf(a.balance) + ' نقطة')}${st('السيولة', nf(a.liq))}${st('الرصيد الرسمي', nf(a.off))}${st('باع (شحن أعضاء)', nf(a.sold.pts) + ' نقطة · ' + a.sold.n + ' عملية · ' + a.sold.members + ' عضو')}${st('حُوّل إليه من مستخدمين', nf(a.recv.pts) + ' نقطة · ' + a.recv.n + ' عملية')}${st('أضاف للرصيد الرسمي', nf(a.addoff.pts) + ' نقطة · ' + a.addoff.n)}${st('طلبات شراء بالسعر الرسمي', nf(a.buy.pts) + ' نقطة · ' + a.buy.n)}${st('شحن/خصم الإدارة', '+' + nf(a.admin.plus) + ' / −' + nf(a.admin.minus))}${st('طلبات سحب الرصيد', '$' + nf(a.wd.usd) + ' · ' + a.wd.n + (a.wd.pending ? ' (' + a.wd.pending + ' قيد المراجعة)' : ''))}</div><div class="r" style="margin-top:8px"><span class="g"></span><button class="b p" data-a="aglog" data-e="${esc(a.email)}">كل حركاته</button></div></div>`).join('') || '<div class="c mu">لا يوجد وكلاء معتمدون في الإعدادات المنشورة</div>');
    },
    async campaigns() {
      const j = await api('/api/ctl/campaigns');
      const row = (c) => { const id = c.id || 0; return `<div class="c" data-cp="${id}"><input class="cpt" placeholder="اسم الحملة (مثال: فشل كلوي)" value="${esc(c.title || '')}"><textarea class="cpd" rows="4" placeholder="وصف الحالة المرضية">${esc(c.descr || '')}</textarea><div class="r"><input class="cpg g" type="number" min="0" placeholder="الهدف بالنقاط (0 = بلا هدف)" value="${c.goal || ''}"><label class="mu" style="display:flex;align-items:center;gap:6px;white-space:nowrap"><input type="checkbox" class="cpa" style="width:auto" ${c.active === false ? '' : 'checked'}> تظهر للجميع</label></div>${c.img ? `<img src="${esc(c.img)}" alt="" style="max-width:100%;max-height:220px;border-radius:12px;margin:8px 0;object-fit:cover">` : ''}<input type="file" accept="image/*" class="cpf" style="margin-top:8px"><div class="mu cpn">${cpImg[id] ? 'تم اختيار صورة جديدة' : (id ? 'اختر صورة لتغيير الحالية' : 'اختر صورة الحالة (مطلوبة)')}</div>${id ? `<div class="mu" style="margin-top:6px">تم جمع <b>${(c.raised || 0).toLocaleString('en')}</b> نقطة · ${c.donors || 0} متبرع</div>` : ''}<div class="r" style="margin-top:8px"><span class="g"></span><button class="b p" data-a="cpsave">${id ? 'حفظ' : 'إضافة الحملة'}</button>${id ? '<button class="b d" data-a="cpdel">حذف</button>' : ''}</div></div>`; };
      return hero('heart', 'حملات التبرع', nf(j.items.length), 'حملة', [['الظاهرة للجميع', nf(j.items.filter((c) => c.active !== false).length)], ['المخفية', nf(j.items.filter((c) => c.active === false).length)], ['مجموع الأهداف', nf(j.items.reduce((t, c) => t + (+c.goal || 0), 0))]]) + '<div class="mu" style="margin-bottom:8px">كل حملة تظهر لجميع المستخدمين داخل نافذة «التبرع للجمعيات الخيرية» بصورتها ووصفها ومجموع ما جُمع لها.</div>' + row({}) + j.items.map(row).join('');
    },
    async faq() {
      const j = await (await fetch('/api/faq')).json();
      const row = (f) => `<div class="c" data-f="${f.id || 0}"><input class="fc" placeholder="القسم" value="${esc(f.cat || '')}"><input class="fq" placeholder="السؤال" value="${esc(f.q || '')}"><textarea class="fa" rows="3" placeholder="الجواب">${esc(f.a || '')}</textarea>
<div class="r"><input class="fs" type="number" style="width:90px" placeholder="الترتيب" value="${f.sort || 0}"><span class="g"></span><button class="b p" data-a="fsave">حفظ</button>${f.id ? '<button class="b d" data-a="fdel">حذف</button>' : ''}</div></div>`;
      return hero('help', 'الأسئلة الشائعة', nf(j.items.length), 'سؤال', [['الأقسام', nf(new Set(j.items.map((f) => f.cat)).size)], ['أسئلة مخصّصة', nf(j.items.length)], ['الحالة', j.items.length ? 'مخصّصة' : 'افتراضية']]) + '<div class="mu" style="margin-bottom:8px">تظهر هذه الأسئلة للمستخدمين في قسم المساعدة. إن كانت القائمة فارغة تُستخدم الأسئلة الافتراضية.</div>' + row({}) + j.items.map(row).join('');
    },
  };

  const lastHtml = {}; let lastScroll = 0;
  M.addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
  const tpl = document.createElement('template');
  async function draw(keep, force) {
    if (busy) return; busy = true;
    ov.querySelectorAll('.axn [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    ov.style.setProperty('--ta', TC[tab] || '#22d3ee');
    try {
      const html = await V[tab]();
      const y = M.scrollTop, typing = M.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (keep && html === lastHtml[tab]) { busy = false; return; }
      if (keep && !force && Date.now() - lastScroll < 1200) { busy = false; return; }
      if (keep && typing && tab !== 'counters') { busy = false; return; }
      lastHtml[tab] = html;
      if (tab === 'counters' && keep && M.dataset.tab === 'counters') { patchCounters(html); M.scrollTop = y; }
      else { M.innerHTML = html; M.dataset.tab = tab; M.scrollTop = keep ? y : 0; }
      if (tab === 'support' && thread) { const t = M.querySelector('#axt'); t && (t.parentElement.scrollTop = 1e9); }
    } catch (e) { err(e); }
    busy = false;
  }
  // تحديث تبويب العدادات: الرأس والبحث يُحدَّثان في أماكنهما، والبطاقات تُقارن بالمفتاح (البريد) فيُستبدل المتغيّر فقط
  function patchCounters(html) {
    tpl.innerHTML = html; const nk = Array.from(tpl.content.children), q = M.querySelector('#cq'), hadFocus = q && document.activeElement === q;
    const curKids = Array.from(M.children), curList = M.querySelector('#clist'), newList = tpl.content.querySelector('#clist');
    if (!curList || !newList) { M.innerHTML = html; return; }
    // القوائم: مقارنة بطاقة بطاقة
    const cm = new Map(); Array.from(curList.children).forEach((n) => { if (n.dataset.ce) cm.set(n.dataset.ce, n); });
    const want = Array.from(newList.children), fin = new Set(); let prev = null;
    want.forEach((nn) => {
      const k = nn.dataset.ce; let ex = k ? cm.get(k) : null;
      if (ex) { if (ex.outerHTML !== nn.outerHTML) { ex.replaceWith(nn); ex = nn; } cm.delete(k); }
      else ex = nn;
      const wantPos = prev ? prev.nextElementSibling : curList.firstElementChild;
      if (ex !== wantPos) curList.insertBefore(ex, wantPos);
      prev = ex; fin.add(ex);
    });
    Array.from(curList.children).forEach((n) => { if (!fin.has(n)) n.remove(); });
    // بقية العناصر خارج القائمة (الرأس، الإحصاءات، زر عرض المزيد، السجل): بالترتيب
    const nOut = nk.filter((n) => n.id !== 'clist'), cOut = curKids.filter((n) => n.id !== 'clist');
    if (nOut.length !== cOut.length) { const ys = M.scrollTop; M.innerHTML = html; M.scrollTop = ys; return; }
    nOut.forEach((n, i) => { const c = cOut[i]; if (c.querySelector && c.querySelector('#cq')) return; if (c.outerHTML !== n.outerHTML) c.replaceWith(n); });
    const cq2 = M.querySelector('#cq'); if (cq2 && hadFocus) cq2.focus();
  }

  async function act(el) {
    const a = el.dataset.a, e = el.dataset.e, id = el.dataset.id;
    const post = async (p, b) => { try { await api(p, b); } catch (x) { return alert(x.message); } draw(); };
    if (a === 'usearch') { uq = M.querySelector('#uq').value.trim(); return draw(); }
    if (a === 'purge') return confirm('حذف كل الحسابات التجريبية؟ الحسابات الحقيقية لن تُمس.') && post('/api/ctl/users/purge-demo', { confirm: true });
    if (a === 'del') return confirm('حذف الحساب ' + e + ' نهائياً؟') && post('/api/ctl/users/act', { email: e, op: 'delete', confirm: true });
    if (a === 'uch') return chargeModal(e, el.dataset.n, 'add');
    if (a === 'udd') return chargeModal(e, el.dataset.n, 'sub');
    if (a === 'uzero') return zeroModal(e, el.dataset.n);
    if (a === 'cgo') {
      const g = (i) => (ov.querySelector(i) || {}).value || '';
      try {
        const r = await api('/api/ctl/bal', { email: e, op: chMode, pts: g('#cp'), gems: g('#cg'), usd: g('#cu'), note: g('#cn') });
        closeModal(); flash('تم التنفيذ ✓ ' + fmtAfter(r.after)); draw(true);
      } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'zgo') {
      const c = (i) => ov.querySelector(i).checked ? 1 : 0, z = { p: c('#zp'), g: c('#zg'), d: c('#zd') };
      if (!z.p && !z.g && !z.d) return flash('اختر ما تريد تصفيره', 1);
      try { const r = await api('/api/ctl/bal', { email: e, op: 'zero', z }); closeModal(); flash('تم التصفير ✓ ' + fmtAfter(r.after)); draw(true); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'ban' || a === 'unban') return post('/api/ctl/users/act', { email: e, op: a });
    if (a === 'rtab') { rep = el.dataset.v; return draw(); }
    if (a === 'rban' || a === 'rwarn' || a === 'rclose') { const note = (M.querySelector('#rn' + id) || {}).value || ''; if (a === 'rban' && !confirm('حظر الحساب المبلّغ عنه؟')) return; return post('/api/ctl/reports/act', { id: +id, op: a.slice(1), note }); }
    if (a === 'open') { thread = e; return draw(); }
    if (a === 'back') { thread = null; return draw(); }
    if (a === 'areply') { const body = M.querySelector('#ar').value.trim(); if (!body && !shot) return; const s = shot; shot = null; return post('/api/ctl/support/reply', { e: thread, body, img: s }); }
    if (a === 'fset') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin2/settings', { app_email: g('#fa').value, hide_app: g('#fh').checked, months: +g('#fm').value, debt_pct: +g('#fd').value, open_bal: +g('#fo').value, open_src: g('#fs').value }); }
    if (a === 'freset') return confirm('إعادة تعيين الإحصائيات المالية والبدء من جديد؟ السجل القديم يبقى محفوظاً.') && post('/api/ctl/fin2/reset', { confirm: true });
    if (a === 'csave') { const c = el.closest('[data-cn]'); return post('/api/ctl/fin2/costs', { name: c.dataset.cn, kind: c.dataset.ck, buy: +c.querySelector('.cb').value, sell: +c.querySelector('.cs').value }); }
    if (a === 'lfilter') { lf = { kind: M.querySelector('#lk').value, cat: M.querySelector('#lc').value, q: M.querySelector('#lq').value.trim() }; return draw(); }
    if (a === 'ladd') { const g = (i) => M.querySelector(i); return post('/api/ctl/fin/add', { kind: g('#mk').value, cat: g('#mc').value, iqd: +g('#mi').value, note: g('#mn').value }); }
    if (a === 'ldel') return confirm('حذف هذا القيد اليدوي؟') && post('/api/ctl/fin/del', { uid: id });
    if (a === 'madd') {
      return modal(`<h2>إضافة تاجر معتمد</h2><input id="mo" dir="ltr" placeholder="بريد صاحب المتجر"><input id="mnm" placeholder="اسم المتجر"><input id="mpv" placeholder="المحافظة"><div class="r"><input id="mdc" class="g" type="number" placeholder="الخصم %" value="10"><input id="mcp" class="g" type="number" placeholder="السقف اليومي (0 = بلا سقف)" value="0"></div><div class="r" style="margin-top:8px"><button class="b p g" data-a="maddgo">إضافة</button><button class="b" data-mc="1">إلغاء</button></div>`);
    }
    if (a === 'maddgo') {
      const g = (i) => (ov.querySelector(i) || {}).value || '';
      if (!g('#mo') || !g('#mnm')) return flash('أدخل بريد صاحب المتجر واسم المتجر', 1);
      try { await api('/api/ctl/merchants/add', { owner: g('#mo'), name: g('#mnm'), province: g('#mpv'), discount: +g('#mdc') || 10, daily_cap: +g('#mcp') || 0 }); closeModal(); flash('تمت الإضافة'); draw(true); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'mplsave') { const v = (ov.querySelector('#mpl') || {}).value; try { await api('/api/ctl/merchants/settings', { pay_limit: v }); flash('تم حفظ الحد اليومي'); draw(); } catch (x) { flash(x.message, 1); } return; }
    if (a === 'prok' || a === 'prno') {
      const c = el.closest('[data-pr]'), ok = a === 'prok', note = (c.querySelector('.prn') || {}).value || '';
      if (ok && !confirm('تأكيد الموافقة؟ سيُشحن رصيد المستخدم بالنقاط المطلوبة فوراً ولا يمكن التراجع.')) return;
      try { await api('/api/ctl/pts-requests/act', { id: +c.dataset.pr, act: ok ? 'approve' : 'reject', note }); flash(ok ? 'تمت الموافقة ✓ شُحن رصيد المستخدم' : 'تم الرفض'); draw(); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'prwa') {
      try { const r = await api('/api/ctl/pts-requests/settings', { wa: el.dataset.v === '1' }); flash(r.wa ? 'ظهرت أزرار واتساب للمستخدمين' : 'تم إخفاء أزرار واتساب'); draw(); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'abok' || a === 'abno') {
      const c = el.closest('[data-ab]'), ok = a === 'abok', note = (c.querySelector('.abn') || {}).value || '';
      if (ok && !confirm('تأكيد الموافقة؟ ستُضاف النقاط إلى سيولة الوكيل فوراً ولا يمكن التراجع.')) return;
      try { await api('/api/ctl/agent-buys/act', { id: +c.dataset.ab, act: ok ? 'approve' : 'reject', note }); flash(ok ? 'تمت الموافقة ✓ شُحنت سيولة الوكيل' : 'تم الرفض'); draw(); } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'mreject') { const c = el.closest('[data-m]'); if (!confirm('رفض الطلب وإعادة الرسوم للمستخدم؟')) return; return post('/api/ctl/merchants/save', { id: +c.dataset.m, status: 'rejected', note: (c.querySelector('.mnote') || {}).value || '' }); }
    if (a === 'msave') { const c = el.closest('[data-m]'); return post('/api/ctl/merchants/save', { id: +c.dataset.m, status: el.dataset.st, daily_cap: c.querySelector('.mcap').value, discount: c.querySelector('.mdis').value }); }
    if (a === 'mimgdel') { const c = el.closest('[data-m]'); return confirm('حذف صورة هذا المتجر؟') && post('/api/ctl/merchants/img-del', { id: +c.dataset.m }); }
    if (a === 'mdel') { const c = el.closest('[data-m]'); return confirm('حذف المتجر وسجل عملياته؟') && post('/api/ctl/merchants/del', { id: +c.dataset.m }); }
    if (a === 'aglog') { agSel = e; return draw(); }
    if (a === 'agback') { agSel = ''; return draw(); }
    if (a === 'cpsave' || a === 'cpdel') {
      const c = el.closest('[data-cp]'), id = +c.dataset.cp;
      if (a === 'cpdel') return confirm('حذف الحملة وسجل تبرعاتها؟') && post('/api/ctl/campaigns/del', { id });
      try {
        await api('/api/ctl/campaigns/save', { id, title: c.querySelector('.cpt').value, descr: c.querySelector('.cpd').value, goal: +c.querySelector('.cpg').value || 0, active: c.querySelector('.cpa').checked, img: cpImg[id] || undefined });
        delete cpImg[id]; flash('تم الحفظ'); draw();
      } catch (x) { flash(x.message, 1); }
      return;
    }
    if (a === 'cqs') { cq = (M.querySelector('#cq') || {}).value.trim(); ctLimit = 20; return draw(); }
    if (a === 'cqc') { cq = ''; ctLimit = 20; return draw(); }
    if (a === 'cmore') { ctLimit += 20; el.disabled = true; return draw(true, true); }
    if (a === 'cmoreall') { ctLimit = 500; el.disabled = true; return draw(true, true); }
    if (a === 'cshot') { const u = CTD.users.find((x) => x.email === e); if (!u) return; flash('جارٍ إنشاء اللقطة…'); try { await showShot(await renderUser(u), 'counters-' + String(u.email).split('@')[0]); } catch (x) { flash('تعذر إنشاء اللقطة', 1); } return; }
    if (a === 'cshotall') { if (!CTD.users.length) return flash('لا توجد بيانات للتصوير', 1); flash('جارٍ إنشاء اللقطة…'); try { await showShot(await renderSummary(), 'counters-summary'); } catch (x) { flash('تعذر إنشاء اللقطة', 1); } return; }
    if (a === 'shotdl') { if (!lastShot) return; const l = document.createElement('a'); l.href = URL.createObjectURL(lastShot.blob); l.download = lastShot.name + '.png'; document.body.appendChild(l); l.click(); l.remove(); return flash('تم حفظ الصورة ✓'); }
    if (a === 'shotsh') { try { await navigator.share({ files: [new File([lastShot.blob], lastShot.name + '.png', { type: 'image/png' })] }); } catch (x) {} return; }
    if (a === 'shotcp') { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': lastShot.blob })]); flash('تم نسخ الصورة ✓'); } catch (x) { flash('تعذر النسخ، استخدم حفظ الصورة', 1); } return; }
    if (a === 'cchg') { ctMode = 'add'; ctN = 1; return counterModal(e, el.dataset.n); }
    if (a === 'ctpick') { ctIdx = +el.dataset.i; const qi = ov.querySelector('#ctn'); if (qi) ctN = Math.max(1, Math.min(20, Math.floor(+qi.value) || 1)); const nt = ov.querySelector('#ctnote'); const note = nt ? nt.value : ''; const go = ov.querySelector('[data-a="ctgo"]'); counterModal(go.dataset.e, go.dataset.n); ov.querySelector('#ctnote').value = note; return; }
    if (a === 'ctq') { const qi = ov.querySelector('#ctn'); ctN = Math.max(1, Math.min(20, (Math.floor(+qi.value) || 1) + (+el.dataset.d))); const note = ov.querySelector('#ctnote').value, go = ov.querySelector('[data-a="ctgo"]'); counterModal(go.dataset.e, go.dataset.n); ov.querySelector('#ctnote').value = note; return; }
    if (a === 'ctgo') {
      const t = CTD.types[ctIdx], nm = el.dataset.n;
      if (!confirm(ctMode === 'add' ? `شحن ${ctN} × عداد ${t.name} للمستخدم ${nm}؟` : `تجديد كل عدادات ${nm} إلى 12 شهراً؟`)) return;
      el.disabled = true;
      try { const r = await api('/api/ctl/counters-hub/grant', { email: e, mode: ctMode, i: ctIdx, n: ctN, note: (ov.querySelector('#ctnote') || {}).value || '' }); closeModal(); flash('تم التنفيذ ✓ ' + r.note + ' · يملك الآن ' + nf(r.count) + ' عداد'); draw(true, true); }
      catch (x) { el.disabled = false; flash(x.message, 1); }
      return;
    }
    if (a === 'fsave' || a === 'fdel') {
      const c = el.closest('[data-f]'), fid = +c.dataset.f;
      if (a === 'fdel') return confirm('حذف السؤال؟') && post('/api/ctl/faq/del', { id: fid });
      return post('/api/ctl/faq/save', { id: fid, cat: c.querySelector('.fc').value, q: c.querySelector('.fq').value, a: c.querySelector('.fa').value, sort: c.querySelector('.fs').value });
    }
  }

  ov.addEventListener('click', (ev) => {
    if (ev.target.id === 'axmod') return closeModal();
    const t = ev.target.closest('[data-t],[data-x],[data-a],[data-mc]');
    if (!t) return;
    if (t.dataset.mc) return closeModal();
    if (t.dataset.x) return ov.classList.remove('on');
    if (t.dataset.t) { tab = t.dataset.t; thread = null; closeModal(); return draw(); }
    act(t);
  });
  ov.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.id === 'cq') { ev.preventDefault(); act({ dataset: { a: 'cqs' } }); } });
  ov.addEventListener('change', async (ev) => {
    if (ev.target.classList.contains('cpf') && ev.target.files[0]) {
      const c = ev.target.closest('[data-cp]');
      try { cpImg[+c.dataset.cp] = await shrink(ev.target.files[0], 1000); c.querySelector('.cpn').textContent = 'تم اختيار صورة جديدة'; } catch (e) { alert('تعذر قراءة الصورة'); }
      return;
    }
    if (ev.target.id !== 'af' || !ev.target.files[0]) return;
    try { shot = await shrink(ev.target.files[0]); M.querySelector('#an').textContent = 'تم اختيار صورة'; } catch (e) { alert('تعذر قراءة الصورة'); }
  });
  btn.onclick = () => { if (!key()) return alert('احفظ مفتاح الإدارة أولاً من قسم النظام والأمان'); ov.classList.add('on'); draw(); };


  // مزامنة فورية لمركز العدادات: تحديث كل ثانيتين + لحظياً عند وصول أي أمر من السيرفر (SSE)
  let liveT = 0; const live = () => { if (ov.classList.contains('on') && !document.hidden && tab === 'counters' && !modalOpen()) draw(true); };
  const modalOpen = () => ov.querySelector('#axmod').classList.contains('on');
  setInterval(live, 2000);
  try { if (window.EventSource) { const es = new EventSource('/api/sync/stream'); es.addEventListener('cmd', () => { clearTimeout(liveT); liveT = setTimeout(live, 150); }); } } catch (e) {}

  // تحديث دوري كل 5 ثوانٍ
  setInterval(async () => {
    if (!key()) return;
    if (ov.classList.contains('on') && !document.hidden && tab !== 'campaigns' && tab !== 'counters') draw(true);
    try {
      const c = await api('/api/ctl/counts'), n = c.reports + (c.merchants || 0) + (c.agbuys || 0) + (c.ptsreq || 0), b = btn.querySelector('i'); b.hidden = !n; b.textContent = n;
      [['reports', c.reports], ['merchants', c.merchants], ['agbuys', c.agbuys], ['ptsreq', c.ptsreq]].forEach(([t, v]) => { const x = ov.querySelector(`[data-bd="${t}"]`); if (x) { x.hidden = !v; x.textContent = v; } });
    } catch (e) {}
  }, 5000);
})();

/* ===== إخفاء الأزرار العائمة قبل تسجيل دخول الإدارة (تظهر فقط بعد الدخول) ===== */
(function () {
  if (window.__stfGate) return; window.__stfGate = 1;
  const st = document.createElement('style');
  st.textContent = 'body:not(.stf-in) #axb,body:not(.stf-in) #axo,body:not(.stf-in) #pab,body:not(.stf-in) #pao,body:not(.stf-in) #paz{display:none!important}';
  document.head.appendChild(st);
  const chk = () => { document.body.classList.toggle('stf-in', !!document.querySelector('[data-a="stfout"]')); };
  let q = 0;
  const kick = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; chk(); }); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  setInterval(chk, 700); chk();
})();

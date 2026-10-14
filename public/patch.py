import sys, io

path = sys.argv[1]
t = io.open(path, encoding='utf-8').read()

NEWJS = r"""/* ===== تنفيذ فوري على كل الأجهزة + بحث بالكود ===== */
const ucodeE=e=>'U'+sha256hex(String(e).toLowerCase()).slice(0,5).toUpperCase();
function ctlPush(b){const k=LS('adminkey','');if(!k){toast('نُفّذ على هذا الجهاز فقط — احفظ مفتاح الإدارة (الإعدادات ← التحكم المركزي) ليصل لكل الأجهزة');return}ctlApi('/cmd','POST',Object.assign({},b,{by:CID})).then(r=>{if(r)toast('تم الإرسال — يصل لكل الأجهزة خلال ثوانٍ')})}
function ctlSend(b){try{cmdRun(Object.assign({},b,{by:CID}))}catch(e){console.error(e)}ctlPush(b)}
function buildCfg(){return{v:2,t:Date.now(),cfg:Object.assign({},CFG),cards:CDS(),prods:PR,news:NEWS(),ann:ann(),demo:DM(),rfc:RFC(),dcs:DCS(),mrs:MR,agents:AG,agp:AGP(),ctr:CTR(),ctrf:(CTF()&&CTF().d.length<1.6e6)?CTF():null,terms:TMS()}}
window.autoPub=()=>{if(!S.staff||!LS('adminkey',''))return;ctlPublish(buildCfg(),1)};
async function cmdPoll(){if(document.hidden)return;const sv=LS(SYNK,null);if(sv==null)return;try{const r=await fetch('/api/sync?since='+sv+'&nocfg=1',{cache:'no-store'});if(!r.ok)return;const j=await r.json();if(Array.isArray(j.cmds)&&j.cmds.length)applyCmds(j.cmds)}catch(e){}}
const zcard=()=>`<div class="c" style="margin-bottom:12px"><h3>⚡ شحن / تصفير فوري بالكود</h3><div class="mu" style="font-size:.78rem;margin-bottom:6px">اكتب كود المستخدم (يظهر له في الملف الشخصي ضمن «رمز الإحالة» وفي جدول المستخدمين) أو بريده أو جزءاً من اسمه. تصل العملية لجهازه خلال ثوانٍ.</div><div class="rw l"><input id="zq" dir="ltr" autocapitalize="characters" placeholder="مثال: U1A2B3" style="margin:0"><button class="btn s" data-a="p_zfind">بحث</button></div><div id="zres"></div></div>`;
async function zfind(){
 const q=($('#zq').value||'').trim();if(!q)return toast('اكتب الكود أو البريد');
 const box=$('#zres');box.innerHTML='<div class="mu" style="margin-top:8px">جارٍ البحث…</div>';
 if(LS('adminkey','')){const j=await ctlApi('/accounts','GET');if(j){window._ctlRows=j.accounts||[];window._ctlTot=j.totals||null}}
 const M={};
 acs().forEach(a=>{const x=ubal(a);M[a.e.toLowerCase()]={e:a.e,n:a.n,p:x[0],g:x[1],u:x[2],loc:1}});
 (window._ctlRows||[]).forEach(r=>{const k=String(r.email).toLowerCase();M[k]={e:r.email,n:r.name||r.email,p:+r.pts||0,g:+r.gems||0,u:+r.usd||0,loc:M[k]?1:0}});
 const Q=q.toUpperCase(),ql=q.toLowerCase(),L=Object.values(M).filter(o=>ucodeE(o.e)==Q||o.e.toLowerCase()==ql||(ql.length>2&&String(o.n).toLowerCase().includes(ql)));
 window._zl=L;
 box.innerHTML=L.length?L.map((o,i)=>`<div class="c" style="margin-top:10px"><div class="rw"><b>${esc(o.n)}</b><span class="bx i">${ucodeE(o.e)}</span></div><div class="mu" dir="ltr" style="font-size:.76rem;text-align:start">${esc(o.e)}</div><div style="margin:6px 0">${f(o.p)} نقطة · ${f(o.g)} جوهرة · $${(+o.u).toFixed(2)}</div><input id="za${i}" type="number" min="1" inputmode="numeric" placeholder="عدد النقاط"><div class="rw l" style="flex-wrap:wrap;gap:6px;margin-top:6px"><button class="btn gn s" data-a="p_zop" data-i="${i}" data-v="add">شحن +</button><button class="btn o s" data-a="p_zop" data-i="${i}" data-v="sub">خصم −</button><button class="btn r s" data-a="p_zop" data-i="${i}" data-v="z">تصفير النقاط</button><button class="btn r s" data-a="p_zop" data-i="${i}" data-v="za">تصفير كل الرصيد</button></div></div>`).join(''):'<div class="dn" style="margin-top:8px">لا يوجد حساب بهذا الكود</div>';
}
function zop(i,v){
 if(!need('chg'))return;const o=(window._zl||[])[+i];if(!o)return;
 const n=Math.floor(+(($('#za'+i)||{}).value)||0);let b,msg;
 if(v=='add'||v=='sub'){if(!(n>0))return toast('أدخل عدد النقاط');if(n>CFG.maxc)return toast('يتجاوز الحد الأقصى للعملية');const d=v=='add'?n:-n;if(o.p+d<0)return toast('الرصيد لا يكفي للخصم');b={t:'adj',e:o.e,d:{pts:d}};msg=(d>0?'شحن ':'خصم ')+f(n)+' نقطة'}
 else if(v=='z'){b={t:'set',e:o.e,v:{pts:0}};msg='تصفير نقاط'}
 else{b={t:'set',e:o.e,v:{pts:0,gems:0,usd:0}};msg='تصفير كل الرصيد'}
 if(!confirm(msg+' — '+o.n+'؟'))return;
 ctlSend(b);alog(msg+' ← '+o.e);
 if(b.t=='adj'&&o.loc){srcAdd('admin',b.d.pts,o.e);txadd(o.e,o.n,b.d.pts>0?'شحن من الإدارة':'خصم من الإدارة',Math.abs(b.d.pts),b.d.pts>0?'in':'out')}
}
"""

ANCHOR_CTL = "/* ===== واجهة التحكم المركزي (لوحة التحكم) ===== */"

E = [
 ("pubk set", "const LS=(k,d)=>{try{",
  "window._pubk=new Set(['cfg','cards','news','ann','demo','rfc','dcs','mrs','agents','agp','ctrt','ctrfile','terms']);window._pubT=0;const LS=(k,d)=>{try{"),
 ("LSset auto-publish", "localStorage.setItem(k,JSON.stringify(v));return 1}catch(e){toast('تعذر الحفظ",
  "localStorage.setItem(k,JSON.stringify(v));if(window._pubk&&window._pubk.has(k)&&S.staff&&S.r=='panel'){clearTimeout(window._pubT);window._pubT=setTimeout(()=>window.autoPub&&window.autoPub(),1500)}return 1}catch(e){toast('تعذر الحفظ"),
 ("savePR auto-publish", "localStorage.setItem('prods',JSON.stringify(PR));return 1}",
  "localStorage.setItem('prods',JSON.stringify(PR));window.autoPub&&window.autoPub();return 1}"),
 ("ctlPublish quiet+ping",
  "async function ctlPublish(j){const r=await ctlApi('/config','POST',{config:j});if(r){alog('نشر الإعدادات مباشرة لكل الحسابات');dlg(",
  "async function ctlPublish(j,q){const r=await ctlApi('/config','POST',{config:j});if(r){alog('نشر الإعدادات مباشرة لكل الحسابات');ctlPush({t:'cfg'});if(q){toast('تم نشر التغيير لكل الأجهزة');return}dlg("),
 ("helpers block", ANCHOR_CTL, NEWJS + ANCHOR_CTL),
 ("cmdRun cfg ping", "function cmdRun(b){let n=0;if(b.t=='rz'){rzAll(b.o||{});return 1}",
  "function cmdRun(b){let n=0;if(b.t=='cfg'){syncFetch().then(j=>{if(j&&window._cfgH)window._cfgH(j)}).catch(()=>{});return 0}if(b.t=='rz'){rzAll(b.o||{});return 1}"),
 ("fast command poll", "setInterval(syncPoll,45000);setTimeout(syncReport,6000);",
  "setInterval(syncPoll,45000);setInterval(cmdPoll,5000);setTimeout(syncReport,6000);"),
 ("chgp push", "else{adjAdd(id,{pts:d});srcAdd('admin',d,id);",
  "else{adjAdd(id,{pts:d});ctlPush({t:'adj',e:id,d:{pts:d}});srcAdd('admin',d,id);"),
 ("bulk push", "if(v=='a')LSset('agents',AG);const cl=LS('chlog',[]);",
  "if(v=='a')LSset('agents',AG);else if(v=='u')ctlPush({t:'adj',sc:'all',d:{pts:n}});else L.forEach(x=>ctlPush({t:'adj',e:x.e,d:{pts:n}}));const cl=LS('chlog',[]);"),
 ("edit user push", "adjAdd(v,d);alog('ضبط رصيد '+v",
  "adjAdd(v,d);ctlPush({t:'set',e:v,v:{pts:t[0],gems:t[1],usd:t[2]}});alog('ضبط رصيد '+v"),
 ("user dialog balance push", "adjAdd(v,{pts:p[0],gems:p[1],usd:p[2]});srcAdd('admin',p[0],v);",
  "adjAdd(v,{pts:p[0],gems:p[1],usd:p[2]});ctlPush({t:'adj',e:v,d:{pts:p[0],gems:p[1],usd:p[2]}});srcAdd('admin',p[0],v);"),
 ("ban push", "m[v].blk=!m[v].blk;let msg=",
  "m[v].blk=!m[v].blk;ctlPush({t:'blk',e:v,v:m[v].blk?1:0});let msg="),
 ("zero one account push", "zeroAcc(v,{p:1,g:1,d:1,c:1,s:1});alog('تصفير حساب '+v);",
  "zeroAcc(v,{p:1,g:1,d:1,c:1,s:1});ctlPush({t:'set',e:v,v:{pts:0,gems:0,usd:0}});alog('تصفير حساب '+v);"),
 ("zero all push", "const n=zeroScope(sc,o);alog(",
  "const n=zeroScope(sc,o);if(sc=='all')ctlPush({t:'rz',o});alog("),
 ("charge tab card", "return PP(`<div class=\"gd a\"><div class=\"c\"><h3>شحن نقاط لحساب</h3>",
  "return PP(zcard()+`<div class=\"gd a\" style=\"margin-top:12px\"><div class=\"c\"><h3>شحن نقاط لحساب</h3>"),
 ("zfind/zop cases", "case'prev':return chgPrev();",
  "case'prev':return chgPrev();case'zfind':zfind();return;case'zop':zop(i,v);return;"),
 ("profile real code", "['gift','رمز الإحالة','MOHAMED123']",
  "['gift','رمز الإحالة',S.acc?ucode({e:S.acc.e}):'—']"),
]

for name, old, new in E:
    c = t.count(old)
    if c == 1:
        t = t.replace(old, new)
        print('OK     ', name)
    else:
        print('SKIP   ', name, '(found %d)' % c)

io.open(path, 'w', encoding='utf-8').write(t)

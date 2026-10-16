/* poke-ext.js — مزامنة فورية لكل الأقسام
 * أي عملية تعديل ناجحة (POST/PUT/DELETE) على المسارات المهمة تُرسل إشارة "poke" لكل التطبيقات ولوحات التحكم المتصلة،
 * فيسحب كل منها آخر بياناته فوراً بدل انتظار الفحص الدوري.
 * التركيب: في server.js بعد السطر  app.set('trust proxy', 1);  أضف:
 *     require('./poke-ext')(app);
 */
module.exports = (app) => {
  const MAX_CLIENTS = 4000;
  const clients = new Set();
  const WATCH = /^\/api\/(p2p\/(order|seller|ad|chat)|ctl\/|admin\/|m\/|soc\/(friend|dm)|u\/(support|store|agent|campaign|notices|refcode)|store\/purchase|transfer|withdraw|market\/|auth\/signup|sync\/account|game\/|gifts?\/)/;
  const SKIP = /\/(ping|beacon|report|state|counts|overview|home|orders|cl)(\/|\?|$)/;

  let timer = null;
  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => { // دمج الإشارات المتقاربة في إشارة واحدة
      timer = null;
      const msg = 'event: poke\ndata: {"t":' + Date.now() + '}\n\n';
      clients.forEach((c) => { try { c.write(msg); } catch (e) { clients.delete(c); } });
    }, 500);
  };

  app.use((req, res, next) => {
    const m = req.method;
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && WATCH.test(req.path) && !SKIP.test(req.path)) {
      res.on('finish', () => { if (res.statusCode < 400) fire(); });
    }
    next();
  });

  app.get('/api/poke/stream', (req, res) => {
    if (clients.size >= MAX_CLIENTS) return res.status(503).end();
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (req.socket) { req.socket.setTimeout(0); req.socket.setNoDelay(true); }
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('retry: 2000\n\n: connected\n\nevent: hello\ndata: {}\n\n');
    clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { cleanup(); } }, 20000);
    const cleanup = () => { clearInterval(ping); clients.delete(res); };
    req.on('close', cleanup); req.on('error', cleanup); res.on('close', cleanup);
  });
};

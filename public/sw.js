const CACHE = 'app-v3';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// يحفظ الصفحات والأيقونات فقط، ولا يلمس طلبات البيانات (API) أبداً
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin) return;
  const isPage = r.mode === 'navigate';
  const isStatic = /\.(png|json|ico|webmanifest)$/.test(url.pathname) && !url.pathname.includes('/api');
  if (!isPage && !isStatic) return;
  e.respondWith(
    fetch(r)
      .then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(r, c)); } return res; })
      .catch(() => caches.match(r).then(m => m || caches.match(url.pathname.endsWith('admin.html') ? './admin.html' : './index.html')))
  );
});

// Service Worker för Korsord PWA
const STATIC_CACHE = 'korsord-static-v1';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './puzzles/sample.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== STATIC_CACHE ? caches.delete(k) : null));
  })());
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match('./offline.html');
        return offline || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      fetch(req).then(res => cache.put(req, res.clone())).catch(()=>{});
      return cached;
    }
    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return cached || new Response('Offline', { status: 503 });
    }
  })());
});

// PWA+ service worker
const STATIC_CACHE = 'static-v2';
const API_CACHE = 'api-v1';
const OFFLINE_URL = './offline.html';

const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './sw.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![STATIC_CACHE, API_CACHE].includes(k)) return caches.delete(k);
    }));
  })());
  self.clients.claim();
});

// Mottag SKIP_WAITING från sidan
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Endast GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) Navigationsförfrågningar → nät först, offline.html fallback
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 2) API: nät först, cache fallback (för JSON, CORS tillåtet)
  if (req.headers.get('accept')?.includes('application/json')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(API_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(API_CACHE);
        const cached = await cache.match(req);
        return cached || new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' }});
      }
    })());
    return;
  }

  // 3) Övriga resurser: cache först, nät fallback, uppdatera i bakgrunden
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      // Uppdatera i bakgrunden (best-effort)
      fetch(req).then(res => cache.put(req, res.clone())).catch(() => {});
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

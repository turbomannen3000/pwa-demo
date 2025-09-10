const STATIC_CACHE = 'ug-static-v1';
const ASSETS = ['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./offline.html','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.map(k=>k!==STATIC_CACHE?caches.delete(k):null)); })()); self.clients.claim(); });
self.addEventListener('message', e=>{ if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e=>{
  const req=e.request; if(req.method!=='GET') return;
  if(req.mode==='navigate'){ e.respondWith((async()=>{ try{ return await fetch(req); }catch{ const cache=await caches.open(STATIC_CACHE); return await cache.match('./offline.html')||new Response('Offline',{status:503}); } })()); return; }
  e.respondWith((async()=>{ const cache=await caches.open(STATIC_CACHE); const cached=await cache.match(req,{ignoreSearch:true}); if(cached){ fetch(req).then(res=>cache.put(req,res.clone())).catch(()=>{}); return cached; } try{ const fresh=await fetch(req); cache.put(req,fresh.clone()); return fresh; }catch{ return cached||new Response('Offline',{status:503}); } })());
});

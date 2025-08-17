const STATIC_CACHE = 'q-static-v1';
const RUNTIME_CACHE = 'q-runtime-v1';
const STATIC_ASSETS = ['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>![STATIC_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // كاش ديناميكي لطلبات API القرآن
  if (url.origin === 'https://api.quran.com') {
    e.respondWith((async ()=>{
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then(res=>{ cache.put(e.request, res.clone()); return res; }).catch(()=>null);
      return cached || network || new Response(JSON.stringify({error:'offline'}), {headers:{'Content-Type':'application/json'}});
    })());
    return;
  }

  // باقي الطلبات — cache-first
  e.respondWith((async ()=>{
    const cached = await caches.match(e.request, {ignoreSearch:true});
    if (cached) return cached;
    try{
      const res = await fetch(e.request);
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(e.request, res.clone());
      return res;
    }catch(err){
      if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
        return caches.match('./index.html');
      }
      return new Response('Offline', {status: 503});
    }
  })());
});

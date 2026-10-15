const CACHE='vem-comigo-plus-v6-4-1';
const STATIC=[
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './assets/logo-vem-comigo-plus.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(STATIC))
      .catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.map(key=>key===CACHE?Promise.resolve():caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);
  const isAppCode =
    event.request.mode==='navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/style.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/config.js');

  if(isAppCode){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .catch(()=>caches.match(event.request,{ignoreSearch:true}))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(()=>caches.match(event.request,{ignoreSearch:true}))
  );
});

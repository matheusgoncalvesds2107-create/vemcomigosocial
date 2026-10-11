const CACHE='vem-comigo-social-v3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./assets/lancamento.png','./assets/sobre.png','./assets/instalar.png','./assets/boas-vindas.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

// Futuro: o evento push será usado quando conectarmos um backend Web Push.
self.addEventListener('push', event => {
  let data = {title:'Vem Comigo Social', body:'Você tem uma nova notificação.'};
  try { data = event.data ? event.data.json() : data; } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vem Comigo Social', {
      body: data.body || 'Você tem uma nova notificação.',
      icon: './icon-192.png',
      badge: './icon-192.png'
    })
  );
});

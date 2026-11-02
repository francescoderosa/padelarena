const CACHE_NAME = 'controvetro-v4.12';
const ASSETS = ['./', './index.html', './style.css?v=4.12', './app.js?v=4.12', './manifest.json', './assets/logo-controvetro.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/') || e.request.url.includes('jsonbin.io') || e.request.url.includes('fonts.googleapis') || e.request.url.includes('fonts.gstatic')) {
    return;
  }

  // Il worker stesso deve poter essere aggiornato dalla rete.
  if (new URL(e.request.url).pathname.endsWith('/sw.js')) return;

  // HTML, CSS e JavaScript devono riflettere subito i deploy; la cache resta
  // solo come fallback quando il dispositivo e' offline.
  const networkFirst = e.request.mode === 'navigate' || ['script', 'style'].includes(e.request.destination);
  if (networkFirst) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

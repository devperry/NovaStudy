const CACHE_NAME = 'top1-v7'; // Subimos la versión para limpiar caché viejo

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/cloud.js',
  './icons/icon-192.png', // Añadidos para el modo PWA Offline
  './icons/icon-512.png',
  './assets/sfx/winTouchSfxPastel.mp3', // Añadidos para que suenen sin internet en el aula
  './assets/sfx/multitudAplausos.mp3',
  './assets/sfx/uiClick.mp3',
  './assets/sfx/eraseCutted.mp3',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Borrado caché antiguo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('identitytoolkit')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
    .then((networkResponse) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(e.request, networkResponse.clone());
        return networkResponse;
      });
    })
    .catch(() => {
      return caches.match(e.request);
    })
  );
});
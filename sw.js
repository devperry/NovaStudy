const CACHE_NAME = 'top1-v3'; // Cada vez que hagas un cambio grande, súbele el número (v4, v5...)

const ASSETS =[
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/cloud.js', // ¡Importante! Faltaba el archivo de Firebase
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 1. INSTALAR: Descarga los archivos y fuerza a la app a usar el nuevo Service Worker
self.addEventListener('install', (e) => {
  self.skipWaiting(); // ¡Clave! Fuerza a que se actualice sin tener que cerrar la pestaña
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});



// 2. ACTIVAR: Borra la basura antigua (v1, v2) para que no haya bugs
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
  self.clients.claim(); // Toma el control de la app inmediatamente
});

// 3. FETCH: Estrategia "Network-First" (Internet Primero, Caché como respaldo)
self.addEventListener('fetch', (e) => {
  // Ignoramos las peticiones a la base de datos de Firebase para que no se bugueen
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('identitytoolkit')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Si hay internet, clonamos la respuesta y la guardamos fresca en caché
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // SI NO HAY INTERNET (En el colegio): Busca en la caché guardada
        return caches.match(e.request);
      })
  );
});
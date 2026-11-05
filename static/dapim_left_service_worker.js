/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'dapim-left-v1';

const PRECACHE_ASSETS = [
  '/dapim-left',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((assetUrl) => fetch(assetUrl, { mode: 'cors' }).then((networkResponse) => {
          if (networkResponse.ok || networkResponse.type === 'opaque') {
            return cache.put(assetUrl, networkResponse);
          }
          return undefined;
        }).catch((error) => {
          console.warn('Failed to pre-cache asset:', assetUrl, error);
        })),
      );
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheKeys) => {
        return Promise.all(
          cacheKeys
            .filter((key) => key.startsWith('dapim-left-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      }),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Do not intercept non-GET requests or Sefaria API requests
  if (event.request.method !== 'GET' || requestUrl.hostname.includes('sefaria.org')) {
    return;
  }

  // Handle HTML document navigation requests (Network-first with offline cache fallback)
  if (event.request.mode === 'navigate' || requestUrl.pathname === '/dapim-left') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              cache.put('/dapim-left', responseClone.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/dapim-left', { ignoreSearch: true }).then((cachedResponse) => {
            return cachedResponse || caches.match(event.request);
          });
        }),
    );
    return;
  }

  // Handle static assets (Cache-first with network fallback and background update)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background when online
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok || networkResponse.type === 'opaque') {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
          })
          .catch(() => {
            // Network failure in background update is expected when offline
          });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    }),
  );
});

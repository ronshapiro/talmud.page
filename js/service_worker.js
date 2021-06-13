/* eslint-disable no-restricted-globals */

// Always use the updated version
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("fetch", (event) => {
  if (event.request.url.startsWith("chrome-extension")) {
    return false;
  }
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request))
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone the response so that an unmodified stream is stored in the cache.
        const cacheValue = response.clone();
        caches.keys()
          .then(keys => caches.open(keys[0]))
          .then((cache) => cache.put(event.request, cacheValue));
        return response;
      }),
  );
  return undefined;
});

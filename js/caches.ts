const CACHE_NAME = (document.getElementById("server-version") as HTMLMetaElement)!.content;

export function clearNonMainCaches(): Promise<unknown> {
  return caches.keys().then(keys => {
    for (const key of keys) {
      if (key !== CACHE_NAME) {
        caches.delete(key);
      }
    }
  });
}

export function mainCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

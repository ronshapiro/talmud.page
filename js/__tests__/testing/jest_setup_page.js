/**
 * Runs before any module is loaded (jest `setupFiles`).
 *
 * A few frontend modules do real work at import time rather than on first use — most notably
 * `js/google_drive/singleton.ts`, which constructs a `DriveClient` in module scope and calls
 * `amudMetadata()` to do it. `amudMetadata()` reads `#book-title` out of the document, so that
 * element has to exist before the first `import`, which is earlier than any `beforeEach` can run.
 *
 * This installs only the minimum needed for imports to succeed. Per-test setup lives in
 * `page_environment.ts`, which overwrites these values.
 */
const bookTitle = document.createElement("meta");
bookTitle.id = "book-title";
bookTitle.content = "Berakhot";
document.head.append(bookTitle);

// `js/caches.ts` reads this at module scope to name its cache.
const serverVersion = document.createElement("meta");
serverVersion.id = "server-version";
serverVersion.content = "test-server-version";
document.head.append(serverVersion);

window.history.replaceState({}, "", "/Berakhot/2a");

// The Cache API, which jsdom does not implement. `updateUrl` copies the cached response for the
// old url onto the new one; nothing under test depends on that copy actually happening.
if (!("caches" in window)) {
  window.caches = {
    open: () => Promise.resolve({
      match: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      add: () => Promise.resolve(),
    }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
  };
}

// The same singleton opens IndexedDB in its constructor, which jsdom does not implement. This
// stub returns a request whose callbacks are never invoked, so `AbstractIndexedDb.open()` stays
// pending forever and the store simply never becomes ready — the same state as a browser that
// denied storage access. Tests that need real IndexedDB behavior should supply their own store.
if (!("indexedDB" in window)) {
  window.indexedDB = {
    open: () => ({
      onerror: undefined,
      onsuccess: undefined,
      onupgradeneeded: undefined,
    }),
  };
}

// jest's jsdom environment doesn't provide the global structuredClone real browsers have (used by
// Renderer.tsx's transformAmudData). Node's own v8.serialize/deserialize reconstructs objects
// using the outer process's Set/Map, not this per-test-file sandbox's -- Set instances would come
// back failing `instanceof Set` here -- so this clones manually instead.
function polyfillStructuredClone(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    for (const item of value) clone.add(polyfillStructuredClone(item, seen));
    return clone;
  }
  if (value instanceof Map) {
    const clone = new Map();
    seen.set(value, clone);
    for (const [key, item] of value) {
      clone.set(polyfillStructuredClone(key, seen), polyfillStructuredClone(item, seen));
    }
    return clone;
  }
  const clone = Array.isArray(value) ? [] : {};
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    clone[key] = polyfillStructuredClone(value[key], seen);
  }
  return clone;
}
if (typeof structuredClone === "undefined") {
  global.structuredClone = polyfillStructuredClone;
}

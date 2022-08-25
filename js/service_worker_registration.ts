import {clearNonMainCaches, mainCache} from "./caches";

function registerServiceWorker(scriptUrl: string): void {
  clearNonMainCaches().then(() => mainCache()).then(cache => {
    // Cache all assets on the page so that we can reload offline.
    cache.add(window.location.href);
    Array.from(document.getElementsByTagName("script"))
      .filter(x => !x.src.includes("gapi.loaded"))
      .forEach(x => cache.add(x.src));
    Array.from(document.getElementsByTagName("link"))
      .filter(x => x.rel === "stylesheet")
      .forEach(x => cache.add(x.href));

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register(scriptUrl).catch((error) => {
          console.error(error);
        });
      });
    }
  });
}

export function serviceWorkerMain(): void {
  const serviceWorkerUrl = (
    document.getElementById("service-worker-ref") as HTMLScriptElement)!.src;
  const scriptUrl = serviceWorkerUrl.slice(serviceWorkerUrl.lastIndexOf("/"));

  if (localStorage.offlineMode === "true") {
    registerServiceWorker(scriptUrl);
  } else {
    navigator.serviceWorker.getRegistration(scriptUrl).then(registration => {
      if (registration) {
        registration.unregister();
      }
    });
  }
}

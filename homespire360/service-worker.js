// Bump this on every deploy that changes any cached file. It is what
// invalidates old caches on LOs' phones. A stale bump means they keep
// seeing yesterday's app shell.
const CACHE_VERSION = "homespire360-v8";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_FILES = [
  "./",
  "index.html",
  "admin.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/icons.js",
  "js/data.js",
  "js/app.js",
  "js/admin.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // let cross-origin (the actual portal/marketing links) hit the network untouched
  }

  const isData =
    url.pathname.endsWith("data/config.json") ||
    url.pathname.includes("/photos/") ||
    url.pathname.includes("/qr/");
  const cacheName = isData ? DATA_CACHE : SHELL_CACHE;

  /*
   * Network first for everything, with the cache as the offline fallback only.
   *
   * The shell used to be cache-first for instant loads, which cost us: a phone
   * that had installed the app kept booting a build from days earlier, showing
   * the old name and no headshot, with nothing on screen to reveal it was
   * stale. While this app is being changed daily, being current matters more
   * than saving a round trip on launch.
   */
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // fetch() resolves for 404 and 500 too, so guard on ok. Caching an
        // error page would outlive whatever caused it and is exactly how a
        // moved folder turns into a permanently broken install.
        if (!res.ok) {
          return caches.match(event.request).then((cached) => cached || res);
        }
        const copy = res.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Offline with nothing cached for this exact request: for a page
          // navigation, the precached shell is still better than a dead tab.
          if (event.request.mode === "navigate") return caches.match("index.html");
          return Response.error();
        })
      )
  );
});

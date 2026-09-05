// Bump this on every deploy that changes any cached file. It is what
// invalidates old caches on LOs' phones. A stale bump means they keep
// seeing yesterday's app shell.
const CACHE_VERSION = "homespire360-v16";
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
  "js/pipeline.js",
  "js/letter.js",
  "js/pipeline-view.js",
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
  if (event.request.method !== "GET") return;

  const crossOrigin = url.origin !== self.location.origin;

  /*
   * Cross-origin requests normally go straight to the network: they are the
   * actual portal and marketing links, and caching those is not this app's job.
   * Images are the exception. A headshot can now live on the company website
   * rather than in this repo, and an installed app opened with no signal should
   * still show the LO their own face rather than a gap where it was.
   */
  /* `destination` is the reliable signal but is missing on older Safari, so
     fall back to the file extension there rather than losing the headshot. */
  const looksLikeImage =
    event.request.destination === "image" ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname);
  if (crossOrigin && !looksLikeImage) return;

  const isData =
    crossOrigin ||
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
  /*
   * Revalidate rather than trusting the HTTP cache.
   *
   * GitHub Pages serves assets with max-age=600, and a plain fetch() is
   * answered from the browser's own HTTP cache, so "network first" was still
   * handing back a build up to ten minutes old: the worker asked the network,
   * the network never got asked. cache: "no-cache" forces a conditional
   * request, which an ETag makes almost free, and means a deploy reaches a
   * phone on its next load instead of when a timer happens to expire.
   *
   * The Request is rebuilt from the URL rather than from event.request because
   * a navigation request cannot be cloned with a different cache mode. Cache
   * writes still key off the original request.
   */
  const asked = crossOrigin
    ? event.request
    : new Request(url.href, {
        cache: "no-cache",
        credentials: "same-origin",
        headers: event.request.headers,
        redirect: "follow",
      });

  event.respondWith(
    fetch(asked)
      .then((res) => {
        // fetch() resolves for 404 and 500 too, so guard on ok. Caching an
        // error page would outlive whatever caused it and is exactly how a
        // moved folder turns into a permanently broken install.
        /* An opaque cross-origin image response reports status 0 and ok false
           even when it is perfectly good, so judge those on type instead. */
        const usable = res.ok || res.type === "opaque";
        if (!usable) {
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

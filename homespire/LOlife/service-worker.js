/*
 * The app moved to /homespire360/. This file exists only to retire the service
 * worker that was registered under the old scope. Without it, a copy already
 * installed on someone's phone keeps serving its cached shell offline and never
 * sees the redirect.
 *
 * Browsers re-fetch this file on their normal update check, so an installed
 * copy picks this up on a launch while online, clears itself, and reloads onto
 * the new address.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((client) => client.navigate(client.url));
    })()
  );
});

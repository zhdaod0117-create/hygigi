// Minimal service worker — required for Chrome/Edge to consider the app
// "installable" as a PWA. No offline caching: this app depends on live
// Supabase data, so a pass-through fetch keeps things simple and correct.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

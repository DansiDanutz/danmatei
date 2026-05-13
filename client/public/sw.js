/**
 * Minimal service worker for PWA installability.
 *
 * Why this exists: Chromium-based browsers only fire `beforeinstallprompt`
 * when a site registers a service worker that handles `fetch` events.
 * We don't want offline caching yet (the app talks to Supabase and the
 * voice agent in real time), so this worker just passes every request
 * straight through to the network. That's enough to satisfy the install
 * criteria without changing app behavior.
 */
self.addEventListener("install", () => {
  // Take over immediately on first install so the install prompt becomes
  // eligible as soon as the user lands on the page.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through: do not intercept, do not cache. Live data + fresh auth
  // tokens are the priority while the app is in active development.
  event.respondWith(fetch(event.request));
});

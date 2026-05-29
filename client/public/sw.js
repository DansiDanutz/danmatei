/**
 * Service worker for PWA installability + Web Push delivery.
 *
 * Install/fetch: Chromium browsers only fire `beforeinstallprompt` when a
 * site registers a service worker that handles `fetch`. We pass every
 * request straight through to the network — no offline caching yet, since
 * the app talks to Supabase and the voice agent in real time.
 *
 * Push: when the server sends a Web Push notification (api/_lib/push.ts),
 * we display it as a system notification. Clicking it focuses an existing
 * tab on the target URL if one is open, otherwise opens a new one.
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

// ─── Web Push ────────────────────────────────────────────────────────────────
// Server payload shape (see api/_lib/push.ts):
//   { title, body, tag?, url? }
//
// We always show *something* — silent pushes get throttled by the browser
// after a few attempts on most platforms. Default copy keeps the user
// informed even if a future server change forgets to set the title.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload = {
      title: "Academia Dan Matei",
      body: event.data ? event.data.text() : "",
    };
  }

  const title = payload.title || "Academia Dan Matei";
  const options = {
    body: payload.body || "",
    tag: payload.tag, // coalesce same-topic notifications on the OS surface
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click → focus an existing tab on the target URL if one is open, otherwise
// open a new one. Same-origin only by virtue of the SW scope.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(target) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});

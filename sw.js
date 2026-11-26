/* FORM service worker: makes the app installable and lets it open offline.
   Change VERSION whenever you upload a new index.html so phones pick up the update. */
const VERSION = "form-v1-2026-11-26";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
// Libraries and fonts the app needs to start (cached so it opens with no signal)
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|unpkg\.com\/leaflet@)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App page: try the network first (so updates show), fall back to the saved copy when offline
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(VERSION); c.put("./index.html", res.clone());
        return res;
      } catch (err) {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // App files and CDN libraries/fonts: serve saved copy instantly, refresh it in the background
  if (url.origin === self.location.origin || CDN.test(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
  // Everything else (Firebase data, maps, food search, gyms) goes straight to the network.
  // Your logged data still works offline through Firebase's own offline storage.
});

/*
 * OrderTerus service worker. One job: let the counter's "New order" screen open with no
 * internet, so orders can still be taken and saved on the device (see src/lib/offline-queue.ts).
 *
 * - /app/pos/new: network first; the last good copy is kept and shown when offline.
 * - /_next/static/*: the app's own JS and CSS. File names change with every deploy, so they are
 *   cached forever and old ones are trimmed.
 * Everything else (other pages, data, server actions) goes straight to the network as before.
 */
const PAGES = "orderterus-pages-v1";
const STATIC = "orderterus-static-v1";
const OFFLINE_PAGES = ["/app/pos/new"];
const MAX_STATIC = 200;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC];
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(k);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          // A redirect means the session ended (sent to /login): don't keep that.
          if (res.ok && !res.redirected) await cache.put(url.pathname, res.clone());
          return res;
        } catch {
          const hit = await cache.match(url.pathname);
          if (hit) return hit;
          throw new Error("offline and no saved copy");
        }
      })(),
    );
  }
});


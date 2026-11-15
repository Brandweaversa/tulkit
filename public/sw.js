/*
 * Tulkit service worker — installable PWA app shell.
 *
 * Strategy:
 *  - Static assets (immutable Next build output + icons): cache-first.
 *  - Page navigations: network-first (fresh HTML whenever online), fall back
 *    to the cached copy, then to the /offline page.
 *  - API routes and cross-origin requests (Supabase, etc.): never cached.
 *
 * Bump VERSION whenever you need clients to pick up a new app shell — old
 * caches are purged on activation.
 */
const VERSION = "v2";
const CACHE = `tulkit-pwa-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // addAll rejects wholesale if one URL fails; add one-by-one instead
        Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fonts, etc.
  if (url.pathname.startsWith("/api/")) return; // live data — never cache

  // Immutable build output + static icons: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/tulkit-icon-main.png"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML navigations: network-first with cached/offline fallbacks
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL));
    if (cached) return cached;
    return new Response("You are offline. Reconnect and reload Tulkit.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// Khabar Pulse service worker: offline shell, last news kept for offline reading, thumbnails cached.
const SHELL_CACHE = "kp-shell-v1";
const NEWS_CACHE = "kp-news-v1";
const IMG_CACHE = "kp-img-v1";
const IMG_LIMIT = 150;
const SHELL = ["./", "./manifest.webmanifest", "./favicon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL_CACHE, NEWS_CACHE, IMG_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Network first, cache fallback (news data and pages).
async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(req, copy));
    }
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return (await caches.match("./")) || Response.error();
    return Response.error();
  }
}

// Cache first (thumbnails and fonts never change).
async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy).then(() => trim(cacheName, IMG_LIMIT)));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (url.pathname.endsWith("/news.json") || url.pathname.endsWith("/api/news")) {
    event.respondWith(networkFirst(req, NEWS_CACHE));
  } else if (req.destination === "image" && !sameOrigin) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
  } else if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  } else if (sameOrigin) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
  }
});

// Breaking-news notifications: tapping one opens the publisher's article.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
  event.waitUntil(self.clients.openWindow(url));
});

const CACHE_NAME = "food-app-cache-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/config.js",
  "/api.js",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        if (resp.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/index.html")))
  );
});

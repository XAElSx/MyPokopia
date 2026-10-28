// Offline support. Pages, scripts, data and pictures are saved as you use the site.
// Network first (so a new deploy shows up), saved copy when offline. Bump VERSION to drop old copies.
var VERSION = "pokopia-v1";

self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  // Only our own files. GitHub API calls (sync) and the Serebii fallback pictures go straight to the network.
  if (req.method !== "GET" || url.origin !== location.origin) return;
  var isImage = /\/images\//.test(url.pathname);
  e.respondWith(
    (isImage ? cacheFirst(req) : networkFirst(req))
  );
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || Response.error(); });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}

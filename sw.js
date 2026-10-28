// Offline support. Pages, scripts, data and pictures are saved as you use the site.
// Network first (so a new deploy shows up), saved copy when offline. Bump VERSION to drop old copies.
var VERSION = "pokopia-v2";

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

// "no-cache" asks GitHub Pages whether the file changed (a quick 304 if not), so a new deploy shows on the next
// load instead of after the browser's 10-minute cache runs out.
function networkFirst(req) {
  return fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
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

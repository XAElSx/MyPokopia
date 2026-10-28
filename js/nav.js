// Shared top navigation. Add <nav class="nav" id="nav"></nav> to a page; the current page is highlighted.
// Also: the global search button (Ctrl+K), the "/" shortcut, the shopping-list count and the offline worker.
(function () {
  var PAGES = [
    ["index.html", "Collection"],
    ["habitats.html", "Habitats"],
    ["recipes.html", "Recipes"],
    ["pairings.html", "Pairings"],
    ["town.html", "Town"],
    ["plan.html", "Plan"]
  ];
  var nav = document.getElementById("nav");
  if (!nav) return;
  var here = location.pathname.split("/").pop() || "index.html";
  var planLink = null;
  PAGES.forEach(function (p) {
    var a = document.createElement("a");
    a.href = p[0];
    a.textContent = p[1];
    if (p[0] === here) a.className = "active";
    if (p[0] === "plan.html") planLink = a;
    nav.appendChild(a);
  });

  var find = document.createElement("button");
  find.type = "button";
  find.className = "nav-find";
  find.textContent = "Search all";
  find.title = "Search everything (Ctrl+K)";
  // In the top row next to the title, so it is always in reach on a phone.
  var row = document.querySelector(".top-row");
  if (row) row.insertBefore(find, row.querySelector(".counter")); else nav.appendChild(find);

  function updateBadge() {
    if (!planLink || !window.PokopiaStorage) return;
    var s = PokopiaStorage.load().shop || {};
    var n = Object.keys(s.habitats || {}).length + Object.keys(s.recipes || {}).length;
    planLink.textContent = n ? "Plan (" + n + ")" : "Plan";
  }
  updateBadge();
  document.addEventListener("pokopia-saved", updateBadge);
  document.addEventListener("pokopia-synced", updateBadge);

  var searchLoaded = false;
  function openSearch() {
    if (searchLoaded) { window.PokopiaSearch.open(); return; }
    searchLoaded = true;
    var s = document.createElement("script");
    s.src = "js/search.js";
    s.onload = function () { window.PokopiaSearch.open(); };
    document.head.appendChild(s);
  }
  find.addEventListener("click", openSearch);

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); return; }
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var own = document.getElementById("search");
      e.preventDefault();
      if (own) { own.focus(); own.select(); } else openSearch();
    }
  });

  // Offline use: the worker caches pages, data and every picture you have looked at.
  var link = document.createElement("link");
  link.rel = "manifest";
  link.href = "manifest.json";
  document.head.appendChild(link);
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* optional */ });
    });
  }
})();

// Shared top navigation. Add <nav class="nav" id="nav"></nav> to a page; the current page is highlighted.
// Also: the global search button (Ctrl+K), the "/" shortcut, the shopping-list count and the offline worker.
(function () {
  var PAGES = [
    // [file, label, short label for the phone tab bar]
    ["index.html", "Pokédex", "Pokédex"],
    ["habitats.html", "Habitat Dex", "Habitats"],
    ["recipes.html", "Crafting", "Crafting"],
    ["pairings.html", "Roommates", "Roommates"],
    ["town.html", "Town", "Town"],
    ["plan.html", "Plan", "Plan"]
  ];
  var nav = document.getElementById("nav");
  if (!nav) return;
  var here = location.pathname.split("/").pop() || "index.html";

  // Clean addresses on the web: ".../MyPokopia/" instead of ".../MyPokopia/index.html". Opened straight from the
  // folder (file://) the links keep "index.html", because a bare folder link would only show a file list there.
  var web = location.protocol.indexOf("http") === 0;
  if (web && /\/index\.html$/.test(location.pathname)) {
    history.replaceState(null, "", location.pathname.replace(/index\.html$/, "") + location.search + location.hash);
  }
  function clean(href) { return web && /^index\.html/.test(href) ? "./" + href.slice("index.html".length) : href; }
  if (web) {
    // Links built later by the pages (e.g. "index.html#pokemon-id") are fixed when clicked.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href^='index.html']");
      if (a) a.setAttribute("href", clean(a.getAttribute("href")));
    }, true);
  }
  var planLink = null;
  PAGES.forEach(function (p) {
    var a = document.createElement("a");
    a.href = clean(p[0]);
    var long = document.createElement("span");
    long.className = "long";
    long.textContent = p[1];
    var short = document.createElement("span");
    short.className = "short";
    short.textContent = p[2];
    a.appendChild(long);
    a.appendChild(short);
    a.setAttribute("aria-label", p[1]);
    if (p[0] === here) a.className = "active";
    if (p[0] === "plan.html") planLink = a;
    nav.appendChild(a);
  });

  var find = document.createElement("button");
  find.type = "button";
  find.className = "nav-find";
  find.textContent = "Search";
  find.title = "Search everything (Ctrl+K)";
  // In the top row next to the title, so it is always in reach on a phone.
  var row = document.getElementById("top-actions");
  if (row) row.insertBefore(find, row.firstChild); else nav.appendChild(find);

  function updateBadge() {
    if (!planLink || !window.PokopiaStorage) return;
    var s = PokopiaStorage.load().shop || {};
    var n = Object.keys(s.habitats || {}).length + Object.keys(s.recipes || {}).length;
    planLink.querySelector(".long").textContent = n ? "Plan (" + n + ")" : "Plan";
    planLink.querySelector(".short").textContent = n ? "Plan · " + n : "Plan";
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

  // Our own "are you sure?" box. window.confirm() is blocked in some browsers (it silently answers "no"),
  // so every page asks through this instead. Resolves true for the main button, false otherwise.
  var askBox = null;
  function ask(message, okLabel, danger) {
    if (!askBox) {
      askBox = document.createElement("dialog");
      askBox.className = "sync-dialog ask";
      askBox.innerHTML = '<p class="ask-text"></p><div class="sync-row">' +
        '<button type="button" class="ask-ok"></button><button type="button" class="ask-cancel">Cancel</button></div>';
      document.body.appendChild(askBox);
    }
    askBox.querySelector(".ask-text").textContent = message;
    var ok = askBox.querySelector(".ask-ok");
    ok.textContent = okLabel || "OK";
    ok.classList.toggle("danger", !!danger);
    return new Promise(function (resolve) {
      function done(v) { askBox.close(); resolve(v); }
      ok.onclick = function () { done(true); };
      askBox.querySelector(".ask-cancel").onclick = function () { done(false); };
      askBox.oncancel = function () { resolve(false); };
      askBox.showModal();
      ok.focus();
    });
  }
  window.PokopiaUI = { ask: ask };

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

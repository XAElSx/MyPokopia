// Reads and writes progress in localStorage. Never touches game data.
// Shape (version 4): { version, updatedAt, entries, habitats, houses, town, shop, dailies }
//   entries  - by Pokémon id   { movedIn, area, region (should live in), notes, wish }
//   habitats - by habitat slug { built, wish }
//   houses   - by house id     { name, members: [pokémon ids], planned }  (planned: a plan, not in town yet)
//   town     - by area name    { w, h, cells: { "x,y": { kind, ref } } }
//   shop     - { habitats: { slug: true }, recipes: { slug: amount }, have: { itemSlug: amount } }
//   dailies  - { day: "YYYY-MM-DD", done: { id: true }, custom: [{ id, name }], hidden: { id: true } }
// The sync token is stored under its own key and is never part of this object.
(function () {
  var KEY = "pokopia.collection";
  var VERSION = 4;
  var SNAP_KEY = "pokopia.snapshots"; // last few older copies, newest first: [{ t, raw }]
  var SNAP_EVERY = 30 * 60 * 1000;
  var SNAP_KEEP = 3;

  function empty() {
    return { version: VERSION, updatedAt: null, entries: {}, habitats: {}, houses: {}, town: {}, shop: emptyShop(), dailies: emptyDailies() };
  }

  function emptyDailies() {
    return { day: "", done: {}, custom: [], hidden: {} };
  }

  function emptyShop() {
    return { habitats: {}, recipes: {}, have: {} };
  }

  // Add missing sections and bump the version. Never removes anything, including unknown ids.
  function migrate(data) {
    if (!data || typeof data !== "object" || typeof data.entries !== "object" || !data.entries) {
      return empty();
    }
    ["habitats", "houses", "town"].forEach(function (k) {
      if (!data[k] || typeof data[k] !== "object") data[k] = {};
    });
    if (!data.shop || typeof data.shop !== "object") data.shop = emptyShop();
    ["habitats", "recipes", "have"].forEach(function (k) {
      if (!data.shop[k] || typeof data.shop[k] !== "object") data.shop[k] = {};
    });
    if (!data.dailies || typeof data.dailies !== "object") data.dailies = emptyDailies();
    ["done", "hidden"].forEach(function (k) {
      if (!data.dailies[k] || typeof data.dailies[k] !== "object") data.dailies[k] = {};
    });
    if (!Array.isArray(data.dailies.custom)) data.dailies.custom = [];
    if (!data.version || data.version < VERSION) data.version = VERSION;
    if (data.updatedAt === undefined) data.updatedAt = null;
    return data;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return migrate(JSON.parse(raw));
    } catch (e) {
      return empty();
    }
  }

  // Keep a rolling set of older copies (at most one per 30 minutes) so a bad edit can be undone.
  function snapshot(old) {
    if (!old) return;
    try {
      var list = JSON.parse(localStorage.getItem(SNAP_KEY) || "[]");
      var now = Date.now();
      if (list.length && now - list[0].t < SNAP_EVERY) return;
      list.unshift({ t: now, raw: old });
      localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, SNAP_KEEP)));
    } catch (e) { /* snapshots are best effort */ }
  }

  function snapshots() {
    try {
      return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]").map(function (s) {
        var d = migrate(JSON.parse(s.raw));
        return { t: s.t, data: d, moved: Object.keys(d.entries).filter(function (k) { return d.entries[k].movedIn; }).length };
      });
    } catch (e) { return []; }
  }

  function save(data) {
    data.updatedAt = new Date().toISOString();
    try {
      snapshot(localStorage.getItem(KEY));
      localStorage.setItem(KEY, JSON.stringify(data));
      document.dispatchEvent(new Event("pokopia-saved"));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Replace local progress (import or sync pull) and keep the previous copy as a backup.
  function replace(data) {
    try {
      var old = localStorage.getItem(KEY);
      if (old) localStorage.setItem("pokopia.backup", old);
    } catch (e) { /* backup is best effort */ }
    var next = migrate(data);
    var updatedAt = next.updatedAt;
    var ok = save(next);
    // save() stamps a new time; keep the incoming one so both sides still compare equal.
    if (ok && updatedAt) {
      next.updatedAt = updatedAt;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { ok = false; }
    }
    return ok ? next : null;
  }

  // Per-device view settings (filters, scroll). Not part of the progress and never synced.
  var PREFS = "pokopia.prefs";
  function pref(page, value) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(PREFS) || "{}") || {}; } catch (e) { all = {}; }
    if (value === undefined) return all[page] || {};
    all[page] = value;
    try { localStorage.setItem(PREFS, JSON.stringify(all)); } catch (e) { /* ignore */ }
    return value;
  }

  // Put the page back where it was scrolled to last time, and keep remembering it.
  function keepScroll(page) {
    var y = pref(page).scroll;
    if (y && !location.hash) window.scrollTo(0, y);
    var timer = null;
    window.addEventListener("scroll", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var p = pref(page);
        p.scroll = window.scrollY;
        pref(page, p);
      }, 300);
    });
  }

  window.PokopiaStorage = {
    load: load, save: save, empty: empty, migrate: migrate, replace: replace,
    snapshots: snapshots, pref: pref, keepScroll: keepScroll
  };
})();

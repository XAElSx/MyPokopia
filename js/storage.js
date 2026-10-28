// Reads and writes progress in localStorage. Never touches game data.
// Shape (version 2): { version, updatedAt, entries, habitats, houses, town }
//   entries  - by Pokémon id   { movedIn, area, notes }
//   habitats - by habitat slug { built }
//   houses   - by house id     { name, members: [pokémon ids] }
//   town     - by area name    { w, h, cells: { "x,y": { kind, ref } } }
// The sync token is stored under its own key and is never part of this object.
(function () {
  var KEY = "pokopia.collection";
  var VERSION = 2;

  function empty() {
    return { version: VERSION, updatedAt: null, entries: {}, habitats: {}, houses: {}, town: {} };
  }

  // Add missing sections and bump the version. Never removes anything, including unknown ids.
  function migrate(data) {
    if (!data || typeof data !== "object" || typeof data.entries !== "object" || !data.entries) {
      return empty();
    }
    ["habitats", "houses", "town"].forEach(function (k) {
      if (!data[k] || typeof data[k] !== "object") data[k] = {};
    });
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

  function save(data) {
    data.updatedAt = new Date().toISOString();
    try {
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

  window.PokopiaStorage = { load: load, save: save, empty: empty, migrate: migrate, replace: replace };
})();

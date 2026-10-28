// Reads and writes progress in localStorage. Never touches game data.
(function () {
  var KEY = "pokopia.collection";

  function empty() {
    return { version: 1, updatedAt: null, entries: {} };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      var data = JSON.parse(raw);
      if (!data || typeof data.entries !== "object") return empty();
      return data;
    } catch (e) {
      return empty();
    }
  }

  function save(data) {
    data.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  window.PokopiaStorage = { load: load, save: save, empty: empty };
})();

// Startup and wiring: loads data and progress, handles search, filters, editing, export/import.
(function () {
  var pokemon = (window.POKOPIA_DB && window.POKOPIA_DB.pokemon) || [];
  var D = window.PokopiaData;
  var progress = PokopiaStorage.load();
  var prefs = PokopiaStorage.pref("index");
  var filter = prefs.filter || "all";
  var dex = prefs.dex || "all";
  var query = prefs.query || "";
  var now = { on: !!prefs.nowOn, time: prefs.nowTime || "day", weather: prefs.nowWeather || "sun" };
  var openId = null;
  var selecting = false;
  var selected = {};
  var shown = [];

  var listEl = document.getElementById("list");
  var counterEl = document.getElementById("counter");
  var panel = document.getElementById("panel");
  var backdrop = document.getElementById("backdrop");
  var searchEl = document.getElementById("search");
  var dexEl = document.getElementById("dex");
  var filterButtons = document.querySelectorAll("[data-filter]");

  function savePrefs() {
    PokopiaStorage.pref("index", Object.assign(PokopiaStorage.pref("index"), {
      filter: filter, dex: dex, query: query,
      nowOn: now.on, nowTime: now.time, nowWeather: now.weather
    }));
  }

  function entryFor(id) {
    if (!progress.entries[id]) progress.entries[id] = {};
    return progress.entries[id];
  }

  function persist() {
    if (!PokopiaStorage.save(progress)) {
      alert("Could not save progress. Browser storage may be blocked or full.");
    }
  }

  function merged() {
    return pokemon.map(function (p) {
      return PokopiaRender.merge(p, progress.entries[p.id]);
    });
  }

  // Can this Pokémon appear at the chosen time and weather in any of its habitats?
  function appearsNow(p) {
    return p.habitats.some(function (h) {
      var t = !h.time || !h.time.length || h.time.indexOf(now.time) !== -1;
      var w = !h.weather || !h.weather.length || h.weather.indexOf(now.weather) !== -1;
      return t && w;
    });
  }

  function refresh() {
    var all = merged().filter(function (p) { return dex === "all" || p.dex === dex; });
    var movedCount = all.filter(function (p) { return p.movedIn; }).length;
    counterEl.textContent = movedCount + " / " + all.length + " moved in";

    var q = query.trim().toLowerCase();
    shown = all.filter(function (p) {
      if (filter === "in" && !p.movedIn) return false;
      if (filter === "out" && p.movedIn) return false;
      if (filter === "wish" && !p.wish) return false;
      if (now.on && (p.movedIn || !appearsNow(p))) return false;
      if (!q) return true;
      var habitats = p.habitats.map(function (h) { return h.name; });
      return [p.label, p.name, p.specialties.join(" "), habitats.join(" "), p.area, p.region, p.notes]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
    PokopiaRender.renderList(listEl, shown, {
      onToggle: toggle, onWish: wish, selected: selecting ? selected : null,
      onOpen: function (id) { if (selecting) toggleSelected(id); else openPanel(id); }
    });
    renderBulk();
    renderDash(all);
  }

  function toggle(id, value) {
    entryFor(id).movedIn = value;
    persist();
    refresh();
  }

  function wish(id, value) {
    if (value) entryFor(id).wish = true; else delete entryFor(id).wish;
    persist();
    refresh();
    if (openId === id) openPanel(id);
  }

  // ---- overview ----
  function bar(label, done, total) {
    var wrap = document.createElement("div");
    wrap.className = "bar";
    var a = document.createElement("span");
    a.textContent = label;
    var b = document.createElement("span");
    b.textContent = done + " / " + total;
    var track = document.createElement("i");
    var fill = document.createElement("b");
    fill.style.width = (total ? Math.round(done * 100 / total) : 0) + "%";
    track.appendChild(fill);
    wrap.appendChild(a);
    wrap.appendChild(b);
    wrap.appendChild(track);
    return wrap;
  }

  function renderDash() {
    var body = document.getElementById("dash-body");
    if (!document.getElementById("dash").open) return; // only build it when it is open
    body.textContent = "";
    var grid = document.createElement("div");
    grid.className = "dash-grid";
    var every = merged();
    function count(list) { return list.filter(function (p) { return p.movedIn; }).length; }
    grid.appendChild(bar("All Pokémon", count(every), every.length));
    [["main", "Main dex"], ["event", "Event dex"], ["basin", "Bubbly Basin"]].forEach(function (d) {
      var part = every.filter(function (p) { return p.dex === d[0]; });
      if (part.length) grid.appendChild(bar(d[1], count(part), part.length));
    });
    var built = D.habitats.filter(function (h) { return progress.habitats[h.slug] && progress.habitats[h.slug].built; }).length;
    if (D.habitats.length) grid.appendChild(bar("Habitats built", built, D.habitats.length));
    var wished = every.filter(function (p) { return p.wish && !p.movedIn; }).length;
    body.appendChild(grid);

    if (window.PokopiaShop && D.habitats.length) {
      var next = PokopiaShop.suggestions(progress).slice(0, 3);
      if (next.length) {
        var h3 = document.createElement("h3");
        h3.textContent = "Build next";
        body.appendChild(h3);
        var ul = document.createElement("ul");
        next.forEach(function (s) {
          var li = document.createElement("li");
          var a = document.createElement("a");
          a.href = "habitats.html#" + encodeURIComponent(s.habitat.slug);
          a.textContent = s.habitat.name;
          li.appendChild(a);
          li.appendChild(document.createTextNode(" · " + s.fresh.length + " new Pokémon"));
          ul.appendChild(li);
        });
        body.appendChild(ul);
        var more = document.createElement("a");
        more.href = "plan.html";
        more.textContent = "See the full plan" + (wished ? " (" + wished + " wishlisted to find)" : "");
        body.appendChild(more);
      }
    }
  }

  document.getElementById("dash").addEventListener("toggle", function () {
    renderDash();
    PokopiaStorage.pref("index", Object.assign(PokopiaStorage.pref("index"), { dashOpen: this.open }));
  });

  // ---- select several ----
  function toggleSelected(id) {
    if (selected[id]) delete selected[id]; else selected[id] = true;
    refresh();
  }

  function renderBulk() {
    var n = Object.keys(selected).length;
    document.getElementById("bulk").hidden = !selecting;
    document.getElementById("bulk-count").textContent = n + " selected";
    ["bulk-in", "bulk-out", "bulk-star"].forEach(function (id) { document.getElementById(id).disabled = !n; });
  }

  function setSelecting(on) {
    selecting = on;
    selected = {};
    var btn = document.getElementById("select-toggle");
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
    if (on) closePanel();
    refresh();
  }

  function bulk(fn) {
    Object.keys(selected).forEach(fn);
    persist();
    selected = {};
    refresh();
  }

  document.getElementById("select-toggle").addEventListener("click", function () { setSelecting(!selecting); });
  document.getElementById("bulk-in").addEventListener("click", function () {
    bulk(function (id) { entryFor(id).movedIn = true; });
  });
  document.getElementById("bulk-out").addEventListener("click", function () {
    bulk(function (id) { entryFor(id).movedIn = false; });
  });
  document.getElementById("bulk-star").addEventListener("click", function () {
    // Star them all; if every one already has a star, take the stars off instead.
    var ids = Object.keys(selected);
    var allStarred = ids.every(function (id) { return entryFor(id).wish; });
    bulk(function (id) { if (allStarred) delete entryFor(id).wish; else entryFor(id).wish = true; });
  });
  document.getElementById("bulk-visible").addEventListener("click", function () {
    shown.forEach(function (p) { selected[p.id] = true; });
    refresh();
  });

  // ---- panel ----
  function openPanel(id) {
    openId = id;
    var p = merged().filter(function (x) { return x.id === id; })[0];
    PokopiaRender.fillPanel(p);
    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  function regionWarning() {
    var p = merged().filter(function (x) { return x.id === openId; })[0];
    if (p) PokopiaRender.showRegionWarning(p);
  }

  function closePanel() {
    openId = null;
    panel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("panel-open");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  // Panel fields save as you edit.
  document.getElementById("f-moved").addEventListener("change", function (e) {
    if (openId) { entryFor(openId).movedIn = e.target.checked; persist(); refresh(); }
  });
  document.getElementById("f-star").addEventListener("click", function () {
    if (openId) wish(openId, !entryFor(openId).wish);
  });
  document.getElementById("f-region").addEventListener("input", function (e) {
    if (openId) { entryFor(openId).region = e.target.value; persist(); refresh(); regionWarning(); }
  });
  document.getElementById("f-area").addEventListener("input", function (e) {
    if (openId) { entryFor(openId).area = e.target.value; persist(); refresh(); regionWarning(); }
  });
  document.getElementById("f-notes").addEventListener("input", function (e) {
    if (openId) { entryFor(openId).notes = e.target.value; persist(); }
  });

  document.getElementById("panel-close").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openId) closePanel();
  });

  searchEl.addEventListener("input", function (e) {
    query = e.target.value;
    savePrefs();
    refresh();
  });

  dexEl.addEventListener("change", function (e) {
    dex = e.target.value;
    savePrefs();
    refresh();
  });

  function markFilterButtons() {
    Array.prototype.forEach.call(filterButtons, function (b) {
      b.classList.toggle("active", b.getAttribute("data-filter") === filter);
    });
  }
  Array.prototype.forEach.call(filterButtons, function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.getAttribute("data-filter");
      markFilterButtons();
      savePrefs();
      refresh();
    });
  });

  // ---- find now ----
  var nowToggle = document.getElementById("now-toggle");
  function showNow() {
    nowToggle.classList.toggle("active", now.on);
    nowToggle.setAttribute("aria-pressed", String(now.on));
    document.getElementById("now").hidden = !now.on;
  }
  nowToggle.addEventListener("click", function () {
    now.on = !now.on;
    showNow();
    savePrefs();
    refresh();
  });
  document.getElementById("now-time").addEventListener("change", function (e) { now.time = e.target.value; savePrefs(); refresh(); });
  document.getElementById("now-weather").addEventListener("change", function (e) { now.weather = e.target.value; savePrefs(); refresh(); });

  // ---- export / import / older copies ----
  document.getElementById("export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pokopia-progress.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  var importInput = document.getElementById("import-file");
  document.getElementById("import").addEventListener("click", function () {
    importInput.click();
  });
  importInput.addEventListener("change", function () {
    var file = importInput.files[0];
    importInput.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data.entries !== "object" || data.entries === null) {
          throw new Error("bad format");
        }
        // A merge file (e.g. from the Notion tracker) only adds: it sets moved in, and area / should-live-in where empty.
        if (data.merge === true) {
          var known = {};
          pokemon.forEach(function (p) { known[p.id] = true; });
          var ids = Object.keys(data.entries).filter(function (id) { return known[id]; });
          var added = ids.filter(function (id) { return data.entries[id].movedIn && !(progress.entries[id] && progress.entries[id].movedIn); });
          if (!confirm("Add " + added.length + " moved-in marks from this file (" + ids.length + " Pokémon in it)? Nothing is removed.")) return;
          ids.forEach(function (id) {
            var src = data.entries[id];
            var e = entryFor(id);
            if (src.movedIn) e.movedIn = true;
            if (src.area && !e.area) e.area = src.area;
            if (src.region && !e.region) e.region = src.region;
          });
          persist();
          closePanel();
          refresh();
          return;
        }
        if (!confirm("Replace your current progress with this file?")) return;
        progress = PokopiaStorage.replace(data) || progress;
        closePanel();
        refresh();
      } catch (e) {
        alert("That file isn't a valid progress export.");
      }
    };
    reader.readAsText(file);
  });

  var snapsEl = document.getElementById("snaps");
  document.getElementById("snaps-toggle").addEventListener("click", function () {
    snapsEl.hidden = !snapsEl.hidden;
    if (snapsEl.hidden) return;
    snapsEl.textContent = "";
    var list = PokopiaStorage.snapshots();
    var backup = null;
    try { backup = JSON.parse(localStorage.getItem("pokopia.backup") || "null"); } catch (e) { backup = null; }
    if (backup && backup.entries) {
      list.push({ t: null, label: "Before the last import or sync", data: backup,
        moved: Object.keys(backup.entries).filter(function (k) { return backup.entries[k].movedIn; }).length });
    }
    if (!list.length) {
      var none = document.createElement("li");
      none.textContent = "No older copies yet. One is kept automatically at most every 30 minutes while you edit.";
      snapsEl.appendChild(none);
      return;
    }
    list.forEach(function (s) {
      var li = document.createElement("li");
      var when = s.label || new Date(s.t).toLocaleString();
      li.appendChild(document.createTextNode(when + " · " + s.moved + " moved in "));
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip small";
      b.textContent = "Restore";
      b.addEventListener("click", function () {
        if (!confirm("Go back to this copy? What you have now is kept as the last backup.")) return;
        progress = PokopiaStorage.replace(s.data) || progress;
        snapsEl.hidden = true;
        closePanel();
        refresh();
      });
      li.appendChild(b);
      snapsEl.appendChild(li);
    });
  });

  // A sync pulled newer progress from the Gist.
  document.addEventListener("pokopia-synced", function () {
    progress = PokopiaStorage.load();
    closePanel();
    refresh();
  });

  // index.html#pokemon-id opens that Pokémon (links from the habitat guide).
  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && pokemon.some(function (p) { return p.id === id; })) openPanel(id);
  }
  window.addEventListener("hashchange", fromHash);

  // Put the saved view back.
  searchEl.value = query;
  dexEl.value = dex;
  document.getElementById("now-time").value = now.time;
  document.getElementById("now-weather").value = now.weather;
  markFilterButtons();
  showNow();
  document.getElementById("dash").open = !!prefs.dashOpen;

  refresh();
  fromHash();

  PokopiaStorage.keepScroll("index");
})();

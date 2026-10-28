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
  // Extra filters ("More filters"); "" means any.
  var MORE = ["ideal", "spec", "fav", "flavor", "where", "lives"];
  var more = prefs.more || {};
  var moreOpen = !!prefs.moreOpen;
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
      nowOn: now.on, nowTime: now.time, nowWeather: now.weather, more: more, moreOpen: moreOpen
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
      if (!passesMore(p)) return false;
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

  function passesMore(p) {
    if (more.ideal && p.idealHabitat !== more.ideal) return false;
    if (more.spec && p.specialties.indexOf(more.spec) === -1) return false;
    if (more.fav && p.favorites.indexOf(more.fav) === -1) return false;
    if (more.flavor && p.flavor !== more.flavor) return false;
    if (more.where && !p.habitats.some(function (h) {
      return h.areas && (h.areas.indexOf(more.where) !== -1 || h.areas.indexOf("any") !== -1);
    })) return false;
    if (more.lives === "__none" && p.area) return false;
    if (more.lives && more.lives !== "__none" && p.area.toLowerCase() !== more.lives.toLowerCase()) return false;
    return true;
  }

  // Fill the extra filter dropdowns from the data.
  (function fillMore() {
    function uniq(list) {
      var seen = {};
      list.forEach(function (v) { if (v) seen[v] = true; });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
    }
    var opts = {
      ideal: ["Any ideal habitat", uniq(pokemon.map(function (p) { return p.idealHabitat; }))],
      spec: ["Any specialty", uniq([].concat.apply([], pokemon.map(function (p) { return p.specialties || []; }))).filter(function (s) { return s !== "???"; })],
      fav: ["Any favorite", uniq([].concat.apply([], pokemon.map(function (p) { return p.favorites || []; })))],
      flavor: ["Any flavor", uniq(pokemon.map(function (p) { return p.flavor; }))],
      where: ["Can appear anywhere", D.TOWN_AREAS],
      lives: ["Lives anywhere", D.TOWN_AREAS.concat(["__none"])]
    };
    MORE.forEach(function (k) {
      var sel = document.getElementById("f-" + k);
      var first = document.createElement("option");
      first.value = "";
      first.textContent = opts[k][0];
      sel.appendChild(first);
      opts[k][1].forEach(function (v) {
        var o = document.createElement("option");
        o.value = v;
        o.textContent = v === "__none" ? "No area set" : (k === "flavor" ? v + " flavors" : (k === "lives" ? "Lives in " + v : (k === "where" ? "Can appear in " + v : v)));
        sel.appendChild(o);
      });
      sel.value = more[k] || "";
      sel.addEventListener("change", function () {
        if (sel.value) more[k] = sel.value; else delete more[k];
        showMore();
        savePrefs();
        refresh();
      });
    });
    var list = document.getElementById("area-list");
    D.TOWN_AREAS.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a;
      list.appendChild(o);
    });
  })();

  var moreToggle = document.getElementById("more-toggle");
  function showMore() {
    var n = MORE.filter(function (k) { return more[k]; }).length;
    moreToggle.textContent = n ? "More filters (" + n + ")" : "More filters";
    moreToggle.classList.toggle("active", moreOpen || n > 0);
    moreToggle.setAttribute("aria-pressed", String(moreOpen));
    document.getElementById("more").hidden = !moreOpen;
  }
  moreToggle.addEventListener("click", function () { moreOpen = !moreOpen; showMore(); savePrefs(); });
  document.getElementById("more-reset").addEventListener("click", function () {
    more = {};
    MORE.forEach(function (k) { document.getElementById("f-" + k).value = ""; });
    showMore();
    savePrefs();
    refresh();
  });

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

    // Where your moved-in Pokémon live (the Area field), with how many specialties each area has.
    var moved = every.filter(function (p) { return p.movedIn; });
    if (moved.length) {
      var h = document.createElement("h3");
      h.textContent = "By area";
      body.appendChild(h);
      var areas = document.createElement("ul");
      D.TOWN_AREAS.concat([""]).forEach(function (a) {
        var here = moved.filter(function (p) { return a ? p.area.toLowerCase() === a.toLowerCase() : !p.area; });
        if (!here.length) return;
        var specs = {};
        here.forEach(function (p) { p.specialties.forEach(function (x) { specs[x] = true; }); });
        var li = document.createElement("li");
        li.textContent = (a || "No area set") + ": " + here.length + " Pokémon" + (a ? ", " + Object.keys(specs).length + " specialties" : "");
        areas.appendChild(li);
      });
      body.appendChild(areas);
    }

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
    document.getElementById("bulk-compare").disabled = n < 2 || n > 3;
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
  // ---- compare 2-3 Pokémon ----
  var compareDialog = document.getElementById("compare");
  document.getElementById("bulk-compare").addEventListener("click", function () {
    var mons = Object.keys(selected).map(function (id) { return D.pokemonById[id]; }).filter(Boolean);
    if (mons.length < 2) return;
    var body = document.getElementById("compare-body");
    body.textContent = "";
    function areasOf(p) {
      var out = {};
      p.habitats.forEach(function (h) { (h.areas || []).forEach(function (a) { out[a === "any" ? "All areas" : a] = true; }); });
      return Object.keys(out);
    }
    var rows = [
      ["Ideal habitat", function (p) { return p.idealHabitat ? [p.idealHabitat] : []; }],
      ["Flavor", function (p) { return p.flavor ? [p.flavor] : []; }],
      ["Specialty", function (p) { return p.specialties || []; }],
      ["Favorites", function (p) { return p.favorites || []; }],
      ["Habitats", function (p) { return p.habitats.map(function (h) { return h.name; }); }],
      ["Can appear in", areasOf]
    ];
    var table = document.createElement("table");
    table.className = "cmp";
    var head = document.createElement("tr");
    head.appendChild(document.createElement("th"));
    mons.forEach(function (p) {
      var th = document.createElement("th");
      var pic = D.pokemonPic(p, 40);
      if (pic) th.appendChild(pic);
      var a = document.createElement("a");
      a.href = "index.html#" + encodeURIComponent(p.id);
      a.textContent = p.name;
      a.addEventListener("click", function () { compareDialog.close(); });
      th.appendChild(a);
      head.appendChild(th);
    });
    table.appendChild(head);
    rows.forEach(function (r) {
      var lists = mons.map(r[1]);
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = r[0];
      tr.appendChild(th);
      lists.forEach(function (vals) {
        var td = document.createElement("td");
        if (!vals.length) td.textContent = "–";
        vals.forEach(function (v, i) {
          // Shared by every Pokémon in the comparison: shown in bold.
          var common = lists.every(function (l) { return l.indexOf(v) !== -1; });
          if (i) td.appendChild(document.createTextNode(", "));
          var span = document.createElement(common ? "b" : "span");
          span.textContent = v;
          td.appendChild(span);
        });
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    body.appendChild(table);
    var scores = [];
    for (var i = 0; i < mons.length; i++) {
      for (var j = i + 1; j < mons.length; j++) {
        scores.push(mons[i].name + " + " + mons[j].name + ": " + D.matchScore(mons[i], mons[j]) + "%");
      }
    }
    var p = document.createElement("p");
    p.className = "sub";
    p.textContent = "Roommate match: " + scores.join(" · ") + ". Bold = shared by all.";
    body.appendChild(p);
    compareDialog.showModal();
  });
  document.getElementById("compare-close").addEventListener("click", function () { compareDialog.close(); });

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
  showMore();
  document.getElementById("dash").open = !!prefs.dashOpen;

  refresh();
  fromHash();

  PokopiaStorage.keepScroll("index");
})();

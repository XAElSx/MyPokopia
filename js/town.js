// Town planner: a simple grid per area where houses (Pairings) and habitats (Habitat guide) are placed.
// Saved in progress.town[area] = { w, h, cells: { "x,y": { kind: "house"|"habitat", ref } } }.
(function () {
  var D = window.PokopiaData;
  var W = 12;
  var H = 12;
  var AREAS = D.ALL_AREAS.concat(["Bubbly Basin"]);
  var progress = PokopiaStorage.load();
  var area = AREAS[0];
  var tool = "select";
  var selected = null; // "x,y"

  var gridEl = document.getElementById("grid");

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function persist() {
    if (!PokopiaStorage.save(progress)) alert("Could not save progress. Browser storage may be blocked or full.");
  }

  function areaData() {
    if (!progress.town[area]) progress.town[area] = { w: W, h: H, cells: {} };
    var t = progress.town[area];
    if (!t.cells) t.cells = {};
    return t;
  }

  function isBuilt(slug) { return !!(progress.habitats[slug] && progress.habitats[slug].built); }

  // What is placed in a cell, resolved to a label and a kind; null ref targets (deleted house) show as "?".
  function describe(cell) {
    if (cell.kind === "house") {
      var house = progress.houses[cell.ref];
      return { kind: "house", label: house ? house.name : "?", short: house ? initials(house.name) : "?", missing: !house };
    }
    var h = D.habitatBySlug[cell.ref];
    return { kind: "habitat", label: h ? h.name : "?", short: h ? initials(h.name) : "?", missing: !h, built: h && isBuilt(h.slug) };
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("") || "?";
  }

  // ---- grid ----
  function renderGrid() {
    var t = areaData();
    gridEl.textContent = "";
    gridEl.style.setProperty("--cols", W);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var key = x + "," + y;
        var cell = t.cells[key];
        var b = el("button", "sq");
        b.type = "button";
        b.setAttribute("data-key", key);
        b.setAttribute("aria-label", "Square " + (x + 1) + "," + (y + 1) + (cell ? ": " + describe(cell).label : ": empty"));
        if (cell) {
          var d = describe(cell);
          b.classList.add(d.kind);
          if (d.built) b.classList.add("built");
          if (d.missing) b.classList.add("missing");
          b.textContent = d.short;
        }
        if (key === selected) b.classList.add("sel");
        gridEl.appendChild(b);
      }
    }
    renderLegend();
    renderInfo();
  }

  function renderLegend() {
    var t = areaData();
    var counts = {};
    Object.keys(t.cells).forEach(function (k) {
      var c = t.cells[k];
      var id = c.kind + ":" + c.ref;
      counts[id] = counts[id] || { cell: c, n: 0 };
      counts[id].n++;
    });
    var ul = document.getElementById("legend");
    ul.textContent = "";
    var keys = Object.keys(counts);
    document.getElementById("counter").textContent = Object.keys(t.cells).length + " placed";
    if (!keys.length) { ul.appendChild(el("li", null, "Nothing placed yet.")); return; }
    keys.forEach(function (id) {
      var d = describe(counts[id].cell);
      var li = el("li");
      var link = el("a", null, d.label);
      link.href = d.kind === "house" ? "pairings.html" : "habitats.html#" + encodeURIComponent(counts[id].cell.ref);
      li.appendChild(link);
      li.appendChild(el("span", "sub", " · " + d.kind + (counts[id].n > 1 ? " ×" + counts[id].n : "") + (d.built ? " · built" : "")));
      ul.appendChild(li);
    });
  }

  function renderInfo() {
    var box = document.getElementById("info");
    var title = document.getElementById("info-title");
    box.textContent = "";
    var cell = selected && areaData().cells[selected];
    if (!selected) { title.textContent = "Tap a square"; return; }
    var parts = selected.split(",");
    title.textContent = "Square " + (+parts[0] + 1) + ", " + (+parts[1] + 1);
    if (!cell) { box.appendChild(el("p", "sub", "Empty. Choose Place to put something here.")); return; }
    var d = describe(cell);
    box.appendChild(el("p", null, d.label + " (" + d.kind + ")"));
    if (cell.kind === "house" && progress.houses[cell.ref]) {
      var ul = el("ul", "habitats");
      progress.houses[cell.ref].members.forEach(function (id) {
        var p = D.pokemonById[id];
        if (p) ul.appendChild(el("li", null, p.name + (p.idealHabitat ? " · " + p.idealHabitat : "")));
      });
      box.appendChild(ul);
    } else if (cell.kind === "habitat" && D.habitatBySlug[cell.ref]) {
      var h = D.habitatBySlug[cell.ref];
      var ul2 = el("ul", "habitats");
      h.requirements.forEach(function (r) { ul2.appendChild(el("li", null, r.item + (r.amount ? " ×" + r.amount : ""))); });
      box.appendChild(ul2);
      var a = el("a", null, "Open in habitat guide");
      a.href = "habitats.html#" + encodeURIComponent(h.slug);
      box.appendChild(a);
    }
  }

  // ---- place palette ----
  function fillRefs() {
    var kind = document.getElementById("place-kind").value;
    var sel = document.getElementById("place-ref");
    sel.textContent = "";
    if (kind === "house") {
      var ids = Object.keys(progress.houses);
      if (!ids.length) sel.appendChild(el("option", null, "No houses yet (build one in Pairings)"));
      ids.forEach(function (id) {
        var o = el("option", null, progress.houses[id].name + " (" + progress.houses[id].members.length + ")");
        o.value = id;
        sel.appendChild(o);
      });
    } else {
      D.habitats.slice().sort(function (a, b) { return (isBuilt(b.slug) - isBuilt(a.slug)) || a.name.localeCompare(b.name); })
        .forEach(function (h) {
          var o = el("option", null, (isBuilt(h.slug) ? "✓ " : "") + h.name);
          o.value = h.slug;
          sel.appendChild(o);
        });
    }
  }

  function setTool(t) {
    tool = t;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-tool") === t);
    });
    document.getElementById("place").hidden = t !== "place";
    if (t === "place") fillRefs();
  }

  gridEl.addEventListener("click", function (e) {
    var b = e.target.closest(".sq");
    if (!b) return;
    var key = b.getAttribute("data-key");
    var t = areaData();
    if (tool === "place") {
      var ref = document.getElementById("place-ref").value;
      var kind = document.getElementById("place-kind").value;
      if (!ref || (kind === "house" && !progress.houses[ref])) return;
      t.cells[key] = { kind: kind, ref: ref };
      persist();
    } else if (tool === "erase") {
      if (t.cells[key]) { delete t.cells[key]; persist(); }
    }
    selected = key;
    renderGrid();
  });

  document.getElementById("place-kind").addEventListener("change", fillRefs);
  Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
    b.addEventListener("click", function () { setTool(b.getAttribute("data-tool")); });
  });
  document.getElementById("clear-area").addEventListener("click", function () {
    var n = Object.keys(areaData().cells).length;
    if (!n || !confirm("Remove all " + n + " placed items from " + area + "?")) return;
    areaData().cells = {};
    persist();
    selected = null;
    renderGrid();
  });

  var areaSel = document.getElementById("area");
  AREAS.forEach(function (a) {
    var o = el("option", null, a);
    o.value = a;
    areaSel.appendChild(o);
  });
  areaSel.addEventListener("change", function () { area = areaSel.value; selected = null; renderGrid(); });

  document.addEventListener("pokopia-synced", function () { progress = PokopiaStorage.load(); selected = null; renderGrid(); });

  renderGrid();
})();

// Town planner: a simple grid per area where houses (Pairings) and habitats (Habitat guide) are placed.
// Saved in progress.town[area] = { w, h, cells: { "x,y": { kind: "house"|"habitat", ref } } }.
(function () {
  var D = window.PokopiaData;
  var W = 12;
  var H = 12;
  var AREAS = D.TOWN_AREAS;
  var progress = PokopiaStorage.load();
  var area = AREAS[0];
  var tool = "select";
  var selected = null; // "x,y"
  var undoStack = []; // [{ area, cells (JSON) }], this visit only
  var redoStack = [];
  var painting = false;
  var lastKey = null;

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
      return { kind: "house", label: house ? house.name : "?", short: house ? initials(house.name) : "?", missing: !house, mixed: !!house && mixed(house) };
    }
    var h = D.habitatBySlug[cell.ref];
    return { kind: "habitat", label: h ? h.name : "?", short: h ? initials(h.name) : "?", missing: !h, built: h && isBuilt(h.slug) };
  }

  // A house whose members do not all share one ideal habitat (same rule as the Pairings score).
  function mixed(house) {
    var seen = {};
    house.members.forEach(function (id) { var p = D.pokemonById[id]; if (p) seen[p.idealHabitat || "?"] = true; });
    return Object.keys(seen).length > 1;
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
        var b = el("button", "sq");
        b.type = "button";
        b.setAttribute("data-key", x + "," + y);
        decorate(b, t);
        gridEl.appendChild(b);
      }
    }
    renderLegend();
    renderInfo();
  }

  // Look of one square, from what is placed there.
  function decorate(b, t) {
    var key = b.getAttribute("data-key");
    var xy = key.split(",");
    var cell = t.cells[key];
    var d = cell && describe(cell);
    b.className = "sq";
    b.textContent = "";
    b.setAttribute("aria-label", "Square " + (+xy[0] + 1) + "," + (+xy[1] + 1) + (d ? ": " + d.label : ": empty"));
    if (d) {
      b.classList.add(d.kind);
      if (d.built) b.classList.add("built");
      if (d.missing) b.classList.add("missing");
      if (d.mixed) b.classList.add("mixed");
      b.textContent = d.short;
    }
    if (key === selected) b.classList.add("sel");
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
      li.appendChild(el("span", "sub", " · " + d.kind + (counts[id].n > 1 ? " ×" + counts[id].n : "") + (d.built ? " · built" : "") +
        (d.mixed ? " · mixed ideal habitats" : "")));
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
      if (d.mixed) box.appendChild(el("p", "sub", "Heads up: these Pokémon don't all share one ideal habitat, so they won't be at their happiest together."));
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
    // Dragging to paint should not scroll the page on a phone.
    gridEl.style.touchAction = t === "select" ? "" : "none";
    if (t === "place") fillRefs();
  }

  // ---- undo / redo (this visit only) ----
  function remember() {
    undoStack.push({ area: area, cells: JSON.stringify(areaData().cells) });
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
    showHistory();
  }

  function showHistory() {
    document.getElementById("undo").disabled = !undoStack.length;
    document.getElementById("redo").disabled = !redoStack.length;
  }

  function step(from, to) {
    var s = from.pop();
    if (!s) return;
    if (!progress.town[s.area]) progress.town[s.area] = { w: W, h: H, cells: {} };
    to.push({ area: s.area, cells: JSON.stringify(progress.town[s.area].cells || {}) });
    progress.town[s.area].cells = JSON.parse(s.cells);
    persist();
    if (s.area !== area) { area = s.area; document.getElementById("area").value = area; }
    selected = null;
    showHistory();
    renderGrid();
  }
  document.getElementById("undo").addEventListener("click", function () { step(undoStack, redoStack); });
  document.getElementById("redo").addEventListener("click", function () { step(redoStack, undoStack); });
  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    var k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); step(undoStack, redoStack); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); step(redoStack, undoStack); }
  });

  // ---- tapping and dragging ----
  // Changes one square with the current tool; returns true when it changed.
  function apply(key) {
    var t = areaData();
    if (tool === "place") {
      var ref = document.getElementById("place-ref").value;
      var kind = document.getElementById("place-kind").value;
      if (!ref || (kind === "house" && !progress.houses[ref])) return false;
      var c = t.cells[key];
      if (c && c.kind === kind && c.ref === ref) return false;
      t.cells[key] = { kind: kind, ref: ref };
      return true;
    }
    if (tool === "erase" && t.cells[key]) { delete t.cells[key]; return true; }
    return false;
  }

  function squareAt(x, y) {
    var n = document.elementFromPoint(x, y);
    return n && n.closest ? n.closest(".sq") : null;
  }

  function paintAt(b) {
    if (!b || !gridEl.contains(b)) return;
    var key = b.getAttribute("data-key");
    if (key === lastKey) return;
    lastKey = key;
    var prev = selected;
    selected = key;
    apply(key);
    var t = areaData();
    var old = prev && gridEl.querySelector('[data-key="' + prev + '"]');
    if (old) decorate(old, t);
    decorate(b, t);
  }

  function onMove(e) { if (painting) paintAt(squareAt(e.clientX, e.clientY)); }

  function onUp() {
    if (!painting) return;
    painting = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    var before = undoStack[undoStack.length - 1];
    // Nothing changed during the stroke: drop the undo step again.
    if (before && before.area === area && before.cells === JSON.stringify(areaData().cells)) { undoStack.pop(); showHistory(); }
    else persist();
    renderGrid();
  }

  gridEl.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".sq");
    if (!b || e.button > 0) return;
    if (tool === "select") {
      selected = b.getAttribute("data-key");
      renderGrid();
      return;
    }
    e.preventDefault();
    remember();
    painting = true;
    lastKey = null;
    paintAt(b);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
  // Keyboard: Enter or Space on a square acts like a tap.
  gridEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var b = e.target.closest(".sq");
    if (!b) return;
    e.preventDefault();
    var key = b.getAttribute("data-key");
    if (tool !== "select") {
      remember();
      if (apply(key)) persist(); else { undoStack.pop(); showHistory(); }
    }
    selected = key;
    renderGrid();
    var again = gridEl.querySelector('[data-key="' + key + '"]');
    if (again) again.focus();
  });

  // ---- save as picture ----
  document.getElementById("png").addEventListener("click", function () {
    var css = getComputedStyle(document.documentElement);
    function v(name) { return css.getPropertyValue(name).trim(); }
    var size = 44, pad = 16, gap = 3, scale = 2;
    var t = areaData();
    var legend = [];
    var seen = {};
    Object.keys(t.cells).forEach(function (k) {
      var d = describe(t.cells[k]);
      if (!seen[d.kind + d.label]) { seen[d.kind + d.label] = true; legend.push(d); }
    });
    var gridW = W * (size + gap) - gap;
    var top = pad + 30;
    var c = document.createElement("canvas");
    c.width = (gridW + pad * 2) * scale;
    c.height = (top + H * (size + gap) + 14 + legend.length * 20 + pad) * scale;
    var g = c.getContext("2d");
    g.scale(scale, scale);
    g.fillStyle = v("--bg");
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = v("--text");
    g.font = "bold 18px system-ui, sans-serif";
    g.fillText(area, pad, pad + 16);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var cell = t.cells[x + "," + y];
        var d = cell && describe(cell);
        var px = pad + x * (size + gap), py = top + y * (size + gap);
        g.fillStyle = d ? (d.missing ? v("--warn-bg") : d.kind === "house" ? v("--house-bg") : v("--accent-soft")) : v("--card");
        g.strokeStyle = d ? (d.missing ? v("--warn-line") : d.kind === "house" ? v("--house-line") : v("--accent")) : v("--line");
        g.lineWidth = d && d.built ? 2 : 1;
        g.beginPath();
        if (g.roundRect) g.roundRect(px, py, size, size, 6); else g.rect(px, py, size, size);
        g.fill();
        g.stroke();
        if (d) {
          g.fillStyle = v("--text");
          g.font = "bold 13px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText(d.short + (d.mixed ? "!" : ""), px + size / 2, py + size / 2 + 5);
          g.textAlign = "left";
        }
      }
    }
    g.font = "13px system-ui, sans-serif";
    g.fillStyle = v("--text");
    legend.forEach(function (d, i) {
      g.fillText(d.short + "   " + d.label + " (" + d.kind + ")", pad, top + H * (size + gap) + 24 + i * 20);
    });
    c.toBlob(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pokopia-" + area.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  });

  document.getElementById("place-kind").addEventListener("change", fillRefs);
  Array.prototype.forEach.call(document.querySelectorAll("[data-tool]"), function (b) {
    b.addEventListener("click", function () { setTool(b.getAttribute("data-tool")); });
  });
  document.getElementById("clear-area").addEventListener("click", function () {
    var n = Object.keys(areaData().cells).length;
    if (!n || !confirm("Remove all " + n + " placed items from " + area + "? You can undo this.")) return;
    remember();
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

  document.addEventListener("pokopia-synced", function () {
    progress = PokopiaStorage.load();
    selected = null;
    undoStack = [];
    redoStack = [];
    showHistory();
    renderGrid();
  });

  renderGrid();
})();

// Startup and wiring: loads data and progress, handles search, filters, editing, export/import.
(function () {
  var pokemon = (window.POKOPIA_DB && window.POKOPIA_DB.pokemon) || [];
  var progress = PokopiaStorage.load();
  var filter = "all";
  var dex = "all";
  var query = "";
  var openId = null;

  var listEl = document.getElementById("list");
  var counterEl = document.getElementById("counter");
  var panel = document.getElementById("panel");
  var backdrop = document.getElementById("backdrop");

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

  function refresh() {
    var all = merged().filter(function (p) { return dex === "all" || p.dex === dex; });
    var movedCount = all.filter(function (p) { return p.movedIn; }).length;
    counterEl.textContent = movedCount + " / " + all.length + " moved in";

    var q = query.trim().toLowerCase();
    var shown = all.filter(function (p) {
      if (filter === "in" && !p.movedIn) return false;
      if (filter === "out" && p.movedIn) return false;
      if (!q) return true;
      var habitats = p.habitats.map(function (h) { return h.name; });
      return [p.label, p.name, p.specialties.join(" "), habitats.join(" "), p.area, p.notes]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
    PokopiaRender.renderList(listEl, shown, { onToggle: toggle, onOpen: openPanel });
  }

  function toggle(id, value) {
    entryFor(id).movedIn = value;
    persist();
    refresh();
  }

  function openPanel(id) {
    openId = id;
    var p = merged().filter(function (x) { return x.id === id; })[0];
    PokopiaRender.fillPanel(p);
    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  function closePanel() {
    openId = null;
    panel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("panel-open");
  }

  // Panel fields save as you edit.
  document.getElementById("f-moved").addEventListener("change", function (e) {
    if (openId) { entryFor(openId).movedIn = e.target.checked; persist(); refresh(); }
  });
  document.getElementById("f-area").addEventListener("input", function (e) {
    if (openId) { entryFor(openId).area = e.target.value; persist(); refresh(); }
  });
  document.getElementById("f-notes").addEventListener("input", function (e) {
    if (openId) { entryFor(openId).notes = e.target.value; persist(); }
  });

  document.getElementById("panel-close").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openId) closePanel();
  });

  document.getElementById("search").addEventListener("input", function (e) {
    query = e.target.value;
    refresh();
  });

  document.getElementById("dex").addEventListener("change", function (e) {
    dex = e.target.value;
    refresh();
  });

  var filterButtons = document.querySelectorAll("[data-filter]");
  Array.prototype.forEach.call(filterButtons, function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(filterButtons, function (b) {
        b.classList.toggle("active", b === btn);
      });
      refresh();
    });
  });

  // Export: download progress as a JSON file.
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

  // Import: replace progress with a previously exported file.
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
        if (!confirm("Replace your current progress with this file?")) return;
        progress = data;
        persist();
        closePanel();
        refresh();
      } catch (e) {
        alert("That file isn't a valid progress export.");
      }
    };
    reader.readAsText(file);
  });

  refresh();
})();

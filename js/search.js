// Search over everything: Pokémon, habitats, recipes and items. Opened from the nav ("Search all", Ctrl+K).
// Loads any data file the page did not already include.
(function () {
  var FILES = [
    ["POKOPIA_DB", "data/pokopia-pokemon.js"],
    ["POKOPIA_HABITATS", "data/pokopia-habitats.js"],
    ["POKOPIA_RECIPES", "data/pokopia-recipes.js"],
    ["POKOPIA_COOKING", "data/pokopia-cooking.js"]
  ];
  var index = null;
  var dialog, input, results;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function loadData() {
    return FILES.reduce(function (chain, f) {
      return chain.then(function () {
        if (window[f[0]]) return;
        return new Promise(function (resolve) {
          var s = document.createElement("script");
          s.src = f[1];
          s.onload = s.onerror = resolve;
          document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  function build() {
    var rows = [];
    ((window.POKOPIA_DB || {}).pokemon || []).forEach(function (p) {
      rows.push({ kind: "Pokémon", name: p.name, extra: (p.specialties || []).join(", "), href: "index.html#" + encodeURIComponent(p.id) });
    });
    ((window.POKOPIA_HABITATS || {}).habitats || []).forEach(function (h) {
      rows.push({ kind: "Habitat", name: h.name, extra: "#" + h.no, href: "habitats.html#" + encodeURIComponent(h.slug) });
    });
    var rdb = window.POKOPIA_RECIPES || {};
    var recipeSlugs = {};
    (rdb.recipes || []).forEach(function (r) {
      recipeSlugs[r.slug] = true;
      rows.push({ kind: "Recipe", name: r.name, extra: r.category, href: "recipes.html#" + encodeURIComponent(r.slug) });
    });
    var meals = (window.POKOPIA_COOKING || {}).meals || [];
    meals.forEach(function (m) { recipeSlugs[m.slug] = true; }); // meals are listed once, as a Meal
    (rdb.items || []).forEach(function (i) {
      if (recipeSlugs[i.slug]) return;
      rows.push({ kind: "Item", name: i.name, extra: (i.categories || []).join(", "), href: "recipes.html#" + encodeURIComponent(i.slug) });
    });
    meals.forEach(function (m) {
      rows.push({ kind: "Meal", name: m.name, extra: m.category + (m.flavor ? ", " + m.flavor : ""), href: "recipes.html#cook-" + encodeURIComponent(m.slug) });
    });
    rows.forEach(function (r) { r.key = r.name.toLowerCase(); });
    return rows;
  }

  function render() {
    var q = input.value.trim().toLowerCase();
    results.textContent = "";
    if (!q) { results.appendChild(el("li", "empty", "Type to search Pokémon, habitats, recipes and items.")); return; }
    var hits = index.filter(function (r) { return r.key.indexOf(q) !== -1; });
    // Names that start with the text come first, then shorter names.
    hits.sort(function (a, b) {
      return (a.key.indexOf(q) !== 0) - (b.key.indexOf(q) !== 0) || a.key.length - b.key.length;
    });
    if (!hits.length) { results.appendChild(el("li", "empty", "Nothing found.")); return; }
    hits.slice(0, 40).forEach(function (r) {
      var li = el("li");
      var a = el("a");
      a.href = r.href;
      a.appendChild(el("span", "name", r.name));
      a.appendChild(el("span", "sub", r.kind + (r.extra ? " · " + r.extra : "")));
      a.addEventListener("click", function () {
        // Same-page hash links do not reload; close so the page's own hash handler shows the panel.
        dialog.close();
      });
      li.appendChild(a);
      results.appendChild(li);
    });
  }

  function mount() {
    dialog = el("dialog", "search-dialog");
    input = el("input");
    input.type = "search";
    input.placeholder = "Search everything";
    input.setAttribute("aria-label", "Search everything");
    input.autocomplete = "off";
    results = el("ul", "search-results");
    dialog.appendChild(input);
    dialog.appendChild(results);
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = results.querySelector("a");
        if (first) first.click();
      }
    });
    document.body.appendChild(dialog);
  }

  function open() {
    loadData().then(function () {
      if (!index) { index = build(); mount(); }
      input.value = "";
      render();
      dialog.showModal();
      input.focus();
    });
  }

  window.PokopiaSearch = { open: open };
})();

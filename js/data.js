// Shared lookups and labels over the generated data files (POKOPIA_DB, POKOPIA_HABITATS, POKOPIA_RECIPES).
(function () {
  var db = window.POKOPIA_DB || { pokemon: [], meta: {} };
  var hdb = window.POKOPIA_HABITATS || { habitats: [] };
  var rdb = window.POKOPIA_RECIPES || { recipes: [], items: [] };
  var RARITY = { 1: "common", 2: "rare", 3: "very rare" };
  var ALL_AREAS = ["Withered Wastelands", "Bleak Beach", "Rocky Ridges", "Sparkling Skylands", "Palette Town", "Cloud Island"];

  var pokemonById = {};
  var habitatBySlug = {};
  var pokemonByHabitat = {}; // habitat slug -> [{ pokemon, spawn }]

  db.pokemon.forEach(function (p) {
    pokemonById[p.id] = p;
    p.habitats.forEach(function (h) {
      (pokemonByHabitat[h.slug] = pokemonByHabitat[h.slug] || []).push({ pokemon: p, spawn: h });
    });
  });
  hdb.habitats.forEach(function (h) { habitatBySlug[h.slug] = h; });

  // Recipes and items, plus reverse lookups: which recipes / habitats use an item.
  var recipeBySlug = {};
  var itemBySlug = {};
  var recipesUsing = {};   // item slug -> [recipe]
  var habitatsNeeding = {}; // item slug -> [habitat]
  rdb.items.forEach(function (i) { itemBySlug[i.slug] = i; });
  rdb.recipes.forEach(function (r) {
    if (!recipeBySlug[r.slug]) recipeBySlug[r.slug] = r;
    r.requirements.forEach(function (q) {
      (recipesUsing[q.itemSlug] = recipesUsing[q.itemSlug] || []).push(r);
    });
  });
  hdb.habitats.forEach(function (h) {
    h.requirements.forEach(function (q) {
      if (q.itemSlug) (habitatsNeeding[q.itemSlug] = habitatsNeeding[q.itemSlug] || []).push(h);
    });
  });

  // "morning/day only" or "" when it can appear at any time of day.
  function when(h) {
    var parts = [];
    if (h.time && h.time.length && h.time.length < 4) parts.push(h.time.join("/"));
    if (h.weather && h.weather.length && h.weather.length < 3) parts.push(h.weather.join("/"));
    return parts.length ? parts.join(", ") + " only" : "";
  }

  function areaLabel(areas) {
    if (!areas || !areas.length) return "";
    if (areas.indexOf("any") !== -1) return "All areas";
    var all = ALL_AREAS.every(function (a) { return areas.indexOf(a) !== -1; });
    return all ? "All areas" : areas.join(", ");
  }

  function dexLabel(p) {
    var n = String(p.dexNo);
    while (n.length < 3) n = "0" + n;
    return ({ main: "#", event: "E", basin: "B" }[p.dex] || "#") + n;
  }

  window.PokopiaData = {
    pokemon: db.pokemon, meta: db.meta, habitats: hdb.habitats,
    pokemonById: pokemonById, habitatBySlug: habitatBySlug, pokemonByHabitat: pokemonByHabitat,
    recipes: rdb.recipes, items: rdb.items, recipeBySlug: recipeBySlug, itemBySlug: itemBySlug,
    recipesUsing: recipesUsing, habitatsNeeding: habitatsNeeding,
    RARITY: RARITY, ALL_AREAS: ALL_AREAS, when: when, areaLabel: areaLabel, dexLabel: dexLabel
  };
})();

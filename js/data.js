// Shared lookups and labels over the generated data files (POKOPIA_DB, POKOPIA_HABITATS, POKOPIA_RECIPES,
// POKOPIA_FAVORITES, POKOPIA_COOKING). A page only needs to load the files it uses.
(function () {
  var db = window.POKOPIA_DB || { pokemon: [], meta: {} };
  var hdb = window.POKOPIA_HABITATS || { habitats: [] };
  var rdb = window.POKOPIA_RECIPES || { recipes: [], items: [] };
  var fdb = window.POKOPIA_FAVORITES || { favorites: [] };
  var cdb = window.POKOPIA_COOKING || { meals: [], foods: [], specialties: [], categories: [] };
  var RARITY = { 1: "common", 2: "rare", 3: "very rare" };
  var ALL_AREAS = ["Withered Wastelands", "Bleak Beach", "Rocky Ridges", "Sparkling Skylands", "Palette Town", "Cloud Island"];
  var TOWN_AREAS = ALL_AREAS.concat(["Bubbly Basin"]); // areas you can live in (town planner, "Area" field)

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

  // Favorites -> items (Phase 6): favoriteByName is keyed by lower-case name, as used in Pokémon `favorites`.
  var favoriteBySlug = {};
  var favoriteByName = {};
  fdb.favorites.forEach(function (f) { favoriteBySlug[f.slug] = f; favoriteByName[f.name.toLowerCase()] = f; });

  // Pictures come from images/ (a copy made by tools/fetch_images.py, so they work offline). If a file is
  // missing there, Serebii is tried; if that fails too the picture is hidden.
  var IMG_LOCAL = "images/";
  var IMG_REMOTE = "https://serebii.net/pokemonpokopia/";

  function picture(path, size) {
    if (!path) return null;
    var img = document.createElement("img");
    img.className = "pic";
    img.src = IMG_LOCAL + path;
    img.alt = "";
    img.width = size;
    img.height = size;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", function () {
      if (img.getAttribute("data-fallback")) { img.style.visibility = "hidden"; return; }
      img.setAttribute("data-fallback", "1");
      img.src = IMG_REMOTE + path;
    });
    return img;
  }

  // Cooking (meals), foods with their flavor, and what each specialty does.
  var mealBySlug = {};
  var foodBySlug = {};
  var specialtyByName = {}; // lower-case name -> { name, description, image }
  cdb.meals.forEach(function (m) { mealBySlug[m.slug] = m; });
  cdb.foods.forEach(function (f) { foodBySlug[f.slug] = f; });
  cdb.specialties.forEach(function (sp) { specialtyByName[sp.name.toLowerCase()] = sp; });

  function specialtyPic(name, size) {
    var sp = specialtyByName[String(name).toLowerCase()];
    return sp ? picture(sp.image, size) : null;
  }

  // Roommate match 0-100, the formula pokopiawiki.com uses: same ideal habitat 20%, same flavor 20%,
  // favorites overlap (shared / all different favorites of both) 60%.
  function matchScore(a, b) {
    var fa = a.favorites || [], fb = b.favorites || [];
    var union = {};
    fa.concat(fb).forEach(function (f) { union[f] = true; });
    var both = fa.filter(function (f) { return fb.indexOf(f) !== -1; }).length;
    var jaccard = Object.keys(union).length ? both / Object.keys(union).length : 0;
    var hab = a.idealHabitat && a.idealHabitat === b.idealHabitat ? 1 : 0;
    var flav = a.flavor && a.flavor === b.flavor ? 1 : 0;
    return Math.round((0.2 * hab + 0.2 * flav + 0.6 * jaccard) * 100);
  }

  function pokemonPic(p, size) { return p ? picture(p.image, size) : null; }

  function itemPic(slug, size) {
    var it = itemBySlug[slug] || recipeBySlug[slug];
    return it ? picture(it.image, size) : null;
  }

  // Panel / list title: picture (if any) then text.
  function setTitle(node, text, pic) {
    node.textContent = "";
    if (pic) node.appendChild(pic);
    node.appendChild(document.createTextNode(text));
  }

  window.PokopiaData = {
    pokemonPic: pokemonPic, itemPic: itemPic, setTitle: setTitle,
    favorites: fdb.favorites, favoriteBySlug: favoriteBySlug, favoriteByName: favoriteByName,
    pokemon: db.pokemon, meta: db.meta, habitats: hdb.habitats,
    pokemonById: pokemonById, habitatBySlug: habitatBySlug, pokemonByHabitat: pokemonByHabitat,
    recipes: rdb.recipes, items: rdb.items, recipeBySlug: recipeBySlug, itemBySlug: itemBySlug,
    recipesUsing: recipesUsing, habitatsNeeding: habitatsNeeding,
    meals: cdb.meals, foods: cdb.foods, specialties: cdb.specialties, cookCategories: cdb.categories,
    pic: picture, matchScore: matchScore, mealBySlug: mealBySlug, foodBySlug: foodBySlug, specialtyByName: specialtyByName, specialtyPic: specialtyPic,
    RARITY: RARITY, ALL_AREAS: ALL_AREAS, TOWN_AREAS: TOWN_AREAS, when: when, areaLabel: areaLabel, dexLabel: dexLabel
  };
})();

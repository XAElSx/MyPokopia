// Crafting list: what each item needs, where to get the materials, and what uses it.
// Cooking mode: the meals from Serebii's cooking page, with flavor, helper specialty and who loves the flavor.
(function () {
  var D = window.PokopiaData;
  var progress = PokopiaStorage.load();
  var prefs = PokopiaStorage.pref("recipes");
  var category = prefs.category || "all";
  var habitatOnly = !!prefs.habitatOnly;
  var listOnly = !!prefs.listOnly;
  var query = prefs.query || "";
  var mode = prefs.mode || "craft";
  var cookType = prefs.cookType || "all";
  var cookFlavor = prefs.cookFlavor || "all";
  var CRAFT_SECTIONS = ["sec-category", "sec-obtain", "sec-reqs", "sec-where", "sec-used"];
  var openSlug = null;

  var listEl = document.getElementById("list");
  var counterEl = document.getElementById("counter");
  var panel = document.getElementById("panel");
  var backdrop = document.getElementById("backdrop");

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function link(text, href) {
    var a = el("a", null, text);
    a.href = href;
    return a;
  }

  function savePrefs() {
    PokopiaStorage.pref("recipes", Object.assign(PokopiaStorage.pref("recipes"), {
      category: category, habitatOnly: habitatOnly, listOnly: listOnly, query: query,
      mode: mode, cookType: cookType, cookFlavor: cookFlavor
    }));
  }

  function persist() {
    if (!PokopiaStorage.save(progress)) alert("Could not save progress. Browser storage may be blocked or full.");
  }

  // Source problems found while building the data (bad material names, nothing parsed): shown, not guessed.
  function problems(r) {
    // "Listed twice" only means a duplicate row on Serebii; the materials are fine.
    var out = (r.verify || []).filter(function (v) { return v.indexOf("Listed twice") !== 0; });
    if (!r.requirements.length && !out.length) out.push("No materials listed");
    r.requirements.forEach(function (m) {
      if (!D.itemBySlug[m.itemSlug] && !D.recipeBySlug[m.itemSlug]) {
        var msg = "Unknown material: " + m.item;
        if (out.indexOf(msg) === -1) out.push(msg);
      }
    });
    return out;
  }

  function itemHref(slug) { return "recipes.html#" + encodeURIComponent(slug); }

  (function fillCategories() {
    var sel = document.getElementById("category");
    var cats = {};
    D.recipes.forEach(function (r) { cats[r.category] = true; });
    ["all"].concat(Object.keys(cats).sort()).forEach(function (c) {
      var opt = el("option", null, c === "all" ? "All categories" : c);
      opt.value = c;
      sel.appendChild(opt);
    });
  })();

  function matches(r) {
    if (category !== "all" && r.category !== category) return false;
    if (habitatOnly && !D.habitatsNeeding[r.slug]) return false;
    if (listOnly && !PokopiaShop.inList(progress, "recipe", r.slug)) return false;
    var q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.name + " " + r.requirements.map(function (m) { return m.item; }).join(" ")).toLowerCase().indexOf(q) !== -1;
  }

  function movedIn(id) { return !!(progress.entries[id] && progress.entries[id].movedIn); }

  // ---- cooking ----
  (function fillCooking() {
    var t = document.getElementById("cook-type");
    [["all", "All meals"]].concat(D.cookCategories.map(function (c) { return [c.name, c.name + " · " + c.move]; })).forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      t.appendChild(opt);
    });
    var f = document.getElementById("cook-flavor");
    [["all", "Any flavor"], ["none", "No flavor"]].concat(["Bitter", "Dry", "Sour", "Spicy", "Sweet"].map(function (x) { return [x, x]; })).forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      f.appendChild(opt);
    });
  })();

  function mealMatches(m) {
    if (cookType !== "all" && m.category !== cookType) return false;
    if (cookFlavor === "none" && m.flavor) return false;
    if (cookFlavor !== "all" && cookFlavor !== "none" && m.flavor !== cookFlavor) return false;
    var q = query.trim().toLowerCase();
    if (!q) return true;
    var words = [m.name, m.category, m.flavor, m.specialty, m.main && m.main.name].concat(m.secondary.map(function (s) { return s.name; }));
    return words.join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function ingredientsText(m) {
    return [m.main].concat(m.secondary).filter(Boolean).map(function (i) { return i.name; }).join(" + ");
  }

  function lovers(flavor) {
    return D.pokemon.filter(function (p) { return flavor && p.flavor === flavor; });
  }

  function refreshCooking() {
    var shown = D.meals.filter(mealMatches);
    counterEl.textContent = shown.length + " / " + D.meals.length + " meals";
    listEl.textContent = "";
    if (!shown.length) { listEl.appendChild(el("li", "empty", "No meals match.")); return; }
    shown.forEach(function (m) {
      var li = el("li", "card");
      var main = el("button", "card-main wide");
      main.type = "button";
      var pic = D.pic(m.image, 48);
      if (pic) { main.classList.add("has-pic"); main.appendChild(pic); }
      main.appendChild(el("span", "name", m.name));
      main.appendChild(el("span", "num", m.flavor || "No flavor"));
      var bits = [m.category + " · " + m.move, ingredientsText(m)];
      if (m.specialty) bits.push("helper: " + m.specialty);
      main.appendChild(el("span", "meta", bits.join(" · ")));
      main.addEventListener("click", function () { openMeal(m.slug); });
      li.appendChild(main);
      listEl.appendChild(li);
    });
  }

  function showSections(meal) {
    document.getElementById("meal").hidden = !meal;
    CRAFT_SECTIONS.forEach(function (id) { document.getElementById(id).hidden = meal; });
    document.getElementById("f-cart").hidden = true;
    document.getElementById("f-verify").hidden = true;
  }

  function openMeal(slug) {
    var m = D.mealBySlug[slug];
    if (!m) return;
    openSlug = "cook-" + slug;
    showSections(true);
    D.setTitle(document.getElementById("panel-title"), m.name, D.pic(m.image, 56));
    document.getElementById("m-desc").textContent = m.description;
    var cat = D.cookCategories.filter(function (c) { return c.name === m.category; })[0];
    document.getElementById("m-type").textContent = [m.category, m.move ? "powers up " + m.move : "",
      m.flavor ? m.flavor + " flavor" : "no flavor", m.pp ? m.pp + " PP" : ""].filter(Boolean).join(" · ") +
      (cat && cat.effects.length ? " (" + cat.effects.join("; ") + ")" : "");

    var ul = document.getElementById("m-ingredients");
    ul.textContent = "";
    [m.main].concat(m.secondary).filter(Boolean).forEach(function (i, n) {
      var li = el("li");
      var ipic = D.itemPic(i.slug, 24) || (D.mealBySlug[i.slug] && D.pic(D.mealBySlug[i.slug].image, 24));
      if (ipic) li.appendChild(ipic);
      if (D.itemBySlug[i.slug] || D.recipeBySlug[i.slug]) li.appendChild(link(i.name, itemHref(i.slug)));
      else if (D.mealBySlug[i.slug]) li.appendChild(link(i.name, "recipes.html#cook-" + encodeURIComponent(i.slug)));
      else li.appendChild(el("span", null, i.name));
      li.appendChild(el("span", "sub", n ? " · extra" : " · main"));
      ul.appendChild(li);
    });

    var helper = document.getElementById("m-helper");
    helper.textContent = "";
    document.getElementById("sec-m-helper").hidden = !m.specialty;
    if (m.specialty) {
      var hpic = D.specialtyPic(m.specialty, 24);
      if (hpic) helper.appendChild(hpic);
      helper.appendChild(el("b", null, m.specialty));
      var yours = D.pokemon.filter(function (p) { return movedIn(p.id) && p.specialties.indexOf(m.specialty) !== -1; });
      helper.appendChild(el("div", "sub", yours.length ? "You have: " + yours.map(function (p) { return p.name; }).join(", ")
        : "None of your registered Pokémon has it yet."));
    }

    var likers = document.getElementById("m-likers");
    likers.textContent = "";
    var all = lovers(m.flavor);
    document.getElementById("sec-m-likers").hidden = !m.flavor;
    if (m.flavor) {
      var mine = all.filter(function (p) { return movedIn(p.id); });
      likers.appendChild(el("div", null, mine.length ? "In your town: " + mine.map(function (p) { return p.name; }).join(", ") : "None of your registered Pokémon."));
      likers.appendChild(el("div", "sub", all.length + " Pokémon in total like " + m.flavor.toLowerCase() + " food."));
    }

    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  function setMode(next) {
    mode = next;
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
    var cook = mode === "cook";
    ["category", "habitat-only", "list-only"].forEach(function (id) { document.getElementById(id).hidden = cook; });
    ["cook-type", "cook-flavor"].forEach(function (id) { document.getElementById(id).hidden = !cook; });
    document.getElementById("search").placeholder = cook ? "Search meal, ingredient, flavor" : "Search recipe or material";
    savePrefs();
    refresh();
  }

  function refresh() {
    if (mode === "cook") { refreshCooking(); return; }
    var shown = D.recipes.filter(matches);
    counterEl.textContent = shown.length + " / " + D.recipes.length + " recipes";
    listEl.textContent = "";
    if (!shown.length) { listEl.appendChild(el("li", "empty", "No recipes match.")); return; }
    shown.forEach(function (r) {
      var li = el("li", "card");
      var main = el("button", "card-main wide");
      main.type = "button";
      var pic = D.itemPic(r.slug, 48);
      if (pic) { main.classList.add("has-pic"); main.appendChild(pic); }
      main.appendChild(el("span", "name", r.name));
      main.appendChild(el("span", "num", r.category));
      var issues = problems(r);
      if (issues.length) {
        var badge = el("span", "badge", "unverified");
        badge.title = issues.join("; ");
        main.querySelector(".name").appendChild(badge);
      }
      var needs = r.requirements.map(function (m) { return m.item + " ×" + m.amount; }).join(", ");
      main.appendChild(el("span", "meta", needs || "No materials listed"));
      main.addEventListener("click", function () { openPanel(r.slug); });
      li.appendChild(main);
      listEl.appendChild(li);
    });
  }

  function fillList(id, items) {
    var ul = document.getElementById(id);
    ul.textContent = "";
    items.forEach(function (n) { ul.appendChild(n); });
    ul.parentNode.hidden = !items.length;
  }

  function sourceText(item) {
    if (!item || !item.locations.length) return "";
    return item.locations.slice(0, 3).join("; ");
  }

  function openPanel(slug) {
    var recipe = D.recipeBySlug[slug];
    var item = D.itemBySlug[slug];
    if (!recipe && !item) return;
    openSlug = slug;
    showSections(false);
    D.setTitle(document.getElementById("panel-title"), (recipe || item).name, D.itemPic(slug, 56));
    var cat = recipe ? recipe.category : item.categories.join(", ");
    document.getElementById("f-category").textContent = cat;
    var issues = recipe ? problems(recipe) : [];
    var ver = document.getElementById("f-verify");
    ver.hidden = !issues.length;
    ver.textContent = issues.length ? "Unverified: " + issues.join("; ") + ". Check in the game." : "";
    document.getElementById("f-cart").hidden = !recipe;
    showCart();

    fillList("f-obtain", recipe ? recipe.obtain.map(function (o) { return el("li", null, o); }) : []);

    fillList("f-reqs", recipe ? recipe.requirements.map(function (m) {
      var li = el("li");
      var mpic = D.itemPic(m.itemSlug, 28);
      if (mpic) li.appendChild(mpic);
      li.appendChild(link(m.item, itemHref(m.itemSlug)));
      li.appendChild(el("span", null, " ×" + m.amount));
      var src = D.recipeBySlug[m.itemSlug] ? "craftable" : sourceText(D.itemBySlug[m.itemSlug]);
      if (src) li.appendChild(el("span", "sub", " · " + src));
      return li;
    }) : []);

    // Where to find an item: listed for materials and for any item that is not just a recipe output.
    fillList("f-where", item ? item.locations.map(function (l) { return el("li", null, l); }) : []);

    var used = [];
    (D.recipesUsing[slug] || []).forEach(function (r) {
      var li = el("li");
      var upic = D.itemPic(r.slug, 28);
      if (upic) li.appendChild(upic);
      li.appendChild(link(r.name, itemHref(r.slug)));
      li.appendChild(el("span", "sub", " · recipe"));
      used.push(li);
    });
    (D.habitatsNeeding[slug] || []).forEach(function (h) {
      var li = el("li");
      li.appendChild(link(h.name, "habitats.html#" + encodeURIComponent(h.slug)));
      li.appendChild(el("span", "sub", " · habitat"));
      used.push(li);
    });
    fillList("f-used", used);

    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  function closePanel() {
    openSlug = null;
    panel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("panel-open");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function showCart() {
    var on = openSlug && PokopiaShop.inList(progress, "recipe", openSlug);
    var b = document.getElementById("f-cart");
    b.classList.toggle("on", !!on);
    b.textContent = on ? "On the shopping list ✓" : "Add to shopping list";
  }
  document.getElementById("f-cart").addEventListener("click", function () {
    if (!openSlug || !D.recipeBySlug[openSlug]) return;
    PokopiaShop.toggle(progress, "recipe", openSlug);
    persist();
    showCart();
    if (listOnly) refresh();
  });
  document.addEventListener("pokopia-synced", function () { progress = PokopiaStorage.load(); refresh(); });

  document.getElementById("panel-close").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openSlug) closePanel(); });
  document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; savePrefs(); refresh(); });
  document.getElementById("category").addEventListener("change", function (e) { category = e.target.value; savePrefs(); refresh(); });
  document.getElementById("habitat-only").addEventListener("click", function (e) {
    habitatOnly = !habitatOnly;
    e.currentTarget.classList.toggle("active", habitatOnly);
    savePrefs();
    refresh();
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
  });
  document.getElementById("cook-type").addEventListener("change", function (e) { cookType = e.target.value; savePrefs(); refresh(); });
  document.getElementById("cook-flavor").addEventListener("change", function (e) { cookFlavor = e.target.value; savePrefs(); refresh(); });

  document.getElementById("list-only").addEventListener("click", function (e) {
    listOnly = !listOnly;
    e.currentTarget.classList.toggle("active", listOnly);
    savePrefs();
    refresh();
  });

  // recipes.html#slug opens a recipe, or just the item when it has no recipe.
  function fromHash() {
    var slug = decodeURIComponent(location.hash.slice(1));
    if (slug.indexOf("cook-") === 0) {
      if (mode !== "cook") setMode("cook");
      openMeal(slug.slice(5));
    } else if (slug) openPanel(slug);
  }
  window.addEventListener("hashchange", fromHash);

  // Put the saved view back.
  document.getElementById("search").value = query;
  document.getElementById("category").value = category;
  document.getElementById("habitat-only").classList.toggle("active", habitatOnly);
  document.getElementById("list-only").classList.toggle("active", listOnly);
  document.getElementById("cook-type").value = cookType;
  document.getElementById("cook-flavor").value = cookFlavor;

  setMode(mode);
  fromHash();
  PokopiaStorage.keepScroll("recipes");
})();

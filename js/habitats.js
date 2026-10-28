// Habitat Dex: search/filter habitats, show requirements and which Pokémon can appear, mark created.
(function () {
  var D = window.PokopiaData;
  var progress = PokopiaStorage.load();
  var prefs = PokopiaStorage.pref("habitats");
  var filter = prefs.filter || "all";
  var area = prefs.area || "all";
  var dex = prefs.dex || "all";
  var query = prefs.query || "";
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

  function savePrefs() {
    PokopiaStorage.pref("habitats", Object.assign(PokopiaStorage.pref("habitats"), { filter: filter, area: area, dex: dex, query: query }));
  }

  function isWished(slug) { return !!(progress.habitats[slug] && progress.habitats[slug].wish); }

  function setWish(slug, value) {
    if (!progress.habitats[slug]) progress.habitats[slug] = {};
    if (value) progress.habitats[slug].wish = true; else delete progress.habitats[slug].wish;
    persist();
    refresh();
    if (openSlug === slug) openPanel(slug);
  }

  function isBuilt(slug) { return !!(progress.habitats[slug] && progress.habitats[slug].built); }
  function movedIn(id) { return !!(progress.entries[id] && progress.entries[id].movedIn); }

  function persist() {
    if (!PokopiaStorage.save(progress)) alert("Could not save progress. Browser storage may be blocked or full.");
  }

  function setBuilt(slug, value) {
    if (!progress.habitats[slug]) progress.habitats[slug] = {};
    progress.habitats[slug].built = value;
    persist();
    refresh();
  }

  // Area dropdown: every area that appears in the data.
  (function fillAreas() {
    var sel = document.getElementById("area");
    var seen = D.ALL_AREAS.slice();
    D.habitats.forEach(function (h) {
      h.areas.forEach(function (a) { if (seen.indexOf(a) === -1) seen.push(a); });
    });
    [["all", "All areas"]].concat(seen.map(function (a) { return [a, a]; })).forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      sel.appendChild(opt);
    });
  })();

  function matches(h) {
    if (filter === "built" && !isBuilt(h.slug)) return false;
    if (filter === "todo" && isBuilt(h.slug)) return false;
    if (filter === "wish" && !isWished(h.slug)) return false;
    if (dex !== "all" && h.dex !== dex) return false;
    if (area !== "all" && h.areas.indexOf(area) === -1 && h.areas.indexOf("any") === -1) return false;
    var q = query.trim().toLowerCase();
    if (!q) return true;
    var text = [h.name, h.description, h.requirements.map(function (r) { return r.item; }).join(" "),
      h.pokemon.map(function (p) { return p.name; }).join(" ")].join(" ").toLowerCase();
    return text.indexOf(q) !== -1;
  }

  function reqText(h) {
    return h.requirements.map(function (r) { return r.item + (r.amount ? " ×" + r.amount : ""); }).join(", ");
  }

  function refresh() {
    var builtCount = D.habitats.filter(function (h) { return isBuilt(h.slug); }).length;
    counterEl.textContent = builtCount + " / " + D.habitats.length + " created";
    var shown = D.habitats.filter(matches);
    listEl.textContent = "";
    if (!shown.length) { listEl.appendChild(el("li", "empty", "No habitats match.")); return; }
    shown.forEach(function (h) {
      var li = el("li", "card" + (isBuilt(h.slug) ? " moved-in" : ""));
      li.id = "h-" + h.slug;
      var check = el("label", "check");
      var box = el("input");
      box.type = "checkbox";
      box.checked = isBuilt(h.slug);
      box.setAttribute("aria-label", "Created: " + h.name);
      box.addEventListener("change", function () { setBuilt(h.slug, box.checked); });
      check.appendChild(box);

      var main = el("button", "card-main");
      main.type = "button";
      main.appendChild(el("span", "num", "#" + h.no));
      main.appendChild(el("span", "name", h.name));
      var users = D.pokemonByHabitat[h.slug] || [];
      var inCount = users.filter(function (u) { return movedIn(u.pokemon.id); }).length;
      var meta = [reqText(h), users.length + " Pokémon" + (users.length ? " (" + inCount + " registered)" : "")]
        .filter(Boolean).join(" · ");
      main.appendChild(el("span", "meta", meta));
      main.addEventListener("click", function () { openPanel(h.slug); });
      var star = el("button", "star" + (isWished(h.slug) ? " on" : ""), isWished(h.slug) ? "★" : "☆");
      star.type = "button";
      star.setAttribute("aria-label", (isWished(h.slug) ? "Remove from wishlist: " : "Add to wishlist: ") + h.name);
      star.addEventListener("click", function () { setWish(h.slug, !isWished(h.slug)); });
      li.appendChild(check);
      li.appendChild(main);
      li.appendChild(star);
      listEl.appendChild(li);
    });
  }

  function openPanel(slug) {
    var h = D.habitatBySlug[slug];
    if (!h) return;
    openSlug = slug;
    document.getElementById("panel-title").textContent = "#" + h.no + " " + h.name;
    document.getElementById("f-built").checked = isBuilt(slug);
    var star = document.getElementById("f-star");
    star.textContent = isWished(slug) ? "★" : "☆";
    star.classList.toggle("on", isWished(slug));
    showCart();
    document.getElementById("f-flavor").textContent = h.flavor || h.description || "";
    document.getElementById("f-areas").textContent = D.areaLabel(h.areas) || "Unknown";

    var reqs = document.getElementById("f-reqs");
    reqs.textContent = "";
    if (!h.requirements.length) reqs.appendChild(el("li", null, "None listed"));
    h.requirements.forEach(function (r) {
      var li = el("li");
      var rpic = r.itemSlug && D.itemPic(r.itemSlug, 24);
      if (rpic) li.appendChild(rpic);
      // A requirement links to its recipe (or item page) in the crafting list.
      if (r.itemSlug && (D.recipeBySlug[r.itemSlug] || D.itemBySlug[r.itemSlug])) {
        var a = el("a", null, r.item);
        a.href = "recipes.html#" + encodeURIComponent(r.itemSlug);
        li.appendChild(a);
      } else {
        li.appendChild(el("span", null, r.item));
      }
      if (r.amount) li.appendChild(el("span", null, " ×" + r.amount));
      reqs.appendChild(li);
    });

    var conds = h.conditions || [];
    document.getElementById("f-cond").textContent = conds.join(", ");
    document.getElementById("sec-cond").hidden = !conds.length;

    var mons = document.getElementById("f-pokemon");
    mons.textContent = "";
    var users = (D.pokemonByHabitat[slug] || []).slice().sort(function (a, b) {
      return b.spawn.rarity - a.spawn.rarity || a.pokemon.name.localeCompare(b.pokemon.name);
    });
    if (!users.length) mons.appendChild(el("li", null, "None listed"));
    users.forEach(function (u) {
      var li = el("li");
      var upic = D.pokemonPic(u.pokemon, 32);
      if (upic) li.appendChild(upic);
      var a = el("a", null, D.dexLabel(u.pokemon) + " " + u.pokemon.name);
      a.href = "index.html#" + u.pokemon.id;
      li.appendChild(a);
      if (movedIn(u.pokemon.id)) li.appendChild(el("span", "tick", " ✓"));
      var extra = [D.RARITY[u.spawn.rarity], D.when(u.spawn)].filter(Boolean).join(", ");
      if (extra) li.appendChild(el("span", "sub", " · " + extra));
      mons.appendChild(li);
    });

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
    var on = openSlug && PokopiaShop.inList(progress, "habitat", openSlug);
    var b = document.getElementById("f-cart");
    b.classList.toggle("on", !!on);
    b.textContent = on ? "On the shopping list ✓" : "Add to shopping list";
  }
  document.getElementById("f-cart").addEventListener("click", function () {
    if (!openSlug) return;
    PokopiaShop.toggle(progress, "habitat", openSlug);
    persist();
    showCart();
  });
  document.getElementById("f-star").addEventListener("click", function () {
    if (openSlug) setWish(openSlug, !isWished(openSlug));
  });

  document.getElementById("f-built").addEventListener("change", function (e) {
    if (openSlug) setBuilt(openSlug, e.target.checked);
  });
  document.getElementById("panel-close").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openSlug) closePanel(); });
  document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; savePrefs(); refresh(); });
  document.getElementById("area").addEventListener("change", function (e) { area = e.target.value; savePrefs(); refresh(); });
  document.getElementById("dex").addEventListener("change", function (e) { dex = e.target.value; savePrefs(); refresh(); });

  var buttons = document.querySelectorAll("[data-filter]");
  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(buttons, function (b) { b.classList.toggle("active", b === btn); });
      savePrefs();
      refresh();
    });
  });

  document.addEventListener("pokopia-synced", function () {
    progress = PokopiaStorage.load();
    closePanel();
    refresh();
  });

  // habitats.html#slug opens that habitat.
  function fromHash() {
    var slug = decodeURIComponent(location.hash.slice(1));
    if (slug && D.habitatBySlug[slug]) openPanel(slug);
  }
  window.addEventListener("hashchange", fromHash);

  // Put the saved view back.
  document.getElementById("search").value = query;
  document.getElementById("area").value = area;
  document.getElementById("dex").value = dex;
  Array.prototype.forEach.call(buttons, function (b) { b.classList.toggle("active", b.getAttribute("data-filter") === filter); });

  refresh();
  fromHash();
  PokopiaStorage.keepScroll("habitats");
})();

// Pairings: best housemates per Pokémon, and a house builder (up to 4 Pokémon) with a score.
// Rule: housemates need the same ideal habitat; every shared favorite is one point.
(function () {
  var D = window.PokopiaData;
  var MAX = 4;
  var progress = PokopiaStorage.load();
  var mode = "matches";
  var movedOnly = false;
  var query = "";
  var openId = null;

  var listEl = document.getElementById("list");
  var counterEl = document.getElementById("counter");
  var panel = document.getElementById("panel");
  var backdrop = document.getElementById("backdrop");
  var housesEl = document.getElementById("houses");
  var fpanel = document.getElementById("fpanel");

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function movedIn(id) { return !!(progress.entries[id] && progress.entries[id].movedIn); }
  function persist() {
    if (!PokopiaStorage.save(progress)) alert("Could not save progress. Browser storage may be blocked or full.");
  }

  // ---- scoring ----
  function shared(a, b) {
    return a.favorites.filter(function (f) { return b.favorites.indexOf(f) !== -1; });
  }
  function sameHabitat(a, b) { return !!a.idealHabitat && a.idealHabitat === b.idealHabitat; }
  function pairScore(a, b) { return sameHabitat(a, b) ? shared(a, b).length : 0; }

  // members: Pokémon objects. Returns { score, pairs, mixed } where mixed = not everyone shares one ideal habitat.
  function houseScore(members) {
    var score = 0, pairs = [];
    for (var i = 0; i < members.length; i++) {
      for (var j = i + 1; j < members.length; j++) {
        var s = pairScore(members[i], members[j]);
        score += s;
        pairs.push({ a: members[i], b: members[j], score: s, shared: shared(members[i], members[j]), ok: sameHabitat(members[i], members[j]) });
      }
    }
    var habitats = {};
    members.forEach(function (m) { habitats[m.idealHabitat || "?"] = true; });
    return { score: score, pairs: pairs, mixed: Object.keys(habitats).length > 1 };
  }

  function candidates(p) {
    return D.pokemon.filter(function (o) {
      return o.id !== p.id && sameHabitat(p, o) && (!movedOnly || movedIn(o.id));
    }).map(function (o) { return { pokemon: o, shared: shared(p, o) }; })
      .filter(function (c) { return c.shared.length > 0; })
      .sort(function (a, b) { return b.shared.length - a.shared.length || a.pokemon.name.localeCompare(b.pokemon.name); });
  }

  // ---- matches view ----
  function refreshList() {
    var q = query.trim().toLowerCase();
    var shown = D.pokemon.filter(function (p) {
      if (movedOnly && !movedIn(p.id)) return false;
      return !q || (p.name + " " + (p.idealHabitat || "") + " " + p.favorites.join(" ")).toLowerCase().indexOf(q) !== -1;
    });
    counterEl.textContent = shown.length + " Pokémon";
    listEl.textContent = "";
    if (!shown.length) { listEl.appendChild(el("li", "empty", movedOnly ? "No moved-in Pokémon match." : "No Pokémon match.")); return; }
    shown.forEach(function (p) {
      var li = el("li", "card" + (movedIn(p.id) ? " moved-in" : ""));
      var main = el("button", "card-main wide");
      main.type = "button";
      main.appendChild(el("span", "name", p.name));
      main.appendChild(el("span", "num", D.dexLabel(p)));
      main.appendChild(el("span", "meta", [p.idealHabitat || "no ideal habitat", p.favorites.join(", ")].filter(Boolean).join(" · ")));
      main.addEventListener("click", function () { openPanel(p.id); });
      li.appendChild(main);
      listEl.appendChild(li);
    });
  }

  function openPanel(id) {
    var p = D.pokemonById[id];
    if (!p) return;
    openId = id;
    document.getElementById("panel-title").textContent = D.dexLabel(p) + " " + p.name;
    document.getElementById("f-ideal").textContent = p.idealHabitat || "Unknown";
    var favBox = document.getElementById("f-favs");
    favBox.textContent = "";
    if (!p.favorites.length) favBox.textContent = "None listed";
    p.favorites.forEach(function (f, i) {
      if (i) favBox.appendChild(document.createTextNode(", "));
      var fav = D.favoriteByName[f.toLowerCase()];
      if (fav) {
        var a = el("a", null, f);
        a.href = "#fav-" + fav.slug;
        favBox.appendChild(a);
      } else {
        favBox.appendChild(document.createTextNode(f));
      }
    });
    var ul = document.getElementById("f-matches");
    ul.textContent = "";
    var list = candidates(p);
    if (!list.length) ul.appendChild(el("li", null, p.idealHabitat ? "No one shares a favorite." : "No ideal habitat in the data."));
    list.slice(0, 15).forEach(function (c) {
      var li = el("li");
      var a = el("a", null, c.pokemon.name);
      a.href = "index.html#" + c.pokemon.id;
      li.appendChild(a);
      if (movedIn(c.pokemon.id)) li.appendChild(el("span", "tick", " ✓"));
      li.appendChild(el("span", "sub", " · " + c.shared.length + ": " + c.shared.join(", ")));
      ul.appendChild(li);
    });
    panel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  function closePanel() {
    openId = null;
    panel.hidden = true;
    fpanel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("panel-open");
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  // ---- house builder ----
  function newId() { return "house-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function addHouse(members) {
    var n = Object.keys(progress.houses).length + 1;
    var id = newId();
    progress.houses[id] = { name: "House " + n, members: members || [] };
    persist();
    return id;
  }

  function membersOf(house) {
    return house.members.map(function (id) { return D.pokemonById[id]; }).filter(Boolean);
  }

  function renderHouses() {
    housesEl.textContent = "";
    var ids = Object.keys(progress.houses);
    counterEl.textContent = ids.length + " house" + (ids.length === 1 ? "" : "s");
    if (!ids.length) housesEl.appendChild(el("p", "empty", "No houses yet. Add one to start."));
    ids.forEach(function (id) { housesEl.appendChild(houseCard(id)); });
  }

  function houseCard(id) {
    var house = progress.houses[id];
    var members = membersOf(house);
    var res = houseScore(members);
    var card = el("div", "house");
    card.setAttribute("data-house", id);

    var head = el("div", "house-head");
    var name = el("input", "house-name");
    name.type = "text";
    name.value = house.name;
    name.setAttribute("aria-label", "House name");
    name.addEventListener("change", function () { house.name = name.value; persist(); });
    var del = el("button", "link-btn", "Delete");
    del.type = "button";
    del.addEventListener("click", function () {
      if (!confirm("Delete " + (house.name || "this house") + "?")) return;
      delete progress.houses[id];
      persist();
      renderHouses();
    });
    head.appendChild(name);
    head.appendChild(del);
    card.appendChild(head);

    var chips = el("div", "chips");
    members.forEach(function (m) {
      var chip = el("span", "member" + (movedIn(m.id) ? " in" : ""));
      chip.appendChild(el("span", null, m.name + (m.idealHabitat ? " (" + m.idealHabitat + ")" : "")));
      var x = el("button", "x", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Remove " + m.name);
      x.addEventListener("click", function () {
        house.members = house.members.filter(function (mid) { return mid !== m.id; });
        persist();
        renderHouses();
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    if (!members.length) chips.appendChild(el("span", "sub", "Empty"));
    card.appendChild(chips);

    var score = el("div", "score");
    score.appendChild(el("b", null, "Score " + res.score));
    var note = members.length + " / " + MAX + " Pokémon";
    if (res.mixed && members.length > 1) note += " · mixed ideal habitats";
    score.appendChild(el("span", "sub", " · " + note));
    card.appendChild(score);
    var common = members.length > 1 ? members[0].favorites.filter(function (f) {
      return members.every(function (m) { return m.favorites.indexOf(f) !== -1; });
    }) : [];
    if (common.length && !res.mixed) {
      var build = el("div", "sub", "Everyone likes: ");
      common.forEach(function (f, i) {
        if (i) build.appendChild(document.createTextNode(", "));
        var fav = D.favoriteByName[f.toLowerCase()];
        if (fav) { var a = el("a", null, f); a.href = "#fav-" + fav.slug; build.appendChild(a); }
        else build.appendChild(document.createTextNode(f));
      });
      card.appendChild(build);
    }
    if (res.pairs.length) {
      var ul = el("ul", "habitats");
      res.pairs.forEach(function (p) {
        var t = p.a.name + " + " + p.b.name + ": ";
        t += p.ok ? (p.shared.length ? p.shared.join(", ") : "no shared favorites") : "different ideal habitat";
        ul.appendChild(el("li", p.ok && p.shared.length ? null : "weak", t));
      });
      card.appendChild(ul);
    }

    if (members.length < MAX) card.appendChild(adder(house));
    return card;
  }

  // Add control: type a name, or tap one of the best additions.
  function adder(house) {
    var wrap = el("div", "adder");
    var members = membersOf(house);
    var row = el("div", "sync-row");
    var input = el("input");
    input.type = "text";
    input.placeholder = "Add Pokémon (type a name)";
    var listId = "dl-" + Math.random().toString(36).slice(2, 7);
    input.setAttribute("list", listId);
    var dl = el("datalist");
    dl.id = listId;
    D.pokemon.forEach(function (p) {
      if (house.members.indexOf(p.id) !== -1) return;
      if (movedOnly && !movedIn(p.id)) return;
      var o = el("option");
      o.value = p.name + " " + D.dexLabel(p);
      dl.appendChild(o);
    });
    var btn = el("button", null, "Add");
    btn.type = "button";
    btn.addEventListener("click", function () {
      var v = input.value.trim().toLowerCase();
      var p = D.pokemon.filter(function (x) { return (x.name + " " + D.dexLabel(x)).toLowerCase() === v; })[0] ||
        D.pokemon.filter(function (x) { return x.name.toLowerCase() === v; })[0];
      if (!p) { input.setCustomValidity("No Pokémon with that name"); input.reportValidity(); input.setCustomValidity(""); return; }
      addMember(house, p.id);
    });
    row.appendChild(input);
    row.appendChild(btn);
    wrap.appendChild(row);
    wrap.appendChild(dl);

    if (members.length) {
      var suggestions = D.pokemon.filter(function (o) {
        return house.members.indexOf(o.id) === -1 && (!movedOnly || movedIn(o.id)) &&
          members.every(function (m) { return sameHabitat(m, o); });
      }).map(function (o) {
        var gain = members.reduce(function (n, m) { return n + shared(m, o).length; }, 0);
        return { pokemon: o, gain: gain };
      }).filter(function (s) { return s.gain > 0; })
        .sort(function (a, b) { return b.gain - a.gain || a.pokemon.name.localeCompare(b.pokemon.name); })
        .slice(0, 5);
      if (suggestions.length) {
        wrap.appendChild(el("div", "sub", "Best additions:"));
        var chips = el("div", "chips");
        suggestions.forEach(function (s) {
          var b = el("button", "chip small", s.pokemon.name + " +" + s.gain);
          b.type = "button";
          b.addEventListener("click", function () { addMember(house, s.pokemon.id); });
          chips.appendChild(b);
        });
        wrap.appendChild(chips);
      }
    }
    return wrap;
  }

  function addMember(house, id) {
    if (house.members.length >= MAX || house.members.indexOf(id) !== -1) return;
    house.members.push(id);
    persist();
    renderHouses();
  }

  // ---- blocks view: favorite -> items ----
  var openFav = null;

  function itemCategory(it) {
    var full = D.itemBySlug[it.slug];
    return (full && full.categories[0]) || it.category || "Other";
  }

  function renderFavorites() {
    var q = query.trim().toLowerCase();
    var shown = D.favorites.filter(function (f) { return !q || f.name.toLowerCase().indexOf(q) !== -1; });
    counterEl.textContent = shown.length + " favorites";
    var ul = document.getElementById("favlist");
    ul.textContent = "";
    if (!shown.length) ul.appendChild(el("li", "empty", "No favorites match."));
    shown.forEach(function (f) {
      var li = el("li", "card");
      var main = el("button", "card-main wide");
      main.type = "button";
      main.appendChild(el("span", "name", f.name));
      main.appendChild(el("span", "num", f.items.length + " items"));
      main.appendChild(el("span", "meta", f.pokemon.length + " Pokémon like it"));
      main.addEventListener("click", function () { openFavorite(f.slug); });
      li.appendChild(main);
      ul.appendChild(li);
    });
  }

  function fillFavoriteItems() {
    var f = D.favoriteBySlug[openFav];
    var cat = document.getElementById("fcat").value;
    var ul = document.getElementById("f-items");
    ul.textContent = "";
    var groups = {};
    f.items.forEach(function (it) {
      var c = itemCategory(it);
      if (cat !== "all" && c !== cat) return;
      (groups[c] = groups[c] || []).push(it);
    });
    var names = Object.keys(groups).sort(function (a, b) {
      return (b === "Blocks") - (a === "Blocks") || a.localeCompare(b);
    });
    if (!names.length) ul.appendChild(el("li", null, f.items.length ? "No items in this category." : "Serebii lists no items for this favorite."));
    names.forEach(function (c) {
      ul.appendChild(el("li", "grp", c + " (" + groups[c].length + ")"));
      groups[c].forEach(function (it) {
        var li = el("li");
        var a = el("a", null, it.name);
        a.href = "recipes.html#" + encodeURIComponent(it.slug);
        li.appendChild(a);
        if (D.recipeBySlug[it.slug]) li.appendChild(el("span", "sub", " · craftable"));
        ul.appendChild(li);
      });
    });
  }

  function openFavorite(slug) {
    var f = D.favoriteBySlug[slug];
    if (!f) return;
    openFav = slug;
    document.getElementById("fpanel-title").textContent = f.name;
    var counts = {};
    f.items.forEach(function (it) { var c = itemCategory(it); counts[c] = (counts[c] || 0) + 1; });
    var sel = document.getElementById("fcat");
    sel.textContent = "";
    [["all", "All (" + f.items.length + ")"]].concat(Object.keys(counts).sort().map(function (c) {
      return [c, c + " (" + counts[c] + ")"];
    })).forEach(function (o) { var opt = el("option", null, o[1]); opt.value = o[0]; sel.appendChild(opt); });
    sel.value = counts.Blocks ? "Blocks" : "all";
    fillFavoriteItems();

    var likers = document.getElementById("f-likers");
    var names = D.pokemon.filter(function (p) {
      return p.favorites.some(function (x) { return x.toLowerCase() === f.name.toLowerCase(); });
    });
    likers.textContent = names.length ? names.map(function (p) { return p.name; }).join(", ") : "None listed";

    panel.hidden = true;
    fpanel.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add("panel-open");
  }

  // ---- wiring ----
  function setMode(m) {
    mode = m;
    document.getElementById("matches-view").hidden = m !== "matches";
    document.getElementById("houses-view").hidden = m !== "houses";
    document.getElementById("blocks-view").hidden = m !== "blocks";
    document.getElementById("search").hidden = m === "houses";
    document.getElementById("search").placeholder = m === "blocks" ? "Search favorites" : "Search Pokémon";
    Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === m);
    });
    closePanel();
    render();
  }

  function render() {
    if (mode === "matches") refreshList();
    else if (mode === "blocks") renderFavorites();
    else renderHouses();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
  });
  document.getElementById("moved-only").addEventListener("click", function (e) {
    movedOnly = !movedOnly;
    e.currentTarget.classList.toggle("active", movedOnly);
    e.currentTarget.setAttribute("aria-pressed", String(movedOnly));
    if (openId) openPanel(openId);
    render();
  });
  document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; render(); });
  document.getElementById("new-house").addEventListener("click", function () { addHouse([]); renderHouses(); });
  document.getElementById("start-house").addEventListener("click", function () {
    if (openId) { addHouse([openId]); setMode("houses"); }
  });
  document.getElementById("panel-close").addEventListener("click", closePanel);
  document.getElementById("fpanel-close").addEventListener("click", closePanel);
  document.getElementById("fcat").addEventListener("change", fillFavoriteItems);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && (openId || !fpanel.hidden)) closePanel(); });
  document.addEventListener("pokopia-synced", function () { progress = PokopiaStorage.load(); closePanel(); render(); });

  // pairings.html#fav-<slug> opens that favorite in the Blocks view.
  function fromHash() {
    var m = /^#fav-(.+)$/.exec(decodeURIComponent(location.hash));
    if (m && D.favoriteBySlug[m[1]]) { setMode("blocks"); openFavorite(m[1]); }
  }
  window.addEventListener("hashchange", fromHash);

  render();
  fromHash();
})();

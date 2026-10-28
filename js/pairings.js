// Pairings: best housemates per Pokémon, and a house builder (up to 4 Pokémon) with a score.
// Rule: housemates need the same ideal habitat; every shared favorite is one point.
// Next to it, a 0-100 "match" (D.matchScore: habitat 20%, flavor 20%, favorites overlap 60%) and, for a house,
// the average match of every pair.
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
    if (!shown.length) { listEl.appendChild(el("li", "empty", movedOnly ? "No registered Pokémon match." : "No Pokémon match.")); return; }
    shown.forEach(function (p) {
      var li = el("li", "card" + (movedIn(p.id) ? " moved-in" : ""));
      var main = el("button", "card-main wide");
      main.type = "button";
      var pic = D.pokemonPic(p, 48);
      if (pic) { main.classList.add("has-pic"); main.appendChild(pic); }
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
    D.setTitle(document.getElementById("panel-title"), D.dexLabel(p) + " " + p.name, D.pokemonPic(p, 56));
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
      var cpic = D.pokemonPic(c.pokemon, 32);
      if (cpic) li.appendChild(cpic);
      var a = el("a", null, c.pokemon.name);
      a.href = "index.html#" + c.pokemon.id;
      li.appendChild(a);
      if (movedIn(c.pokemon.id)) li.appendChild(el("span", "tick", " ✓"));
      li.appendChild(el("span", "sub", " · " + D.matchScore(p, c.pokemon) + "% · " + c.shared.length + ": " + c.shared.join(", ")));
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

  function isPlan(id) { return !!(progress.houses[id] && progress.houses[id].planned); }
  function idsOf(planned) { return Object.keys(progress.houses).filter(function (id) { return isPlan(id) === planned; }); }

  function addHouse(members, planned) {
    var n = idsOf(!!planned).length + 1;
    var id = newId();
    progress.houses[id] = { name: (planned ? "Plan " : "House ") + n, members: members || [] };
    if (planned) progress.houses[id].planned = true;
    persist();
    return id;
  }

  // A Pokémon lives in one house: adding it to a house takes it out of the other houses of the same kind
  // (town houses and planned houses are kept apart).
  function takeFromOthers(id, keepId) {
    var planned = isPlan(keepId);
    idsOf(planned).forEach(function (hid) {
      if (hid === keepId) return;
      var h = progress.houses[hid];
      h.members = h.members.filter(function (m) { return m !== id; });
    });
  }

  // Which house (in town) a Pokémon is in now.
  function currentHouseOf(pid) {
    return idsOf(false).filter(function (hid) { return progress.houses[hid].members.indexOf(pid) !== -1; })[0] || null;
  }

  function membersOf(house) {
    return house.members.map(function (id) { return D.pokemonById[id]; }).filter(Boolean);
  }

  function renderHouses() {
    var town = idsOf(false);
    var plans = idsOf(true);
    counterEl.textContent = town.length + " house" + (town.length === 1 ? "" : "s") + (plans.length ? " · " + plans.length + " planned" : "");
    housesEl.textContent = "";
    if (!town.length) housesEl.appendChild(el("p", "empty", "No houses yet. Add the houses you have in town."));
    town.forEach(function (id) { housesEl.appendChild(houseCard(id)); });
    var plansEl = document.getElementById("plans");
    plansEl.textContent = "";
    if (!plans.length) plansEl.appendChild(el("p", "empty", "No plans yet. Start one, auto-plan from regions, or use \"Copy to plan\" on a house."));
    // Planned houses grouped by area (auto plans) with your own plans first.
    var groups = {};
    var order = [];
    plans.forEach(function (id) {
      var key = progress.houses[id].area || "";
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(id);
    });
    order.sort(function (a, b) {
      if (!a || !b) return a ? 1 : -1;
      var ia = D.TOWN_AREAS.indexOf(a), ib = D.TOWN_AREAS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    order.forEach(function (key) {
      if (!key) { groups[key].forEach(function (id) { plansEl.appendChild(houseCard(id)); }); return; }
      var box = el("details", "plan-group");
      box.open = !!openGroups[key];
      box.addEventListener("toggle", function () { openGroups[key] = box.open; });
      var mons = groups[key].reduce(function (n, id) { return n + progress.houses[id].members.length; }, 0);
      var sum = el("summary");
      sum.appendChild(el("b", null, key));
      sum.appendChild(el("span", "sub", " · " + groups[key].length + " houses · " + mons + " Pokémon"));
      box.appendChild(sum);
      var inner = el("div", "houses");
      groups[key].forEach(function (id) { inner.appendChild(houseCard(id)); });
      box.appendChild(inner);
      plansEl.appendChild(box);
    });
    renderMoves(plans);
  }

  // ---- auto plan: houses per "Should live in" area ----
  var openGroups = {};

  function regionOf(p) {
    var r = ((progress.entries[p.id] || {}).region || "").trim();
    if (!r || /^any/i.test(r)) return "";
    var hit = D.TOWN_AREAS.filter(function (a) { return a.toLowerCase() === r.toLowerCase(); })[0];
    return hit || r;
  }

  // Fill houses of up to MAX from Pokémon that share one ideal habitat: start from the pair with the most shared
  // favorites, then keep adding whoever shares the most with the house so far. Leftovers make smaller houses.
  function pack(list) {
    var left = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var out = [];
    while (left.length) {
      var house;
      if (left.length === 1) {
        house = [left.pop()];
      } else {
        var bi = 0, bj = 1, best = -1;
        for (var i = 0; i < left.length; i++) {
          for (var j = i + 1; j < left.length; j++) {
            var s = shared(left[i], left[j]).length;
            if (s > best) { best = s; bi = i; bj = j; }
          }
        }
        house = [left[bi], left[bj]];
        left.splice(bj, 1);
        left.splice(bi, 1);
        while (house.length < MAX && left.length) {
          var pick = 0, gain = -1;
          left.forEach(function (c, k) {
            var g = house.reduce(function (n, m) { return n + shared(m, c).length; }, 0);
            if (g > gain) { gain = g; pick = k; }
          });
          house.push(left.splice(pick, 1)[0]);
        }
      }
      out.push(house);
    }
    return out;
  }

  function autoPlan() {
    var byArea = {};
    var skipped = 0;
    D.pokemon.forEach(function (p) {
      var area = regionOf(p);
      if (!area) { skipped++; return; }
      (byArea[area] = byArea[area] || []).push(p);
    });
    Object.keys(progress.houses).forEach(function (id) { if (progress.houses[id].auto) delete progress.houses[id]; });
    var made = 0;
    Object.keys(byArea).forEach(function (area) {
      var byHabitat = {};
      byArea[area].forEach(function (p) { (byHabitat[p.idealHabitat || "No habitat"] = byHabitat[p.idealHabitat || "No habitat"] || []).push(p); });
      Object.keys(byHabitat).sort().forEach(function (hab) {
        pack(byHabitat[hab]).forEach(function (members, n) {
          progress.houses[newId()] = {
            name: area + " · " + hab + " " + (n + 1),
            members: members.map(function (m) { return m.id; }),
            planned: true, auto: true, area: area
          };
          made++;
        });
      });
    });
    persist();
    renderHouses();
    return { made: made, skipped: skipped };
  }

  // What you would have to change in town to get to the plan.
  function renderMoves(plans) {
    var box = document.getElementById("moves");
    box.textContent = "";
    var moves = [];
    plans.forEach(function (pid) {
      var plan = progress.houses[pid];
      plan.members.forEach(function (m) {
        var p = D.pokemonById[m];
        // Only Pokémon you have can be moved; the rest wait in the plan until they are registered.
        if (!p || !movedIn(m)) return;
        var now = currentHouseOf(m);
        var mates = plan.members.filter(function (x) { return x !== m; });
        var sameMates = now && mates.every(function (x) { return progress.houses[now].members.indexOf(x) !== -1; });
        if (now && sameMates) return; // already living together like this
        moves.push(p.name + ": " + (now ? progress.houses[now].name : "no house yet") + " → " + plan.name);
      });
    });
    box.hidden = !moves.length;
    if (!moves.length) return;
    var wrap = el("details");
    wrap.open = moves.length <= 12;
    var sum = el("summary");
    sum.appendChild(el("b", null, "Moves to make (" + moves.length + ")"));
    sum.appendChild(el("span", "sub", " · registered Pokémon not yet living like the plan"));
    wrap.appendChild(sum);
    var ul = el("ul", "habitats");
    moves.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    wrap.appendChild(ul);
    box.appendChild(wrap);
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
    var actions = el("div", "house-actions");
    var swap = el("button", "chip small", house.planned ? "Make current" : "Copy to plan");
    swap.type = "button";
    swap.addEventListener("click", function () {
      if (!house.planned) {
        addHouse(house.members.slice(), true);
        var copy = idsOf(true).pop();
        progress.houses[copy].name = (house.name || "House") + " (plan)";
        persist();
        renderHouses();
        return;
      }
      PokopiaUI.ask("Make \"" + (house.name || "this plan") + "\" a house in your town? Its Pokémon leave their other town houses.", "Make current").then(function (yes) {
        if (!yes) return;
        delete house.planned;
        house.members.forEach(function (m) { takeFromOthers(m, id); });
        persist();
        renderHouses();
      });
    });
    var del = el("button", "chip small danger", "Delete");
    del.type = "button";
    del.addEventListener("click", function () {
      PokopiaUI.ask("Delete " + (house.name || "this house") + "?", "Delete", true).then(function (yes) {
        if (!yes) return;
        delete progress.houses[id];
        persist();
        renderHouses();
      });
    });
    actions.appendChild(swap);
    actions.appendChild(del);
    head.appendChild(name);
    head.appendChild(actions);
    card.appendChild(head);

    var chips = el("div", "chips");
    members.forEach(function (m) {
      var chip = el("span", "member" + (movedIn(m.id) ? " in" : ""));
      var mpic = D.pokemonPic(m, 28);
      if (mpic) chip.appendChild(mpic);
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
    if (res.pairs.length) {
      var avg = Math.round(res.pairs.reduce(function (n, x) { return n + D.matchScore(x.a, x.b); }, 0) / res.pairs.length);
      note += " · match " + avg + "%";
    }
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
        var t = p.a.name + " + " + p.b.name + " (" + D.matchScore(p.a, p.b) + "%): ";
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
    input.setAttribute("list", sharedList().id);
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

  // Name suggestions for every "Add Pokémon" box (rebuilt when "Only registered" changes).
  var listFor = null;
  function sharedList() {
    var dl = document.getElementById("dl-pokemon");
    if (!dl) { dl = el("datalist"); dl.id = "dl-pokemon"; document.body.appendChild(dl); }
    if (listFor !== movedOnly) {
      listFor = movedOnly;
      dl.textContent = "";
      D.pokemon.forEach(function (p) {
        if (movedOnly && !movedIn(p.id)) return;
        var o = el("option");
        o.value = p.name + " " + D.dexLabel(p);
        dl.appendChild(o);
      });
    }
    return dl;
  }

  function addMember(house, id) {
    if (house.members.length >= MAX || house.members.indexOf(id) !== -1) return;
    var hid = Object.keys(progress.houses).filter(function (k) { return progress.houses[k] === house; })[0];
    if (hid) takeFromOthers(id, hid);
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
        var ipic = D.itemPic(it.slug, 28);
        if (ipic) li.appendChild(ipic);
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
  document.getElementById("new-plan").addEventListener("click", function () { addHouse([], true); renderHouses(); });
  document.getElementById("auto-plan").addEventListener("click", function () {
    var withArea = D.pokemon.filter(function (p) { return regionOf(p); }).length;
    if (!withArea) {
      PokopiaUI.ask("No Pokémon has a \"Should live in\" area yet. Set it on the Pokédex (or import it), then try again.", "OK");
      return;
    }
    var old = idsOf(true).filter(function (id) { return progress.houses[id].auto; }).length;
    var without = D.pokemon.length - withArea;
    PokopiaUI.ask("Plan houses for " + withArea + " Pokémon by their \"Should live in\" area?" +
      (without ? " " + without + " without an area are left out." : "") +
      (old ? " This replaces the " + old + " auto-planned houses; your own plans stay." : ""), "Auto-plan").then(function (yes) {
      if (!yes) return;
      autoPlan();
    });
  });
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

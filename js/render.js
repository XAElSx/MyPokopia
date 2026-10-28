// Builds the Pokémon list and the edit panel. No data loading or saving here.
(function () {
  var DEX_PREFIX = { main: "#", event: "E", basin: "B" };
  var RARITY = { 1: "common", 2: "rare", 3: "very rare" };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // "#001", "E003", "B050": event and basin dexes restart at 1, so the prefix keeps numbers unique.
  function label(p) {
    var n = String(p.dexNo);
    while (n.length < 3) n = "0" + n;
    return (DEX_PREFIX[p.dex] || "#") + n;
  }

  // Short spawn condition, only when it is not "any time, any weather".
  function when(h) {
    var parts = [];
    if (h.time && h.time.length && h.time.length < 4) parts.push(h.time.join("/"));
    if (h.weather && h.weather.length && h.weather.length < 3) parts.push(h.weather.join("/"));
    return parts.length ? parts.join(", ") + " only" : "";
  }

  // Combine game data with the player's saved progress for one Pokémon.
  function merge(pokemon, entry) {
    entry = entry || {};
    return {
      id: pokemon.id,
      dex: pokemon.dex,
      dexNo: pokemon.dexNo,
      image: pokemon.image,
      label: label(pokemon),
      name: pokemon.name,
      specialties: pokemon.specialties || [],
      idealHabitat: pokemon.idealHabitat || "",
      favorites: pokemon.favorites || [],
      flavor: pokemon.flavor || "",
      habitats: pokemon.habitats || [],
      obtain: pokemon.obtain || "",
      movedIn: !!entry.movedIn,
      wish: !!entry.wish,
      area: entry.area || "",
      region: entry.region || "",
      notes: entry.notes || ""
    };
  }

  function renderList(listEl, items, handlers) {
    listEl.textContent = "";
    if (!items.length) {
      listEl.appendChild(el("li", "empty", "No Pokémon match."));
      return;
    }
    items.forEach(function (p) {
      var li = el("li", "card" + (p.movedIn ? " moved-in" : "") + (handlers.selected && handlers.selected[p.id] ? " selected" : ""));

      var check = el("label", "check");
      var box = el("input");
      box.type = "checkbox";
      box.checked = p.movedIn;
      box.setAttribute("aria-label", "Registered: " + p.name);
      box.addEventListener("change", function () {
        handlers.onToggle(p.id, box.checked);
      });
      check.appendChild(box);

      var main = el("button", "card-main");
      main.type = "button";
      var pic = PokopiaData.pokemonPic(p, 48);
      if (pic) { main.classList.add("has-pic"); main.appendChild(pic); }
      main.appendChild(el("span", "num", p.label));
      main.appendChild(el("span", "name", p.name));
      // Line 2: specialty. Line 3: where it lives (your Area, else its first habitat), plus a small tag when it
      // should live somewhere else. Both lines stay one line high so the cards line up.
      main.appendChild(el("span", "meta", p.specialties.join(" / ") || "No specialty"));
      var whereEl = el("span", "where");
      var placeText = p.area || (p.habitats[0] && p.habitats[0].name) || "";
      if (misplaced(p)) {
        // Wrong area: the card only says where to move it; the panel shows both.
        var move = el("span", "move", "Move to " + p.region);
        move.title = "Lives in " + p.area + ", should live in " + p.region;
        whereEl.appendChild(move);
      } else if (placeText) {
        whereEl.appendChild(el("span", "place", placeText));
      }
      if (whereEl.childNodes.length) main.appendChild(whereEl);
      main.addEventListener("click", function () {
        handlers.onOpen(p.id);
      });

      var star = el("button", "star" + (p.wish ? " on" : ""), p.wish ? "★" : "☆");
      star.type = "button";
      star.setAttribute("aria-label", (p.wish ? "Remove from wishlist: " : "Add to wishlist: ") + p.name);
      star.addEventListener("click", function () { handlers.onWish(p.id, !p.wish); });

      li.appendChild(check);
      li.appendChild(main);
      li.appendChild(star);
      listEl.appendChild(li);
    });
  }

  // Fill the edit panel with one Pokémon's values.
  function fillPanel(p) {
    PokopiaData.setTitle(document.getElementById("panel-title"), p.label + " " + p.name, PokopiaData.pokemonPic(p, 56));
    document.getElementById("f-moved").checked = p.movedIn;
    var star = document.getElementById("f-star");
    star.textContent = p.wish ? "★" : "☆";
    star.classList.toggle("on", p.wish);
    // Each specialty with its picture and what it does (from the Serebii specialty page).
    var specEl = document.getElementById("f-specialty");
    specEl.textContent = "";
    if (!p.specialties.length) specEl.appendChild(el("li", null, "None"));
    p.specialties.forEach(function (name) {
      var li = el("li");
      var pic = PokopiaData.specialtyPic(name, 24);
      if (pic) li.appendChild(pic);
      li.appendChild(el("b", null, name));
      var sp = PokopiaData.specialtyByName[name.toLowerCase()];
      if (sp && sp.description) li.appendChild(el("span", "sub", " · " + sp.description));
      specEl.appendChild(li);
    });
    var likes = [p.idealHabitat ? "Ideal habitat: " + p.idealHabitat : "", p.flavor ? p.flavor + " flavors" : "",
      p.favorites.join(", ")].filter(Boolean).join(" · ");
    document.getElementById("f-likes").textContent = likes || "Unknown";

    var habitatEl = document.getElementById("f-habitat");
    habitatEl.textContent = "";
    if (p.habitats.length) {
      p.habitats.forEach(function (h) {
        var li = el("li");
        var link = el("a", null, h.name);
        link.href = "habitats.html#" + encodeURIComponent(h.slug);
        li.appendChild(link);
        var extra = [RARITY[h.rarity], when(h)].filter(Boolean).join(", ");
        if (extra) li.appendChild(el("span", "sub", " · " + extra));
        habitatEl.appendChild(li);
      });
    } else {
      habitatEl.appendChild(el("li", null, p.obtain || "Unknown"));
    }

    document.getElementById("f-area").value = p.area;
    document.getElementById("f-region").value = p.region;
    showRegionWarning(p);
    document.getElementById("f-notes").value = p.notes;
  }

  // Lives somewhere other than where it should (like the Notion "Correct Region" check).
  function misplaced(p) {
    if (!p.area || !p.region || /^any/i.test(p.region)) return false;
    var area = p.area.toLowerCase();
    return !p.region.split(",").some(function (r) { return r.trim() && area.indexOf(r.trim().toLowerCase()) !== -1; });
  }

  function showRegionWarning(p) {
    var w = document.getElementById("f-region-warn");
    w.hidden = !misplaced(p);
    w.textContent = w.hidden ? "" : "Lives in " + p.area + ", not where it should be.";
  }

  window.PokopiaRender = {
    misplaced: misplaced, showRegionWarning: showRegionWarning,
    merge: merge, renderList: renderList, fillPanel: fillPanel };
})();

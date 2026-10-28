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
      label: label(pokemon),
      name: pokemon.name,
      specialties: pokemon.specialties || [],
      habitats: pokemon.habitats || [],
      obtain: pokemon.obtain || "",
      movedIn: !!entry.movedIn,
      area: entry.area || "",
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
      var li = el("li", "card" + (p.movedIn ? " moved-in" : ""));

      var check = el("label", "check");
      var box = el("input");
      box.type = "checkbox";
      box.checked = p.movedIn;
      box.setAttribute("aria-label", "Moved in: " + p.name);
      box.addEventListener("change", function () {
        handlers.onToggle(p.id, box.checked);
      });
      check.appendChild(box);

      var main = el("button", "card-main");
      main.type = "button";
      main.appendChild(el("span", "num", p.label));
      main.appendChild(el("span", "name", p.name));
      var where = p.area || (p.habitats[0] && p.habitats[0].name) || "";
      var meta = [p.specialties.join(" / "), where].filter(Boolean).join(" · ");
      main.appendChild(el("span", "meta", meta));
      main.addEventListener("click", function () {
        handlers.onOpen(p.id);
      });

      li.appendChild(check);
      li.appendChild(main);
      listEl.appendChild(li);
    });
  }

  // Fill the edit panel with one Pokémon's values.
  function fillPanel(p) {
    document.getElementById("panel-title").textContent = p.label + " " + p.name;
    document.getElementById("f-moved").checked = p.movedIn;
    document.getElementById("f-specialty").textContent = p.specialties.join(", ") || "None";

    var habitatEl = document.getElementById("f-habitat");
    habitatEl.textContent = "";
    if (p.habitats.length) {
      p.habitats.forEach(function (h) {
        var li = el("li", null, h.name);
        var extra = [RARITY[h.rarity], when(h)].filter(Boolean).join(", ");
        if (extra) li.appendChild(el("span", "sub", " · " + extra));
        habitatEl.appendChild(li);
      });
    } else {
      habitatEl.appendChild(el("li", null, p.obtain || "Unknown"));
    }

    document.getElementById("f-area").value = p.area;
    document.getElementById("f-notes").value = p.notes;
  }

  window.PokopiaRender = { merge: merge, renderList: renderList, fillPanel: fillPanel };
})();

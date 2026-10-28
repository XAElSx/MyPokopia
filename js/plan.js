// Plan page: shopping list (materials for chosen habitats and recipes), what to build next, wishlist.
(function () {
  var D = window.PokopiaData;
  var S = window.PokopiaShop;
  var progress = PokopiaStorage.load();
  var NEXT_SHOWN = 15;
  var showAllNext = false;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function persist() {
    if (!PokopiaStorage.save(progress)) alert("Could not save progress. Browser storage may be blocked or full.");
  }

  function link(text, href) {
    var a = el("a", null, text);
    a.href = href;
    return a;
  }

  // ---- shopping list ----
  function renderShop() {
    var shop = progress.shop;
    var sources = [];
    Object.keys(shop.habitats).forEach(function (slug) {
      if (D.habitatBySlug[slug]) sources.push({ kind: "habitat", slug: slug, name: D.habitatBySlug[slug].name });
    });
    Object.keys(shop.recipes).forEach(function (slug) {
      if (D.recipeBySlug[slug]) sources.push({ kind: "recipe", slug: slug, name: D.recipeBySlug[slug].name });
    });
    document.getElementById("shop").hidden = !sources.length;
    document.getElementById("shop-empty").hidden = !!sources.length;
    if (!sources.length) { document.getElementById("counter").textContent = ""; return; }

    var ul = document.getElementById("shop-sources");
    ul.textContent = "";
    sources.forEach(function (s) {
      var li = el("li", "member");
      li.appendChild(link(s.name, (s.kind === "habitat" ? "habitats.html#" : "recipes.html#") + encodeURIComponent(s.slug)));
      if (s.kind === "recipe") {
        var qty = el("input", "qty");
        qty.type = "number";
        qty.min = "1";
        qty.value = shop.recipes[s.slug] || 1;
        qty.setAttribute("aria-label", "How many " + s.name);
        qty.addEventListener("change", function () {
          shop.recipes[s.slug] = Math.max(1, parseInt(qty.value, 10) || 1);
          persist();
          renderShop();
        });
        li.appendChild(qty);
      }
      var x = el("button", "x", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Remove " + s.name);
      x.addEventListener("click", function () {
        S.toggle(progress, s.kind, s.slug);
        persist();
        renderAll();
      });
      li.appendChild(x);
      ul.appendChild(li);
    });

    var raw = document.getElementById("raw").checked;
    var rows = S.totals(progress, raw);
    // Still-missing items first, then finished ones; alphabetical inside each group.
    rows.sort(function (a, b) {
      return (a.missing === 0) - (b.missing === 0) || a.name.localeCompare(b.name);
    });
    var list = document.getElementById("shop-rows");
    list.textContent = "";
    var open = rows.filter(function (r) { return r.missing > 0; }).length;
    document.getElementById("counter").textContent = open ? open + " to gather" : "all gathered";
    rows.forEach(function (r) {
      var li = el("li", "card shop-row" + (r.missing === 0 ? " moved-in" : ""));
      var body = el("div", "shop-body");
      var pic = D.itemPic(r.slug, 36);
      var head = el("div", "shop-head");
      if (pic) head.appendChild(pic);
      head.appendChild(link(r.name, "recipes.html#" + encodeURIComponent(r.slug)));
      head.appendChild(el("span", "sub", " × " + r.gross + (r.missing !== r.gross ? " · still need " + r.missing : "")));
      body.appendChild(head);
      var item = D.itemBySlug[r.slug];
      var where = r.craftable && !raw ? "craftable" : (item && item.locations.length ? item.locations.slice(0, 3).join("; ") : "");
      if (where && r.missing > 0) body.appendChild(el("div", "sub", where));
      li.appendChild(body);

      var have = el("label", "have");
      have.appendChild(el("span", "sub", "have"));
      var inp = el("input", "qty");
      inp.type = "number";
      inp.min = "0";
      inp.value = progress.shop.have[r.slug] || 0;
      inp.setAttribute("aria-label", "How many " + r.name + " you have");
      inp.addEventListener("change", function () {
        var v = Math.max(0, parseInt(inp.value, 10) || 0);
        if (v) progress.shop.have[r.slug] = v; else delete progress.shop.have[r.slug];
        persist();
        renderShop();
        renderNext();
      });
      have.appendChild(inp);
      li.appendChild(have);
      list.appendChild(li);
    });
  }

  // ---- build next ----
  function renderNext() {
    var list = document.getElementById("next");
    list.textContent = "";
    var all = S.suggestions(progress);
    if (!all.length) { list.appendChild(el("li", "empty", "Every habitat with Pokémon you still need is built. Nice.")); return; }
    all.slice(0, showAllNext ? all.length : NEXT_SHOWN).forEach(function (s) {
      var li = el("li", "card");
      var body = el("div", "shop-body");
      var head = el("div", "shop-head");
      head.appendChild(link(s.habitat.name, "habitats.html#" + encodeURIComponent(s.habitat.slug)));
      var bits = [s.fresh.length + " new Pokémon"];
      if (s.wished) bits.push(s.wished + " on your wishlist");
      if (s.exclusive) bits.push(s.exclusive + " with no built habitat yet");
      body.appendChild(head);
      body.appendChild(el("div", "sub strong", bits.join(" · ")));
      var names = s.fresh.slice(0, 6).map(function (u) { return u.pokemon.name; }).join(", ");
      body.appendChild(el("div", "sub", names + (s.fresh.length > 6 ? ", …" : "")));
      var reqs = s.habitat.requirements.map(function (q) { return q.item + (q.amount ? " ×" + q.amount : ""); }).join(", ");
      if (reqs) body.appendChild(el("div", "sub", "Needs: " + reqs));
      li.appendChild(body);

      var on = S.inList(progress, "habitat", s.habitat.slug);
      var b = el("button", "sync-btn", on ? "On list ✓" : "Add to list");
      b.type = "button";
      b.addEventListener("click", function () {
        S.toggle(progress, "habitat", s.habitat.slug);
        persist();
        renderAll();
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (all.length > NEXT_SHOWN) {
      var more = el("li", "empty");
      var btn = el("button", "link-btn", showAllNext ? "Show fewer" : "Show all " + all.length);
      btn.type = "button";
      btn.addEventListener("click", function () { showAllNext = !showAllNext; renderNext(); });
      more.appendChild(btn);
      list.appendChild(more);
    }
  }

  // ---- wishlist ----
  function renderWish() {
    var list = document.getElementById("wish");
    list.textContent = "";
    var mons = D.pokemon.filter(function (p) { return progress.entries[p.id] && progress.entries[p.id].wish; });
    var habs = D.habitats.filter(function (h) { return progress.habitats[h.slug] && progress.habitats[h.slug].wish; });
    if (!mons.length && !habs.length) {
      list.appendChild(el("li", "empty", "Star a Pokémon or habitat to keep it here."));
      return;
    }
    mons.forEach(function (p) {
      var done = progress.entries[p.id].movedIn;
      var li = el("li", "card" + (done ? " moved-in" : ""));
      var body = el("div", "shop-body");
      var head = el("div", "shop-head");
      var pic = D.pokemonPic(p, 36);
      if (pic) head.appendChild(pic);
      head.appendChild(link(D.dexLabel(p) + " " + p.name, "index.html#" + encodeURIComponent(p.id)));
      if (done) head.appendChild(el("span", "sub", " · moved in ✓"));
      body.appendChild(head);
      if (!done) {
        var where = p.habitats.map(function (h) {
          var built = progress.habitats[h.slug] && progress.habitats[h.slug].built;
          return h.name + (built ? " ✓" : "");
        }).slice(0, 4).join(", ");
        if (where) body.appendChild(el("div", "sub", where));
      }
      li.appendChild(body);
      list.appendChild(li);
    });
    habs.forEach(function (h) {
      var built = progress.habitats[h.slug].built;
      var li = el("li", "card" + (built ? " moved-in" : ""));
      var body = el("div", "shop-body");
      var head = el("div", "shop-head");
      head.appendChild(link(h.name, "habitats.html#" + encodeURIComponent(h.slug)));
      head.appendChild(el("span", "sub", built ? " · built ✓" : " · habitat"));
      body.appendChild(head);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function renderAll() { renderShop(); renderNext(); renderWish(); }

  document.getElementById("raw").addEventListener("change", renderShop);
  document.getElementById("shop-clear").addEventListener("click", function () {
    if (!confirm("Clear the whole shopping list? Amounts you marked as owned are kept.")) return;
    progress.shop.habitats = {};
    progress.shop.recipes = {};
    persist();
    renderAll();
  });
  document.addEventListener("pokopia-synced", function () { progress = PokopiaStorage.load(); renderAll(); });

  renderAll();
})();

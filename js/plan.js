// Plan page: today's checklist, shopping list (materials for chosen habitats and recipes), what to build next,
// specialty coverage per area (with quick area assignment) and the wishlist.
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

  // ---- today (daily checklist, resets every local calendar day) ----
  var DAILIES = (window.POKOPIA_DAILIES && window.POKOPIA_DAILIES.dailies) || [];
  var editingToday = false;

  function today() {
    var d = new Date();
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }

  // A new day clears the ticks (only saved once something is ticked, so just opening the page changes nothing).
  function daily() {
    var d = progress.dailies;
    if (d.day !== today()) { d.day = today(); d.done = {}; }
    return d;
  }

  function renderToday() {
    var d = daily();
    var tasks = DAILIES.map(function (t) { return { id: t.id, name: t.name, own: false }; })
      .concat(d.custom.map(function (t) { return { id: t.id, name: t.name, own: true }; }));
    var shown = tasks.filter(function (t) { return editingToday || !d.hidden[t.id]; });
    var ul = document.getElementById("today");
    ul.textContent = "";
    var done = shown.filter(function (t) { return d.done[t.id]; }).length;
    var visible = tasks.filter(function (t) { return !d.hidden[t.id]; });
    document.getElementById("today-count").textContent = visible.filter(function (t) { return d.done[t.id]; }).length + " / " + visible.length;
    shown.forEach(function (t) {
      var li = el("li", d.done[t.id] && !editingToday ? "done" : "");
      var label = el("label");
      var box = el("input");
      box.type = "checkbox";
      if (editingToday) {
        box.checked = !d.hidden[t.id];
        box.setAttribute("aria-label", "Show " + t.name);
        box.addEventListener("change", function () {
          if (box.checked) delete d.hidden[t.id]; else d.hidden[t.id] = true;
          persist();
          renderToday();
        });
      } else {
        box.checked = !!d.done[t.id];
        box.addEventListener("change", function () {
          if (box.checked) d.done[t.id] = true; else delete d.done[t.id];
          persist();
          renderToday();
        });
      }
      label.appendChild(box);
      label.appendChild(el("span", null, t.name));
      li.appendChild(label);
      if (t.own && editingToday) {
        var x = el("button", "close", "×");
        x.type = "button";
        x.setAttribute("aria-label", "Delete " + t.name);
        x.addEventListener("click", function () {
          d.custom = d.custom.filter(function (c) { return c.id !== t.id; });
          delete d.done[t.id];
          delete d.hidden[t.id];
          persist();
          renderToday();
        });
        li.appendChild(x);
      }
      ul.appendChild(li);
    });
    if (done === shown.length && shown.length && !editingToday) ul.appendChild(el("li", "sub", "All done for today."));
    document.getElementById("today-edit").textContent = editingToday ? "Done editing" : "Hide or show tasks";
  }

  document.getElementById("today-add").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("today-new");
    var name = input.value.trim();
    if (!name) return;
    daily().custom.push({ id: "own-" + Date.now().toString(36), name: name });
    input.value = "";
    persist();
    renderToday();
  });
  document.getElementById("today-edit").addEventListener("click", function () { editingToday = !editingToday; renderToday(); });

  // ---- specialty coverage per area ----
  var NO_AREA = "No area";

  function movedMons() {
    return D.pokemon.filter(function (p) { return progress.entries[p.id] && progress.entries[p.id].movedIn; });
  }

  // The Area field is free text; match it to a game area when it is one, ignoring case.
  function areaOf(p) {
    var a = ((progress.entries[p.id] || {}).area || "").trim();
    if (!a) return NO_AREA;
    var hit = D.TOWN_AREAS.filter(function (x) { return x.toLowerCase() === a.toLowerCase(); })[0];
    return hit || a;
  }

  function renderCoverage() {
    var mons = movedMons();
    var cols = D.TOWN_AREAS.slice();
    mons.forEach(function (p) { var a = areaOf(p); if (cols.indexOf(a) === -1 && a !== NO_AREA) cols.push(a); });
    cols.push(NO_AREA);
    var specs = D.specialties.length ? D.specialties.map(function (s) { return s.name; }) : [];
    mons.forEach(function (p) { p.specialties.forEach(function (s) { if (specs.indexOf(s) === -1 && s !== "???") specs.push(s); }); });
    // who[spec][area] = [Pokémon]
    var who = {};
    specs.forEach(function (s) { who[s] = {}; });
    mons.forEach(function (p) {
      var a = areaOf(p);
      p.specialties.forEach(function (s) { if (who[s]) (who[s][a] = who[s][a] || []).push(p); });
    });
    var table = document.getElementById("coverage");
    table.textContent = "";
    var head = el("tr");
    head.appendChild(el("th", null, "Specialty"));
    head.appendChild(el("th", null, "Total"));
    cols.forEach(function (c) { head.appendChild(el("th", null, c)); });
    table.appendChild(head);
    specs.forEach(function (s) {
      var total = cols.reduce(function (n, c) { return n + ((who[s][c] || []).length); }, 0);
      var tr = el("tr", total ? "" : "gap");
      var th = el("th");
      var pic = D.specialtyPic(s, 20);
      if (pic) th.appendChild(pic);
      th.appendChild(document.createTextNode(s));
      var sp = D.specialtyByName[s.toLowerCase()];
      if (sp) th.title = sp.description;
      tr.appendChild(th);
      tr.appendChild(el("td", "tot", String(total || "")));
      cols.forEach(function (c) {
        var list = who[s][c] || [];
        var td = el("td", list.length ? "has" : "");
        if (list.length) {
          var b = el("button", "cov-n", String(list.length));
          b.type = "button";
          b.addEventListener("click", function () {
            document.getElementById("cov-detail").textContent = s + " in " + c + ": " + list.map(function (p) { return p.name; }).join(", ");
          });
          td.appendChild(b);
        }
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    // Quick assignment: pick an area for everyone registered who has none yet.
    var ul = document.getElementById("unplaced");
    ul.textContent = "";
    var loose = mons.filter(function (p) { return areaOf(p) === NO_AREA; });
    document.getElementById("unplaced-count").textContent = loose.length ? "(" + loose.length + ")" : "";
    if (!loose.length) { ul.appendChild(el("li", "empty", mons.length ? "Everyone has an area." : "No one is registered yet.")); return; }
    loose.forEach(function (p) {
      var li = el("li", "card");
      var body = el("div", "shop-body");
      var head2 = el("div", "shop-head");
      var pic = D.pokemonPic(p, 32);
      if (pic) head2.appendChild(pic);
      head2.appendChild(link(p.name, "index.html#" + encodeURIComponent(p.id)));
      body.appendChild(head2);
      body.appendChild(el("div", "sub", p.specialties.join(" / ")));
      li.appendChild(body);
      var sel = el("select", "chip");
      sel.setAttribute("aria-label", "Area for " + p.name);
      [["", "Set area…"]].concat(D.TOWN_AREAS.map(function (a) { return [a, a]; })).forEach(function (o) {
        var opt = el("option", null, o[1]);
        opt.value = o[0];
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () {
        if (!sel.value) return;
        if (!progress.entries[p.id]) progress.entries[p.id] = {};
        progress.entries[p.id].area = sel.value;
        persist();
        renderCoverage();
      });
      li.appendChild(sel);
      ul.appendChild(li);
    });
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
    if (!all.length) { list.appendChild(el("li", "empty", "Every habitat with Pokémon you still need is created. Nice.")); return; }
    all.slice(0, showAllNext ? all.length : NEXT_SHOWN).forEach(function (s) {
      var li = el("li", "card");
      var body = el("div", "shop-body");
      var head = el("div", "shop-head");
      head.appendChild(link(s.habitat.name, "habitats.html#" + encodeURIComponent(s.habitat.slug)));
      var bits = [s.fresh.length + " new Pokémon"];
      if (s.wished) bits.push(s.wished + " on your wishlist");
      if (s.exclusive) bits.push(s.exclusive + " with no created habitat yet");
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
      if (done) head.appendChild(el("span", "sub", " · registered ✓"));
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
      head.appendChild(el("span", "sub", built ? " · created ✓" : " · habitat"));
      body.appendChild(head);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function renderAll() { renderToday(); renderShop(); renderNext(); renderCoverage(); renderWish(); }

  document.getElementById("raw").addEventListener("change", renderShop);
  document.getElementById("shop-clear").addEventListener("click", function () {
    PokopiaUI.ask("Clear the whole shopping list? Amounts you marked as owned are kept.", "Clear", true).then(function (yes) {
      if (!yes) return;
      progress.shop.habitats = {};
      progress.shop.recipes = {};
      persist();
      renderAll();
    });
  });
  document.addEventListener("pokopia-synced", function () { progress = PokopiaStorage.load(); renderAll(); });

  renderAll();
})();

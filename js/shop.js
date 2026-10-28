// Shopping list and "what to build next". Works on progress.shop; needs data.js and storage.js.
(function () {
  var D = window.PokopiaData;

  function movedIn(progress, id) { return !!(progress.entries[id] && progress.entries[id].movedIn); }
  function isBuilt(progress, slug) { return !!(progress.habitats[slug] && progress.habitats[slug].built); }

  function inList(progress, kind, slug) {
    return kind === "habitat" ? !!progress.shop.habitats[slug] : !!progress.shop.recipes[slug];
  }

  function toggle(progress, kind, slug) {
    var s = progress.shop;
    if (kind === "habitat") {
      if (s.habitats[slug]) delete s.habitats[slug]; else s.habitats[slug] = true;
    } else if (s.recipes[slug]) delete s.recipes[slug]; else s.recipes[slug] = 1;
    return inList(progress, kind, slug);
  }

  function count(progress) {
    return Object.keys(progress.shop.habitats).length + Object.keys(progress.shop.recipes).length;
  }

  // Everything the list needs. With raw = true, craftable parts are broken down into their materials.
  // Items you already have are used up first (starting with the finished item), so the breakdown only
  // asks for what is still missing. Result rows: { slug, name, gross, missing, craftable }.
  function totals(progress, raw) {
    var pool = {};
    Object.keys(progress.shop.have).forEach(function (k) { pool[k] = progress.shop.have[k] || 0; });
    var rows = {};
    function row(slug, name) {
      if (!rows[slug]) rows[slug] = { slug: slug, name: name || (D.itemBySlug[slug] || {}).name || slug, gross: 0, missing: 0, craftable: !!D.recipeBySlug[slug] };
      return rows[slug];
    }
    function need(slug, name, qty, depth) {
      var r = row(slug, name);
      r.gross += qty;
      var take = Math.min(pool[slug] || 0, qty);
      pool[slug] = (pool[slug] || 0) - take;
      var left = qty - take;
      if (left <= 0) return;
      var recipe = D.recipeBySlug[slug];
      if (raw && recipe && recipe.requirements.length && depth < 8) {
        r.expanded = true;
        recipe.requirements.forEach(function (m) { need(m.itemSlug, m.item, m.amount * left, depth + 1); });
      } else {
        r.missing += left;
      }
    }
    Object.keys(progress.shop.habitats).forEach(function (slug) {
      var h = D.habitatBySlug[slug];
      if (h) h.requirements.forEach(function (q) { need(q.itemSlug || q.item, q.item, q.amount || 1, 0); });
    });
    Object.keys(progress.shop.recipes).forEach(function (slug) {
      var amount = progress.shop.recipes[slug] || 1;
      var r = D.recipeBySlug[slug];
      if (!r) return;
      // The recipe itself is the thing wanted: its materials, not the finished item.
      r.requirements.forEach(function (m) { need(m.itemSlug, m.item, m.amount * amount, 0); });
    });
    return Object.keys(rows).map(function (k) { return rows[k]; })
      .filter(function (r) { return !(raw && r.expanded && r.missing === 0); });
  }

  // Habitats worth building next: ranked by how many Pokémon you still need that appear there.
  // Wishlisted Pokémon count double; items you already have make a habitat "closer".
  function suggestions(progress) {
    var out = [];
    D.habitats.forEach(function (h) {
      if (isBuilt(progress, h.slug)) return;
      var users = D.pokemonByHabitat[h.slug] || [];
      var fresh = users.filter(function (u) { return !movedIn(progress, u.pokemon.id); });
      if (!fresh.length) return;
      var score = 0;
      var exclusive = 0;
      fresh.forEach(function (u) {
        var wish = progress.entries[u.pokemon.id] && progress.entries[u.pokemon.id].wish;
        score += wish ? 2 : 1;
        // Only appears in habitats you have not built yet, so this one may be the way in.
        var others = u.pokemon.habitats.filter(function (x) { return x.slug !== h.slug && isBuilt(progress, x.slug); });
        if (!others.length) exclusive++;
      });
      var reqs = h.requirements;
      var have = progress.shop.have;
      var done = reqs.filter(function (q) { return (have[q.itemSlug] || 0) >= (q.amount || 1); }).length;
      out.push({
        habitat: h, fresh: fresh, score: score, exclusive: exclusive,
        reqsTotal: reqs.length, reqsDone: done,
        wished: fresh.filter(function (u) { return progress.entries[u.pokemon.id] && progress.entries[u.pokemon.id].wish; }).length
      });
    });
    out.sort(function (a, b) {
      return b.score - a.score || (b.reqsDone / (b.reqsTotal || 1)) - (a.reqsDone / (a.reqsTotal || 1)) ||
        a.reqsTotal - b.reqsTotal || a.habitat.name.localeCompare(b.habitat.name);
    });
    return out;
  }

  window.PokopiaShop = { toggle: toggle, inList: inList, count: count, totals: totals, suggestions: suggestions };
})();

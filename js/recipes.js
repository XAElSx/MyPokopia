// Crafting list: what each item needs, where to get the materials, and what uses it.
(function () {
  var D = window.PokopiaData;
  var category = "all";
  var habitatOnly = false;
  var query = "";
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
    var q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.name + " " + r.requirements.map(function (m) { return m.item; }).join(" ")).toLowerCase().indexOf(q) !== -1;
  }

  function refresh() {
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
    D.setTitle(document.getElementById("panel-title"), (recipe || item).name, D.itemPic(slug, 56));
    var cat = recipe ? recipe.category : item.categories.join(", ");
    document.getElementById("f-category").textContent = cat;

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

  document.getElementById("panel-close").addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openSlug) closePanel(); });
  document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; refresh(); });
  document.getElementById("category").addEventListener("change", function (e) { category = e.target.value; refresh(); });
  document.getElementById("habitat-only").addEventListener("click", function (e) {
    habitatOnly = !habitatOnly;
    e.currentTarget.classList.toggle("active", habitatOnly);
    refresh();
  });

  // recipes.html#slug opens a recipe, or just the item when it has no recipe.
  function fromHash() {
    var slug = decodeURIComponent(location.hash.slice(1));
    if (slug) openPanel(slug);
  }
  window.addEventListener("hashchange", fromHash);

  refresh();
  fromHash();
})();

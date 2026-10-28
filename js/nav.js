// Shared top navigation. Add <nav class="nav" id="nav"></nav> to a page; the current page is highlighted.
(function () {
  var PAGES = [
    ["index.html", "Collection"],
    ["habitats.html", "Habitats"],
    ["recipes.html", "Recipes"],
    ["pairings.html", "Pairings"],
    ["town.html", "Town"]
  ];
  var nav = document.getElementById("nav");
  if (!nav) return;
  var here = location.pathname.split("/").pop() || "index.html";
  PAGES.forEach(function (p) {
    var a = document.createElement("a");
    a.href = p[0];
    a.textContent = p[1];
    if (p[0] === here) a.className = "active";
    nav.appendChild(a);
  });
})();

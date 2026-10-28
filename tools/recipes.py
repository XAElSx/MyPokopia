"""Crafting recipes and item sources.

Usage: python tools/recipes.py <raw_dir> <out.json>        (build.py calls this with target "recipes")
Cache: <raw_dir>/recipes/crafting.html and items.html. Pages already there are skipped.

Sources: https://serebii.net/pokemonpokopia/crafting.shtml  (recipe tables: name, how the recipe is unlocked, materials)
         https://serebii.net/pokemonpokopia/items.shtml     (every item: description, tag, where to find it)
Output:  recipes[] = {slug, name, category, image, obtain[], requirements[{item,itemSlug,amount}], verify[]}
         items[]   = {slug, name, categories[], image, description, tag, locations[]}   (where to get materials)
"""
import json, os, re, sys, urllib.request
from datetime import date
from bs4 import BeautifulSoup

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())


def soup_of(path):
    s = BeautifulSoup(open(path, encoding="latin-1").read(), "html.parser")
    for o in s.find_all("select"):
        o.decompose()
    return s


def image_of(cell):
    img = cell.find("img")
    return img["src"].lstrip("/").replace("pokemonpokopia/", "", 1) if img and img.get("src") else None


def slug_of(a):
    return a["href"].split("/")[-1][:-6] if a and a.get("href") else None


def lines(cell):
    """Text lines of a cell, one per <br>-separated line (a link plus its trailing text stays together)."""
    cell = BeautifulSoup(str(cell), "html.parser")
    for br in cell.find_all("br"):
        br.replace_with("\n")
    return [re.sub(r"\s+", " ", t).strip() for t in cell.get_text().split("\n") if t.strip()]


def section(table):
    h = table.find_previous("h2")
    return re.sub(r"^List of\s+", "", h.get_text(strip=True)) if h else ""


def parse_recipes(path):
    out = []
    for t in soup_of(path).select("table.dextable"):
        cat = section(t)
        for tr in t.find_all("tr")[1:]:
            tds = tr.find_all("td", recursive=False)
            if len(tds) < 4:
                continue
            a = tds[1].find("a")
            reqs = []
            for cell in tds[3].find_all("td"):
                link = cell.find("a", href=re.compile("items/"))
                m = re.search(r"\*\s*(\d+)", cell.get_text(" "))
                if link and link.get_text(strip=True) and m:
                    reqs.append({"item": link.get_text(strip=True), "itemSlug": slug_of(link), "amount": int(m.group(1))})
            out.append({"slug": slug_of(a), "name": tds[1].get_text(strip=True), "category": cat, "image": image_of(tds[0]),
                        "obtain": lines(tds[2]), "requirements": reqs, "verify": []})
    return out


def parse_items(path):
    items = {}
    for t in soup_of(path).select("table.dextable"):
        cat = section(t)
        for tr in t.find_all("tr")[1:]:
            tds = tr.find_all("td", recursive=False)
            if len(tds) < 5:
                continue
            slug = slug_of(tds[1].find("a"))
            it = items.setdefault(slug, {"slug": slug, "name": tds[1].get_text(strip=True), "categories": [],
                                         "image": image_of(tds[0]),
                                         "description": " ".join(lines(tds[2])), "tag": ", ".join(lines(tds[3])),
                                         "locations": lines(tds[4])})
            if cat not in it["categories"]:
                it["categories"].append(cat)
    return list(items.values())


def main(raw, out):
    d = os.path.join(raw, "recipes")
    os.makedirs(d, exist_ok=True)
    fetch(BASE + "crafting.shtml", os.path.join(d, "crafting.html"))
    fetch(BASE + "items.shtml", os.path.join(d, "items.html"))
    recipes = parse_recipes(os.path.join(d, "crafting.html"))
    items = parse_items(os.path.join(d, "items.html"))
    known = {i["slug"] for i in items}
    seen = {}
    for r in recipes:
        if not r["requirements"]:
            r["verify"].append("No materials parsed")
        for q in r["requirements"]:
            if q["itemSlug"] not in known:
                r["verify"].append(f"Material {q['item']} ({q['itemSlug']}) is not in the items list")
        if r["slug"] in seen:
            r["verify"].append(f"Listed twice ({seen[r['slug']]} and {r['category']}); both kept")
        seen[r["slug"]] = r["category"]
    json.dump({"version": 1, "generated": date.today().isoformat(), "count": len(recipes),
               "meta": {"categories": sorted({r["category"] for r in recipes}),
                        "sources": [BASE + "crafting.shtml", BASE + "items.shtml"]},
               "recipes": recipes, "items": items},
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"recipes: {len(recipes)}, items: {len(items)}, flagged: {sum(bool(r['verify']) for r in recipes)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

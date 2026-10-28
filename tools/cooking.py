"""Cooking, flavors and specialties from Serebii.

Usage: python tools/cooking.py <raw_dir> <out.json>        (build.py calls this with target "cooking")
Cache: <raw_dir>/extra/{cooking,flavors,specialty}.html. Pages already there are skipped.

Sources: https://serebii.net/pokemonpokopia/cooking.shtml, flavors.shtml, specialty.shtml
Output:
  meals[]       = {slug, name, category, move, description, pp, main:{slug,name}, secondary:[{slug,name}],
                   specialty, flavor, image, verify[]}
  categories[]  = {name, move, effects[]}       (Salad -> Leafage, ...)
  foods[]       = {slug, name, flavor, description, image}   every food on the flavors page
  specialties[] = {slug, name, description, image}
The tables on these pages are not closed properly, so rows are read in document order.
"""
import json, os, re, sys, urllib.request
from datetime import date
from bs4 import BeautifulSoup

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}
PAGES = ["cooking", "flavors", "specialty"]
FLAVORS = ["No Flavor", "Bitter", "Dry", "Sour", "Spicy", "Sweet"]


def fetch(raw):
    os.makedirs(os.path.join(raw, "extra"), exist_ok=True)
    for p in PAGES:
        path = os.path.join(raw, "extra", p + ".html")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        req = urllib.request.Request(BASE + p + ".shtml", headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())


def soup_of(raw, name):
    s = BeautifulSoup(open(os.path.join(raw, "extra", name + ".html"), encoding="latin-1").read(), "html.parser")
    for o in s.find_all(["select", "script", "style"]):
        o.decompose()
    return s


def text(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).replace(" .", ".").strip()


def slug_of(href):
    # "items/leaf.shtml" -> "leaf"; matches the item slugs in the recipe data.
    return os.path.basename(href or "").replace(".shtml", "")


def picture(cell):
    img = cell.find("img")
    if not img:
        return ""
    src = img.get("src", "")
    return src.replace("/pokemonpokopia/", "", 1) if src.startswith("/pokemonpokopia/") else src


def cells(tr):
    return tr.find_all(["td", "th"], recursive=False)


def read_categories(s):
    out = []
    table = s.find("table", class_="dextable")
    for tr in table.find_all("tr"):
        c = cells(tr)
        if len(c) >= 3 and text(c[0]) not in ("Meal", ""):
            effects = [t.strip() for t in c[2].get_text("\n").split("\n") if t.strip()]
            out.append({"name": text(c[0]), "move": text(c[1]), "effects": effects})
    return out


def read_meals(s, moves):
    meals = []
    category = None
    table = s.find_all("table", class_="dextable")[1]
    for tr in table.find_all("tr"):
        c = cells(tr)
        if not c:
            continue
        if c[0].get("colspan") and "fooevo" in (c[0].get("class") or []):
            # Category header row; with the broken HTML it also swallows the rest of the page, so only the first word counts.
            first = c[0].get_text("|", strip=True).split("|")[0]
            if first in moves:
                category = first
            continue
        if len(c) < 8 or not c[1].find("a"):
            continue
        name = text(c[1])
        verify = []
        main = c[4].find("a")
        secondary = []
        for cell in (c[5], c[6]):
            for a in cell.find_all("a"):
                if text(a):
                    secondary.append({"slug": slug_of(a.get("href")), "name": text(a)})
        spec = text(c[7]) or None
        desc = text(c[2])
        pp = text(c[3])
        meals.append({
            "slug": slug_of(c[1].find("a").get("href")),
            "name": name,
            "category": category,
            "move": moves.get(category),
            "description": desc,
            "pp": int(pp) if pp.isdigit() else None,
            "main": {"slug": slug_of(main.get("href")), "name": text(main)} if main else None,
            "secondary": secondary,
            "specialty": spec,
            "flavor": None,
            "image": picture(c[0]),
            "verify": verify,
        })
    return meals


def read_foods(s):
    foods = []
    flavor = None
    table = s.find_all("table", class_="dextable")[-1]
    for tr in table.find_all("tr"):
        c = cells(tr)
        if not c:
            continue
        head = c[0].get_text("|", strip=True).split("|")[0] if c[0].get("colspan") else None
        if head in FLAVORS:
            flavor = head
            continue
        if len(c) < 3 or not text(c[1]) or not flavor:
            continue
        # Most rows have no link; Serebii slugs are the lower-case name without spaces ("crushed-berrysalad").
        link = c[1].find("a")
        foods.append({
            "slug": slug_of(link.get("href")) if link else re.sub(r"[^a-z0-9-]", "", text(c[1]).lower()),
            "name": text(c[1]),
            "flavor": None if flavor == "No Flavor" else flavor,
            "description": text(c[2]),
            "image": picture(c[0]),
        })
    return foods


def read_specialties(s):
    out = []
    table = s.find("table", class_="dextable")
    for tr in table.find_all("tr"):
        c = cells(tr)
        if len(c) < 3 or not c[1].find("a"):
            continue
        img = picture(c[0])
        out.append({"slug": slug_of(c[1].find("a").get("href")), "name": text(c[1]),
                    "description": text(c[2]), "image": img})
    return out


def main(raw, out_path):
    fetch(raw)
    cook = soup_of(raw, "cooking")
    categories = read_categories(cook)
    moves = {c["name"]: c["move"] for c in categories}
    meals = read_meals(cook, moves)
    foods = read_foods(soup_of(raw, "flavors"))
    specialties = read_specialties(soup_of(raw, "specialty"))

    by_slug = {f["slug"]: f for f in foods}
    by_name = {f["name"].lower(): f for f in foods}
    for m in meals:
        f = by_slug.get(m["slug"]) or by_name.get(m["name"].lower())
        if f:
            m["flavor"] = f["flavor"]
        else:
            m["verify"].append("Not on the flavors page, so its flavor is unknown")
        if not m["category"]:
            m["verify"].append("Meal type not found")

    data = {"count": len(meals), "meta": {"source": BASE + "cooking.shtml", "built": date.today().isoformat(),
                     "counts": {"meals": len(meals), "foods": len(foods), "specialties": len(specialties)}},
            "categories": categories, "meals": meals, "foods": foods, "specialties": specialties}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("meals", len(meals), "foods", len(foods), "specialties", len(specialties),
          "flagged", sum(1 for m in meals if m["verify"]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

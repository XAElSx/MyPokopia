"""Favorites -> items: which items belong to each favorite category (the things a Pokémon likes).

Usage: python tools/favorites.py <raw_dir> <out.json>        (build.py calls this with target "favorites")
Cache: <raw_dir>/favorites/index.html and <raw_dir>/favorites/<slug>.html. Pages already there are skipped.

Sources: https://serebii.net/pokemonpokopia/favorites.shtml and one page per favorite (item list + Pokémon that like it).
Output:  favorites[] = {slug, name, items:[{slug,name,category}], pokemon:[pokemon page slug], verify[]}
The Pokémon list on each page is cross-checked against data/pokopia-pokemon.json; differences go in verify.
"""
import json, os, re, sys, time, urllib.request
from datetime import date
from bs4 import BeautifulSoup

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())
    return True


def soup_of(path):
    s = BeautifulSoup(open(path, encoding="latin-1").read(), "html.parser")
    for o in s.find_all("select"):
        o.decompose()
    return s


def sentence(label):
    # Serebii mixes "Group Activities" / "Group activities"; the Pokémon data uses sentence case.
    return label[0].upper() + label[1:].lower()


def read_index(raw):
    s = soup_of(os.path.join(raw, "favorites", "index.html"))
    rows = []
    for a in s.find_all("a", href=re.compile(r"/favorites/[^/]+\.shtml$")):
        slug = a["href"].split("/")[-1][:-6]
        name = a.get_text(strip=True)
        if slug and name and slug not in [r["slug"] for r in rows]:
            rows.append({"slug": slug, "name": sentence(name)})
    return rows


def parse_page(path):
    s = soup_of(path)
    items, pokemon = [], []
    heads = s.find_all("h2")
    for h in heads:
        title = h.get_text(strip=True)
        table = h.find_next("table")
        if "Items" in title and "like" not in title:
            for tr in table.find_all("tr")[1:]:
                tds = tr.find_all("td", recursive=False)
                if len(tds) < 4:
                    continue
                a = tds[1].find("a")
                items.append({"slug": a["href"].split("/")[-1][:-6], "name": tds[1].get_text(strip=True),
                              "category": tds[3].get_text(" ", strip=True)})
        elif "that like" in title:
            for tr in table.find_all("tr")[1:]:
                a = tr.find("a", href=re.compile(r"/pokedex/[^/]+\.shtml$"))
                if a:
                    slug = a["href"].split("/")[-1][:-6]
                    if slug not in pokemon:
                        pokemon.append(slug)
    return items, pokemon


def main(raw, out):
    d = os.path.join(raw, "favorites")
    os.makedirs(d, exist_ok=True)
    fetch(BASE + "favorites.shtml", os.path.join(d, "index.html"))
    rows = read_index(raw)
    for i, r in enumerate(rows, 1):
        if fetch(f"{BASE}favorites/{r['slug']}.shtml", os.path.join(d, r["slug"] + ".html")):
            time.sleep(1)
    data_dir = os.path.join(os.path.dirname(out))
    pokemon_db = json.load(open(os.path.join(data_dir, "pokopia-pokemon.json"), encoding="utf-8"))["pokemon"]
    likes = {}
    for p in pokemon_db:
        for f in p["favorites"]:
            likes.setdefault(f.lower(), set()).add(p["source"].split("/")[-1][:-6])
    favorites = []
    for r in rows:
        items, mons = parse_page(os.path.join(d, r["slug"] + ".html"))
        verify = []
        page, ours = set(mons), likes.get(r["name"].lower(), set())
        if page != ours:
            verify.append("Pokémon list differs from pokopia-pokemon.json; only on favorite page: "
                          + (", ".join(sorted(page - ours)) or "-") + "; only in Pokémon data: " + (", ".join(sorted(ours - page)) or "-"))
        if not items:
            verify.append("No items listed")
        favorites.append({"slug": r["slug"], "name": r["name"], "items": items, "pokemon": mons, "verify": verify})
    json.dump({"version": 1, "generated": date.today().isoformat(), "count": len(favorites),
               "meta": {"sources": [BASE + "favorites.shtml"]}, "favorites": favorites},
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"favorites: {len(favorites)}, items listed: {sum(len(f['items']) for f in favorites)}, flagged: {sum(bool(f['verify']) for f in favorites)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

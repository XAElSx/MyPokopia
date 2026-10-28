"""Add a picture path to every Pokémon in data/pokopia-pokemon.json.

Usage: python tools/images.py <raw_dir> <db.json>        (build.py calls this after the Pokémon build)
Cache: <raw_dir>/lists/*.html (the three Serebii dex lists, downloaded by tools/download.py).

The list pages hold a small sprite next to every entry. The path is stored relative to
https://serebii.net/pokemonpokopia/ (e.g. "pokemon/small/001.png"); the site loads the image from there
instead of keeping a copy of every picture in the repo.
"""
import json, os, re, sys, urllib.request

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}
LISTS = {"main": "availablepokemon", "event": "eventpokedex", "basin": "basinpokedex"}
ROW = re.compile(
    r'<td class="cen">#(\d{3})</td>\s*<td class="cen"><a href="/pokemonpokopia/pokedex/[^"]+\.shtml">'
    r'<img src="/pokemonpokopia/([^"]+)"', re.S)


def main(raw, db_path):
    os.makedirs(os.path.join(raw, "lists"), exist_ok=True)
    images = {}
    for dex, name in LISTS.items():
        path = os.path.join(raw, "lists", name + ".html")
        if not (os.path.exists(path) and os.path.getsize(path) > 0):
            req = urllib.request.Request(f"{BASE}{name}.shtml", headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
                f.write(r.read())
        for no, src in ROW.findall(open(path, encoding="latin-1").read()):
            images[(dex, int(no))] = src
    db = json.load(open(db_path, encoding="utf-8"))
    missing = []
    for p in db["pokemon"]:
        src = images.get((p["dex"], p["dexNo"]))
        if src:
            p["image"] = src
        else:
            p.pop("image", None)
            missing.append(p["name"])
    json.dump(db, open(db_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"images: {len(db['pokemon']) - len(missing)}/{len(db['pokemon'])} Pokémon have a picture"
          + (f"; missing: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

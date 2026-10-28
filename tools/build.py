"""Rebuild game data.

Usage (from the repo folder):  python tools/build.py [target ...]
Targets: pokemon (default), habitats, recipes, favorites, cooking, dailies, images (add picture paths to the Pokémon data only)   e.g.  python tools/build.py habitats
Needs: pip install beautifulsoup4

pokemon : download pages -> list index -> parse -> compare with Pocket Tactics -> verify flags -> .js
habitats: download Serebii habitat pages -> parse -> .js
recipes : download Serebii recipe pages -> parse -> .js
cooking : download Serebii cooking, flavors and specialty pages -> parse -> .js
dailies : data/pokopia-dailies.json is hand-written; this only regenerates the .js
After any target, data/verify-list.txt is rewritten from the flags of every data file.

Downloaded pages are cached in ../pokopia-raw (next to the repo, so they never get committed).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_js  # noqa: E402

REPO = os.path.dirname(HERE)
RAW = os.path.join(os.path.dirname(REPO), "pokopia-raw")
DATA = os.path.join(REPO, "data")


def pokemon():
    import download, lists, parse, compare, finalize
    db = os.path.join(DATA, "pokopia-pokemon.json")
    download.main(RAW)
    lists.main(os.path.join(RAW, "lists"), os.path.join(RAW, "index.json"))
    parse.main(RAW, db)
    compare.main(RAW, db)
    finalize.main(db, os.path.join(RAW, "pt-diff.json"))
    images_()
    build_js.main(db, os.path.join(DATA, "pokopia-pokemon.js"), "POKOPIA_DB")


def images_():
    import images as im
    im.main(RAW, os.path.join(DATA, "pokopia-pokemon.json"))


def images():
    images_()
    build_js.main(os.path.join(DATA, "pokopia-pokemon.json"), os.path.join(DATA, "pokopia-pokemon.js"), "POKOPIA_DB")


def habitats():
    import habitats as h
    db = os.path.join(DATA, "pokopia-habitats.json")
    h.main(RAW, db)
    build_js.main(db, os.path.join(DATA, "pokopia-habitats.js"), "POKOPIA_HABITATS")


def recipes():
    import recipes as r
    db = os.path.join(DATA, "pokopia-recipes.json")
    r.main(RAW, db)
    build_js.main(db, os.path.join(DATA, "pokopia-recipes.js"), "POKOPIA_RECIPES")


def favorites():
    import favorites as f
    db = os.path.join(DATA, "pokopia-favorites.json")
    f.main(RAW, db)
    build_js.main(db, os.path.join(DATA, "pokopia-favorites.js"), "POKOPIA_FAVORITES")


def cooking():
    import cooking as c
    db = os.path.join(DATA, "pokopia-cooking.json")
    c.main(RAW, db)
    build_js.main(db, os.path.join(DATA, "pokopia-cooking.js"), "POKOPIA_COOKING")


def dailies():
    db = os.path.join(DATA, "pokopia-dailies.json")
    build_js.main(db, os.path.join(DATA, "pokopia-dailies.js"), "POKOPIA_DAILIES")


TARGETS = {"pokemon": pokemon, "images": images, "habitats": habitats, "recipes": recipes, "favorites": favorites,
           "cooking": cooking, "dailies": dailies}
# (file, list key, label shown before each flag)
VERIFY_SOURCES = [("pokopia-pokemon.json", "pokemon", ""), ("pokopia-habitats.json", "habitats", "[habitat] "),
                  ("pokopia-recipes.json", "recipes", "[recipe] "), ("pokopia-favorites.json", "favorites", "[favorite] "),
                  ("pokopia-cooking.json", "meals", "[meal] ")]


def write_verify_list():
    lines = []
    for fn, key, prefix in VERIFY_SOURCES:
        path = os.path.join(DATA, fn)
        if not os.path.exists(path):
            continue
        for e in json.load(open(path, encoding="utf-8"))[key]:
            for v in e.get("verify", []):
                lines.append(f"{prefix}{e['name']} | {v}\n")
    with open(os.path.join(DATA, "verify-list.txt"), "w", encoding="utf-8") as f:
        f.writelines(lines)


def main():
    for t in sys.argv[1:] or ["pokemon"]:
        TARGETS[t]()
    write_verify_list()
    print("done")


if __name__ == "__main__":
    main()

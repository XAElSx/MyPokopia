"""Download the source pages the data is built from.

Usage: python tools/download.py <raw_dir>

Pages already in <raw_dir> are skipped, so a re-run only fetches what is missing.
Delete <raw_dir> to force a full refresh after a game update.
Waits 1 second between Pokémon pages to be polite to Serebii.
"""
import json, os, re, sys, time, urllib.request

SEREBII = "https://serebii.net/pokemonpokopia/"
LIST_PAGES = ["availablepokemon", "eventpokedex", "basinpokedex", "legendary", "dive"]
POCKET_TACTICS = "https://www.pockettactics.com/pokemon-pokopia/habitats"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
        f.write(r.read())
    return True


def main(raw):
    for sub in ("lists", "pages", "pt"):
        os.makedirs(os.path.join(raw, sub), exist_ok=True)
    for name in LIST_PAGES:
        fetch(f"{SEREBII}{name}.shtml", os.path.join(raw, "lists", f"{name}.html"))
    fetch(POCKET_TACTICS, os.path.join(raw, "pt", "habitats.html"))

    # Collect every Pokémon page linked from the three dex lists.
    slugs = []
    for name in LIST_PAGES[:3]:
        html = open(os.path.join(raw, "lists", f"{name}.html"), encoding="latin-1").read()
        for s in re.findall(r'href="/pokemonpokopia/pokedex/([^"/]+)\.shtml"', html):
            if s not in slugs:
                slugs.append(s)
    new = 0
    for i, s in enumerate(slugs, 1):
        if fetch(f"{SEREBII}pokedex/{s}.shtml", os.path.join(raw, "pages", f"{s}.html")):
            new += 1
            time.sleep(1)
        if i % 50 == 0 or i == len(slugs):
            print(f"pages {i}/{len(slugs)}")
    print(f"downloaded {new} new pages into {raw}")


if __name__ == "__main__":
    main(sys.argv[1])

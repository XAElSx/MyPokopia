"""Extract ordered (dex, dexNo, slug, name) rows from the three Serebii list pages."""
import re, json, sys

LISTS = {"main": "availablepokemon.html", "event": "eventpokedex.html", "basin": "basinpokedex.html"}
ROW = re.compile(
    r'<td class="cen">#(\d{3})</td>\s*<td class="cen"><a href="/pokemonpokopia/pokedex/([^"]+)\.shtml">'
    r'.*?<u>([^<]+)</u>', re.S)

def main(list_dir, out):
    rows = []
    for dex, fn in LISTS.items():
        html = open(f"{list_dir}/{fn}", encoding="latin-1").read()
        found = ROW.findall(html)
        for no, slug, name in found:
            rows.append({"dex": dex, "dexNo": int(no), "slug": slug, "name": name.strip()})
        print(dex, len(found))
    json.dump(rows, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

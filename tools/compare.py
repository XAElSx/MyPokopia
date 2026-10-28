"""Compare rarities in the database with the Pocket Tactics habitat list.

Usage: python tools/compare.py <raw_dir> <db.json>
Writes <raw_dir>/pt-diff.json: [[pokemon, habitat, serebii_rarity, pt_rarity], ...]
"""
import json, re, sys
from bs4 import BeautifulSoup


def main(raw, db_path):
    soup = BeautifulSoup(open(f"{raw}/pt/habitats.html", encoding="utf-8").read(), "html.parser")
    pt = {}
    for tr in soup.select("table tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        habitat = tds[0].get_text(strip=True).lower()
        for line in tds[2].get_text("\n").split("\n"):
            m = re.match(r"\s*(.+?)\s*\((★+)", line)
            if m:
                pt[(m.group(1).lower(), habitat)] = len(m.group(2))
    db = json.load(open(db_path, encoding="utf-8"))["pokemon"]
    ours = {(p["name"].lower(), h["name"].lower()): h["rarity"] for p in db for h in p["habitats"]}
    both = [k for k in ours if k in pt]
    diff = [[k[0], k[1], ours[k], pt[k]] for k in both if ours[k] != pt[k]]
    json.dump(diff, open(f"{raw}/pt-diff.json", "w"))
    print(f"rarity: {len(both) - len(diff)}/{len(both)} pairs agree with Pocket Tactics")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

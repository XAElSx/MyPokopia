"""Add cross-source verify flags, compact areas, and a meta block.

Usage: python3 -I finalize.py <db.json> <pt_diff.json>
"""
import json, sys

ALL_AREAS = ["Withered Wastelands", "Bleak Beach", "Rocky Ridges", "Sparkling Skylands", "Palette Town", "Cloud Island"]
# Insider Gaming lists these as Sun/Cloudy only; Serebii says all weather.
WEATHER_DISPUTE = {"Charmander", "Charmeleon", "Charizard"}


def main(db_path, diff_path):
    db = json.load(open(db_path, encoding="utf-8"))
    diff = {(n, h): pt for n, h, ours, pt in json.load(open(diff_path, encoding="utf-8"))}
    for p in db["pokemon"]:
        for h in p["habitats"]:
            pt = diff.get((p["name"].lower(), h["name"].lower()))
            if pt is not None:
                p["verify"].append(f"Rarity at {h['name']}: Serebii {h['rarity']}, Pocket Tactics {pt}")
            areas = h.get("areas", [])
            if all(a in areas for a in ALL_AREAS):
                extra = [a for a in areas if a not in ALL_AREAS]
                h["areas"] = ["any"] + extra   # "any" = every base area
        if p["name"] in WEATHER_DISPUTE:
            p["verify"].append("Weather: Serebii says all, Insider Gaming says sun/cloud only")
    pk = db["pokemon"]
    db["meta"] = {
        "rarity": {"1": "common", "2": "rare", "3": "very rare"},
        "areas": {"any": "Withered Wastelands, Bleak Beach, Rocky Ridges, Sparkling Skylands, Palette Town, Cloud Island"},
        "idealHabitats": sorted({p["idealHabitat"] for p in pk if p["idealHabitat"]}),
        "flavors": sorted({p["flavor"] for p in pk if p["flavor"]}),
        "specialties": sorted({s for p in pk for s in p["specialties"]}),
        "favorites": sorted({f for p in pk for f in p["favorites"]}),
        "time": ["morning", "day", "evening", "night"],
        "weather": ["sun", "cloud", "rain"],
        "counts": {d: sum(p["dex"] == d for p in pk) for d in ("main", "event", "basin")},
        "sources": [
            "https://serebii.net/pokemonpokopia/availablepokemon.shtml",
            "https://www.pockettactics.com/pokemon-pokopia/habitats",
            "https://serebii.net/pokemonpokopia/legendary.shtml",
        ],
    }
    # meta first for readability
    out = {"version": db["version"], "generated": db["generated"], "count": db["count"],
           "meta": db["meta"], "pokemon": pk}
    json.dump(out, open(db_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("verify flags on", sum(bool(p["verify"]) for p in pk), "entries")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

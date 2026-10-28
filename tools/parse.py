"""Parse downloaded Serebii Pokopia pages into one JSON database.

Usage: python3 -I parse.py <raw_dir> <out.json>
"""
import json, re, sys
from datetime import date
from bs4 import BeautifulSoup

RARITY = {"common": 1, "rare": 2, "very rare": 3}


def text_lines(cell):
    """Return the non-empty text lines of a cell, split on <br>."""
    return [t.strip() for t in cell.get_text("\n").split("\n") if t.strip()]


def parse_stats(soup):
    h2 = soup.find("h2", string="Stats")
    table = h2.find_parent("table")
    rows = table.find_all("tr", recursive=False)
    heads = [td.get_text(strip=True) for td in rows[1].find_all("td", recursive=False)]
    cells = rows[2].find_all("td", recursive=False)
    data = dict(zip(heads, cells))
    out = {"specialties": [], "idealHabitat": None, "favorites": [], "flavor": None, "underwater": None}
    if "Specialty" in data:
        out["specialties"] = [u.get_text(strip=True) for u in data["Specialty"].find_all("u")]
    if "Ideal Habitat" in data:
        v = data["Ideal Habitat"].get_text(strip=True)
        out["idealHabitat"] = v or None
    if "Favorites" in data:
        for a in data["Favorites"].find_all("a"):
            label = a.get_text(strip=True)
            if "flavors.shtml" in a.get("href", ""):
                out["flavor"] = re.sub(r"\s*flavors?$", "", label, flags=re.I) or None
            elif label and label.lower() != "none":
                # Serebii mixes "Group Activities"/"Group activities" -> sentence case
                out["favorites"].append(label[0].upper() + label[1:].lower())
    if "Go Underwater?" in data:
        v = data["Go Underwater?"].get_text(strip=True).lower()
        out["underwater"] = v in ("yes", "underwater capable")
    return out, heads


# Serebii leaves these rarity cells blank or garbled; filled from Pocket Tactics habitat list.
RARITY_FIX = {
    ("Gulpin", "Tantalizing dining set"): 1,
    ("Goomy", "Rain Dance site"): 1,
    ("Grubbin", "Yellow tall grass"): 1,
    ("Poliwrath", "Sewer hole inspection"): 2,
    ("Corviknight", "Sewer hole inspection"): 2,
    ("Tyrogue", "Training waterfall"): 1,
}

# Pokémon without a habitat: how to get them (Serebii legendary page + story).
OBTAIN = {
    "Suicune": "Dream Island (Eevee Doll)",
    "Raikou": "Dream Island (Pikachu Doll)",
    "Entei": "Dream Island (Arcanine Doll)",
    "Mewtwo": "Dream Island (Dragonite Doll)",
    "Phione": "Dream Island (Starmie Doll)",
    "Articuno": "Palette Town kit: Freezing Chambers",
    "Zapdos": "Palette Town kit: Abandoned Power Plant",
    "Moltres": "Palette Town kit: Altar of the Flame",
    "Lugia": "Tidal Bell (5 Rare PokéMetal + 5 Silver Feather) when Lugia flies over",
    "Ho-Oh": "Clear Bell (5 Rare PokéMetal + 5 Rainbow Feather) when Ho-Oh flies over",
    "Volcanion": "Second party in Rocky Ridges after finishing it, then cannon + fireworks",
    "Mew": "Collect 27 Mysterious Slates, place them at the Withered Wastelands ruins",
    "Kyogre": "Story",
    "Ditto": "You (the player)",
    "Manaphy": "Special (Bubbly Basin) - check in game",
}


def parse_habitats(soup):
    h2 = soup.find("h2", string=re.compile("Habitats"))
    if not h2:
        return []
    table = h2.find_parent("table")
    habitats, group = [], []
    for tr in table.find_all("tr", recursive=False)[1:]:
        tds = tr.find_all("td", recursive=False)
        first = tds[0] if tds else None
        if first is None:
            continue
        txt = first.get_text(" ", strip=True)
        if "fooevo" in first.get("class", []) and first.find("a", href=re.compile("habitatdex")):
            group = [{"name": td.get_text(strip=True), "slug": td.a["href"].split("/")[-1][:-6]} for td in tds]
            habitats.extend(group)
        elif txt.startswith("Location"):
            for h, td in zip(group, tds):
                h["areas"] = [u.get_text(strip=True) for u in td.find_all("u")]
        elif txt.startswith("Rarity"):
            for h, td in zip(group, tds):
                r = " ".join(text_lines(td)).lower()
                r = re.sub(r"^rarity\s*:?\s*", "", r).strip()
                h["rarity"] = RARITY.get(r, r or None)
        elif td_has_time(first):
            for h, td in zip(group, tds):
                inner = td.find("table")
                cols = inner.find_all("tr")[1].find_all("td")
                h["time"] = [t.lower() for t in text_lines(cols[0])]
                h["weather"] = [w.lower() for w in text_lines(cols[1])] if len(cols) > 1 else []
    return habitats


def td_has_time(td):
    b = td.find("b")
    return b is not None and b.get_text(strip=True) == "Time"


def parse_types(soup):
    return [img["src"].split("/")[-1][:-4].capitalize()
            for img in soup.select('img[src*="/type/icon/"]')]


def main(raw, out):
    index = json.load(open(f"{raw}/index.json", encoding="utf-8"))
    db, issues, heads_seen = [], [], set()
    for row in index:
        html = open(f"{raw}/pages/{row['slug']}.html", encoding="latin-1").read()
        soup = BeautifulSoup(html, "html.parser")
        stats, heads = parse_stats(soup)
        heads_seen.add(tuple(heads))
        entry = {
            "id": f"{row['dex']}-{row['dexNo']:03d}-{re.sub(r'[^a-z0-9]+', '-', row['name'].lower()).strip('-')}",
            "dex": row["dex"],
            "dexNo": row["dexNo"],
            "name": row["name"],
            "types": parse_types(soup),
            **stats,
            "habitats": parse_habitats(soup),
            "obtain": OBTAIN.get(row["name"]),
            "verify": [],
            "source": f"https://serebii.net/pokemonpokopia/pokedex/{row['slug']}.shtml",
        }
        for h in entry["habitats"]:
            key = (row["name"], h["name"])
            if key in RARITY_FIX:
                h["rarity"] = RARITY_FIX[key]
                entry["verify"].append(f"Rarity at {h['name']} taken from Pocket Tactics (Serebii blank)")
            elif not isinstance(h.get("rarity"), int):
                entry["verify"].append(f"Rarity at {h['name']} unknown")
                h["rarity"] = None
        if not entry["habitats"] and not entry["obtain"]:
            entry["verify"].append("No habitat or obtain method found")
        db.append(entry)
    json.dump({"version": 2, "generated": date.today().isoformat(), "count": len(db), "pokemon": db},
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("entries:", len(db))
    print("stat header variants:", heads_seen)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

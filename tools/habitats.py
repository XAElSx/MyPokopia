"""Habitat database: download Serebii habitat pages and parse them.

Usage: python tools/habitats.py <raw_dir> <out.json>        (build.py calls this with target "habitats")
Cache: <raw_dir>/habitats/list.html and <raw_dir>/habitats/<slug>.html. Pages already there are skipped.

Source pages: https://serebii.net/pokemonpokopia/habitats.shtml (index, 3 dexes: main/basin/event)
              https://serebii.net/pokemonpokopia/habitatdex/<slug>.shtml (one per habitat)
Areas are the union of the Location lists of the Pokémon on the habitat page.
"""
import json, os, re, sys, time, urllib.request
from datetime import date
from html import unescape
from urllib.parse import quote
from bs4 import BeautifulSoup

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker data build)"}
ALL_AREAS = ["Withered Wastelands", "Bleak Beach", "Rocky Ridges", "Sparkling Skylands", "Palette Town", "Cloud Island"]


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    req = urllib.request.Request(quote(url, safe=":/?=&%"), headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
        f.write(r.read())
    return True


ROW = re.compile(
    r'<a name="(?P<anchor>[a-z]+)"></a>|'
    r'<td class="cen">#(?P<no>\d+)</td>\s*<td class="cen"><a href="habitatdex/(?P<slug>[^"]+)\.shtml">.*?<u>(?P<name>[^<]+)</u></a></td>\s*'
    r'<td class="fooinfo">(?P<desc>.*?)</td>', re.S)


def read_list(raw):
    html = open(os.path.join(raw, "habitats", "list.html"), encoding="latin-1").read()
    rows, dex = [], "main"
    for m in ROW.finditer(html):
        if m.group("anchor"):
            dex = m.group("anchor")
        else:
            rows.append({"dex": dex, "no": int(m.group("no")), "slug": m.group("slug"),
                         "name": unescape(m.group("name")).strip(), "description": unescape(m.group("desc")).strip()})
    return rows


def download(raw):
    os.makedirs(os.path.join(raw, "habitats"), exist_ok=True)
    fetch(BASE + "habitats.shtml", os.path.join(raw, "habitats", "list.html"))
    rows = read_list(raw)
    new = 0
    for i, r in enumerate(rows, 1):
        if fetch(f"{BASE}habitatdex/{r['slug']}.shtml", os.path.join(raw, "habitats", r["slug"] + ".html")):
            new += 1
            time.sleep(1)
        if i % 50 == 0 or i == len(rows):
            print(f"habitat pages {i}/{len(rows)}", flush=True)
    print(f"downloaded {new} new habitat pages")
    return rows


def section_table(soup, title):
    h2 = soup.find("h2", string=re.compile(title))
    return h2.find_parent("table") if h2 else None


def parse_page(path):
    soup = BeautifulSoup(open(path, encoding="latin-1").read(), "html.parser")
    for o in soup.find_all("select"):
        o.decompose()
    flavor = ""
    h2 = soup.find("h2", string=re.compile("Flavor Text"))
    if h2:
        cell = h2.find_parent("table").find_all("tr")[-1]
        flavor = re.sub(r"\s+", " ", cell.get_text(" ", strip=True))
        if flavor == "Flavor Text":
            flavor = ""
    reqs = []
    for t in soup.select("table.dextable"):
        heads = [td.get_text(strip=True) for td in t.find_all("tr")[0].find_all("td")]
        if heads == ["Image", "Name", "Quantity"]:
            for tr in t.find_all("tr")[1:]:
                tds = tr.find_all("td")
                a = tds[1].find("a")
                reqs.append({
                    "item": tds[1].get_text(strip=True),
                    "itemSlug": a["href"].split("/")[-1][:-6] if a and a.get("href") else None,
                    "amount": int(re.sub(r"\D", "", tds[2].get_text()) or 0) or None,
                })
    # Available Pokémon: the table whose header cells link to /pokedex/. Areas = union of its Location links.
    names, areas = [], []
    for t in soup.select("table.dextable"):
        first = t.find("tr")
        links = [a for a in first.find_all("a") if "/pokedex/" in a.get("href", "")]
        if not links:
            continue
        names = [{"slug": a["href"].split("/")[-1][:-6], "name": a.get_text(strip=True)} for a in links]
        for a in t.find_all("a", href=re.compile("/locations/")):
            name = a.get_text(strip=True)
            if name not in areas:
                areas.append(name)
        break
    return {"flavor": flavor, "requirements": reqs, "pokemonNames": names, "areas": areas}


def cross_check(habitats, pokemon_db, report_path):
    """Compare habitat slugs and Pokémon lists with data/pokopia-pokemon.json; write a report, add verify flags."""
    pokemon = json.load(open(pokemon_db, encoding="utf-8"))["pokemon"]
    ref = {}          # slug used by Pokémon -> {"name": habitat name, "mons": set of Pokémon page slugs}
    for p in pokemon:
        pslug = p["source"].split("/")[-1][:-6]
        for h in p["habitats"]:
            ref.setdefault(h["slug"], {"name": h["name"], "mons": set()})["mons"].add(pslug)
    have = {h["slug"]: h for h in habitats}
    missing = sorted(set(ref) - set(have))
    unused = sorted(set(have) - set(ref))
    name_diff = [(s, ref[s]["name"], have[s]["name"]) for s in sorted(set(ref) & set(have))
                 if ref[s]["name"].strip().lower() != have[s]["name"].strip().lower()]
    area_diff = []
    for s in sorted(set(ref) & set(have)):
        page = {m["slug"] for m in have[s]["pokemon"]}
        only_page, only_db = sorted(page - ref[s]["mons"]), sorted(ref[s]["mons"] - page)
        if only_page or only_db:
            msg = "Pokémon list differs from pokopia-pokemon.json"
            if only_page:
                msg += "; only on habitat page: " + ", ".join(only_page)
            if only_db:
                msg += "; only in Pokémon data: " + ", ".join(only_db)
            have[s]["verify"].append(msg)
            area_diff.append((s, only_page, only_db))
    lines = ["# Habitat slug report", "",
             f"Habitat slugs referenced by Pokémon in pokopia-pokemon.json: {len(ref)}",
             f"Habitats in pokopia-habitats.json (Serebii index): {len(have)}", "",
             f"## Referenced by a Pokémon but missing from the habitat database ({len(missing)})"]
    lines += [f"- `{s}` ({ref[s]['name']})" for s in missing] or ["- none"]
    lines += ["", f"## In the habitat database but never referenced by a Pokémon ({len(unused)})"]
    lines += [f"- `{s}` ({have[s]['name']})" for s in unused] or ["- none"]
    lines += ["", f"## Same slug, different name ({len(name_diff)})"]
    lines += [f"- `{s}`: Pokémon data says \"{a}\", habitat page says \"{b}\"" for s, a, b in name_diff] or ["- none"]
    lines += ["", f"## Habitats whose Pokémon list differs between the two sources ({len(area_diff)})"]
    lines += [f"- `{s}`: only on habitat page {a or '-'}; only in Pokémon data {b or '-'}" for s, a, b in area_diff] or ["- none"]
    open(report_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"slug check: {len(missing)} missing, {len(unused)} unreferenced, {len(name_diff)} renamed, {len(area_diff)} list differences")


def main(raw, out):
    rows = download(raw)
    habitats, issues = [], []
    for r in rows:
        p = parse_page(os.path.join(raw, "habitats", r["slug"] + ".html"))
        h = {"slug": r["slug"], "no": r["no"], "dex": r["dex"], "name": r["name"],
             "description": r["description"], "flavor": p["flavor"], "requirements": p["requirements"],
             "areas": p["areas"], "pokemon": p["pokemonNames"],
             "source": f"{BASE}habitatdex/{r['slug']}.shtml", "verify": []}
        if not h["requirements"]:
            h["verify"].append("No requirements found")
        habitats.append(h)
    pokemon_db = os.path.join(os.path.dirname(out), "pokopia-pokemon.json")
    if os.path.exists(pokemon_db):
        cross_check(habitats, pokemon_db, os.path.join(os.path.dirname(os.path.dirname(out)), "docs", "habitat-slug-report.md"))
    json.dump({"version": 1, "generated": date.today().isoformat(), "count": len(habitats), "habitats": habitats},
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("habitats:", len(habitats))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

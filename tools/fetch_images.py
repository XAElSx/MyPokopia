"""Download every picture used by the site into images/ so it works offline.

Usage: python tools/fetch_images.py
Reads the `image` paths from data/pokopia-{pokemon,recipes}.json (relative to
https://serebii.net/pokemonpokopia/) and saves each one to images/<same path>.
Skips files that already exist, so it can be stopped and run again. One request at a time, with a short pause.
"""
import json, os, sys, time, urllib.request

BASE = "https://serebii.net/pokemonpokopia/"
UA = {"User-Agent": "Mozilla/5.0 (personal Pokopia tracker, one-time picture copy)"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def paths():
    out = set()
    for name, keys in (("pokemon", ["pokemon"]), ("recipes", ["recipes", "items"])):
        data = json.load(open(os.path.join(ROOT, "data", f"pokopia-{name}.json"), encoding="utf-8"))
        for key in keys:
            for row in data[key]:
                if row.get("image"):
                    out.add(row["image"])
    return sorted(out)


def main():
    todo = paths()
    done = failed = 0
    for i, rel in enumerate(todo, 1):
        dest = os.path.join(ROOT, "images", *rel.split("/"))
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        try:
            req = urllib.request.Request(BASE + rel, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            with open(dest, "wb") as f:
                f.write(body)
            done += 1
        except Exception as e:  # keep going; the site falls back to Serebii for a missing file
            failed += 1
            print("failed", rel, e)
        if i % 100 == 0:
            print(i, "/", len(todo), flush=True)
        time.sleep(0.05)
    print("downloaded", done, "failed", failed, "total", len(todo))


if __name__ == "__main__":
    sys.exit(main())

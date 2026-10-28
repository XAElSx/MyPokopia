"""Rebuild all game data in one go.

Usage (from the repo folder):  python tools/build.py
Needs: pip install beautifulsoup4

Steps: download pages -> list index -> parse -> compare with Pocket Tactics
       -> add verify flags -> write data/pokopia-pokemon.js and data/verify-list.txt

Downloaded pages are cached in ../pokopia-raw (next to the repo, so they never get committed).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import download, lists, parse, compare, finalize, build_js  # noqa: E402

REPO = os.path.dirname(HERE)
RAW = os.path.join(os.path.dirname(REPO), "pokopia-raw")
DATA = os.path.join(REPO, "data")
DB = os.path.join(DATA, "pokopia-pokemon.json")


def main():
    download.main(RAW)
    lists.main(os.path.join(RAW, "lists"), os.path.join(RAW, "index.json"))
    parse.main(RAW, DB)
    compare.main(RAW, DB)
    finalize.main(DB, os.path.join(RAW, "pt-diff.json"))
    build_js.main(DB, os.path.join(DATA, "pokopia-pokemon.js"))
    with open(os.path.join(DATA, "verify-list.txt"), "w", encoding="utf-8") as f:
        for p in json.load(open(DB, encoding="utf-8"))["pokemon"]:
            for v in p["verify"]:
                f.write(f"{p['name']} | {v}\n")
    print("done")


if __name__ == "__main__":
    main()

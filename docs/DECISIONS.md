# Decisions

Format: what, why, alternative.

- **Batch instruction supersedes two CLAUDE.md working rules for this run.** "Stop and show me before the next feature" and "ask before new file structure" are overridden by the 7-phase instruction. The rules stay in CLAUDE.md for later work.
- **Deleted `data/pokemon.js`** (the 5 placeholder Pokémon with made-up specialties). Nothing loads it since the real database arrived; keeping it would conflict with "never invent game data".
- **Progress shape is designed once, in Phase 1.** One localStorage key `pokopia.collection` = `{version, updatedAt, entries, habitats, houses, town}`. `entries` by Pokémon id, `habitats` by slug, `houses` by house id, `town` by area. Why: sync sends one file and later phases only add keys. Alternative: one key per feature (rejected: sync would need several files and the "differs" check gets harder).
- **`migrate()` only adds missing sections and bumps the version, it never prunes ids.** Old progress keyed by sample ids like `bulbasaur` stays in `entries`, unused but not deleted.
- **Sync mirrors MyDex** (github.com/XAElSx/MyDex, `js/sync.js`): private Gist, found by file name `pokopia-progress.json`, token in localStorage under its own key `pokopia.token`, gist id under `pokopia.gistId`. Token is never part of the progress object, so Export and the Gist can't contain it.
  - **Conflict flow differs from MyDex on purpose.** MyDex merges per record; the brief for Pokopia says "show both timestamps and let me choose". Rule: remember the timestamp both sides last agreed on (`pokopia.lastSync`). Only local changed since then -> push. Only the Gist changed -> pull (after saving a backup copy in `pokopia.backup`). Both changed, or first connect with different data -> show both timestamps, I choose. Alternative: always ask when different (rejected: asks after every edit).
- **Cross-page links use hash links** (`habitats.html#tallgrass`, `index.html#main-001-bulbasaur`): same behaviour on file:// and GitHub Pages.
- **One global per data type** (`POKOPIA_DB`, `POKOPIA_HABITATS`, ...). `build_js.py` takes the global name as an argument so a second data file can't overwrite the first.
- **`build.py` takes targets** (`python tools/build.py habitats`). Default behaviour for the Pokémon target is unchanged. The raw cache `../pokopia-raw` doesn't exist on this machine, so I don't re-run the Pokémon pipeline.
- **Test tooling lives outside the repo** (scratchpad): headless Chrome driven over CDP with a fresh profile, never the real one.
- **Habitat areas = union of the Location lists of the Pokémon on the habitat page.** The habitat pages have no area field of their own. 194 habitats are in all six base areas, 39 also in Bubbly Basin, the rest are limited (e.g. Palette Town + Cloud Island). Alternative: take areas from `pokopia-pokemon.json` (rejected: same source, and the habitat page is the one being scraped).
- **Habitat requirements without an item link keep `itemSlug: null`** (Water, Tree, Lighting, Seat, ...). They are generic objects, not items with a page, so they can't link to a recipe. Not an error.
- **8 habitats list different Pokémon on Serebii's habitat page and on the Pokémon pages** (e.g. Charizard at Tall Grass). The guide uses the Pokémon pages (`pokopia-pokemon.json`) since they carry rarity, time and weather; the differences are in the verify list.
- **`itemSlug` for Phase 4 is captured now** (from the item link href) so a requirement can link to its recipe without matching on names.

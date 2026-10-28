# Pokopia Site

Personal website for Pokémon Pokopia. Only I use it.

## Stack
- Plain HTML, CSS and JavaScript. No frameworks, no build step.
- Hosted on GitHub Pages.
- Must work well on phone and PC (mobile-first).
- Clean, minimal look.

## Features (build in this order)
1. Collection tracker. For each Pokémon: moved in (yes/no), specialty, area/habitat, personal notes.
2. Habitat guide
3. Crafting/recipe list
4. Pairings: which Pokémon go best together
5. Building: which blocks go well together
6. Town/layout planner

## Data
- Game data lives in separate JSON files in /data, not hardcoded in HTML.
- My progress is saved in localStorage.

## Sync
- Sync button where I enter a GitHub token. Works the same way as my dex tracker.
- Never commit the token to the repo.

## Working rules
- Build one feature at a time. Stop and show me before starting the next one.
- Explain what you changed and why.
- Ask before adding any library or new file structure.

## Progress
(Updated at the end of each phase. Details in docs/PLAN.md, docs/DECISIONS.md, docs/QUESTIONS.md. The phased run was authorised in one go, which overrides the "stop and show me" and "ask before new file structure" rules above for that run.)
- [x] Collection tracker (data from Serebii, 369 Pokémon in data/pokopia-pokemon.json/.js)
- [x] Phase 1: Sync. Private Gist `pokopia-progress.json`, token in localStorage `pokopia.token`. Progress shape v2 in `js/storage.js`. Live Gist test pending (needs token), tested with a stubbed API.
- [x] Phase 2: Habitat database. `data/pokopia-habitats.json/.js` (254 habitats, requirements with item slugs, placement conditions, areas, every Pokémon row read). Slug check: all 254 slugs used by the Pokémon data match, 0 missing (`docs/habitat-slug-report.md`). Rebuild: `python tools/build.py habitats`.
- [x] Phase 3: Habitat guide (`habitats.html`). Search, area/dex/built filters, requirements, Pokémon with rarity/time/weather, built marks in progress. Links both ways with the tracker (`habitats.html#slug`, `index.html#pokemon-id`).
- [x] Phase 4: Crafting/recipes. `data/pokopia-recipes.json/.js` (884 recipes, 1710 items with where to find them), `recipes.html`. Habitat requirements link to their recipe. Rebuild: `python tools/build.py recipes`.
- [x] Phase 5: Pairings (`pairings.html`). Best matches per Pokémon (same ideal habitat + shared favorites), house builder (max 4, score, best additions), "only moved in" option. Houses saved in progress and synced.
- [x] Phase 6: Building blocks. `data/pokopia-favorites.json/.js` (43 favorites, 2367 item entries) and a "Blocks" mode on the pairings page: favorite -> matching items (grouped, Blocks first, linked to recipes). Rebuild: `python tools/build.py favorites`.
- [x] Phase 7: Town planner (`town.html`). 12 x 12 grid per area (7 areas), place houses (Pairings) and habitats (guide), select/erase/clear, saved in progress (`town`) and synced.

## Structure
- Pages: `index.html` (tracker), `habitats.html`, `recipes.html`, `pairings.html` (matches, house builder, blocks), `town.html`, `plan.html`. Each loads `js/storage.js`, `js/nav.js`, `js/sync.js`, then its own script. All plain scripts, no modules, so everything opens from file:// and works on GitHub Pages.
- Game data: `data/pokopia-{pokemon,habitats,recipes,favorites,cooking,dailies}.json` is the source, the `.js` next to it is generated (`window.POKOPIA_DB`, `POKOPIA_HABITATS`, `POKOPIA_RECIPES`, `POKOPIA_FAVORITES`, `POKOPIA_COOKING`, `POKOPIA_DAILIES`). Rebuild with `python tools/build.py <target>` (needs `pip install beautifulsoup4`; raw pages are cached in `../pokopia-raw`). Source disagreements: `data/verify-list.txt`.
- Progress (localStorage `pokopia.collection`, version 4): `entries` by Pokémon id, `habitats` by slug, `houses` by id, `town` by area, `shop` (habitats, recipes, have), `dailies` (day, done, custom, hidden). Sync token: `pokopia.token` (never in the progress object or the repo).
- [x] Look and pictures: restyled (light/dark, tighter phone header), Pokémon and item pictures loaded from Serebii (`image` paths in the data, `tools/images.py`).
- [x] QoL batch (all 15 ideas built in one go because I said "all"; overrides the one-feature-at-a-time and new-file-structure rules for that batch only): Plan page (`plan.html`, `js/plan.js`, `js/shop.js`) with shopping list (habitats + recipes, raw-material breakdown, "have" counts), "build next" ranking and wishlist. Tracker: overview, wishlist stars, "Find now" (time/weather), select several + bulk actions, restore older copies (`pokopia.snapshots`, max 3, one per 30 min). Search everything from the nav (`js/search.js`, Ctrl+K, "/" focuses the page search). Filters and scroll remembered per page (`pokopia.prefs`, not synced). Recipes show "unverified" badges. Town: drag to paint, undo/redo, save as PNG, "!" on mixed houses. Offline: `sw.js` + `manifest.json`, pictures in `images/` (`python tools/fetch_images.py`). Progress shape is now v3 (`shop`, `wish` flags).
- [x] Wiki ideas batch (asked for 1-5 at once): Plan page "Today" daily checklist (`data/pokopia-dailies.json/.js`, hand-written, resets each local day, own tasks + hide in progress `dailies`), specialty coverage table per area + quick area assignment (Plan), "More filters" (ideal habitat, specialty, favorite, flavor, can appear in, lives in) and Compare 2-3 on the Collection page, specialty descriptions in the Pokémon panel, Cooking mode on the recipes page (`data/pokopia-cooking.json/.js`: 34 meals, 58 foods with flavors, 32 specialties; `python tools/build.py cooking`). Roommate match % (pokopiawiki formula, `PokopiaData.matchScore`) in Pairings and Compare. Progress shape v4.
- [x] Tidy + game wording: header is logo, tabs, Search and a Sync pill (dropdown); each page starts with a toolbar (title + counter, search, segmented filters). Phone tabs are a bottom bar. Labels use the game's terms: Pokédex, Habitat Dex, Crafting (Recipes/Cooking), Roommates; "registered" (was moved in), "created" (was built). Saved data keys are unchanged (`movedIn`, `built`). On the web the address has no `index.html` (`nav.js`); from file:// links keep it.

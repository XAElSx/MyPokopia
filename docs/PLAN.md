# Plan

## Phase 1 - Sync
- Files: `js/storage.js` (progress v2 + migrate), `js/sync.js` (Gist sync, mounts into `#sync-mount`), `js/nav.js` (shared nav), CSS additions.
- Data shape: see top of `js/storage.js`.
- UI: a collapsible "Sync" line under the nav (phone and PC). Conflict = a dialog with both timestamps and Keep this device / Keep Gist / Cancel.

## Phase 2 - Habitat database
- Files: `tools/habitats.py` (download + parse + slug cross-check), `data/pokopia-habitats.json` + `.js` (`window.POKOPIA_HABITATS`), `docs/habitat-slug-report.md`. `build.py habitats` runs it.
- Sources looked at first: `habitats.shtml` (index: 3 dexes, no./slug/name/description) and 3 sample pages (`tallgrass`, `campsite`, `fieldofflowers`): flavor text, Requirements table (item link, name, quantity), Available Pokémon (links + Location per Pokémon).
- Shape: `{slug, no, dex, name, description, flavor, requirements:[{item, itemSlug, amount}], areas[], pokemon:[{slug,name}], source, verify[]}`.
- `itemSlug` is kept now so Phase 4 can link a requirement to its recipe.
- No UI in this phase.

## Phase 3 - Habitat guide
- Files: `habitats.html`, `js/habitats.js`, `js/data.js` (shared lookups + labels), CSS additions. Tracker gets habitat links and `#id` deep links.
- Data: `POKOPIA_HABITATS` (requirements, areas) + `POKOPIA_DB` (which Pokémon appear, rarity/time/weather per habitat). Progress: `habitats[slug].built`.
- Phone: sticky header (nav, sync, search, area / dex / built filters), one-column list with a "built" checkbox per row, detail as a bottom sheet. PC: card grid + side panel, same as the tracker.
- Links: tracker panel habitat -> `habitats.html#slug`; guide Pokémon -> `index.html#pokemon-id`; both pages open the target on load.

## Phase 4 - Crafting / recipes
- Files: `tools/recipes.py`, `data/pokopia-recipes.json` + `.js` (`window.POKOPIA_RECIPES`), `recipes.html`, `js/recipes.js`. `build.py recipes` runs it.
- Sources (looked at first): `crafting.shtml` (7 recipe tables: name, how the recipe is unlocked, materials with item links) and `items.shtml` (15 item tables: description, tag, where to find it).
- Shape: `recipes[] = {slug, name, category, obtain[], requirements:[{item, itemSlug, amount}], verify[]}`; `items[] = {slug, name, categories[], description, tag, locations[]}`.
- UI: searchable list (category filter, "habitat items only"). Detail shows how to unlock the recipe, materials (each links to its own recipe or item page, with where to find it) and what uses it (recipes and habitats). Habitat requirements in the guide link to `recipes.html#itemSlug`.

## Phase 5 - Pairings
- Files: `pairings.html`, `js/pairings.js`, shared scoring helpers inside `js/pairings.js`. Progress: `houses[id] = {name, members[]}`.
- Rule: same `idealHabitat` and every shared favorite is one point; a house holds at most 4; house score = sum over member pairs; a mixed-habitat house is flagged.
- Phone/PC: "Best matches" list with detail sheet / side panel; "House builder" cards (name, members, score, best additions). "Only moved in" toggle applies to both.

## Phase 6 - Building blocks
- Serebii has `favorites.shtml` with one page per favorite listing its items, so this is feasible. Files: `tools/favorites.py`, `data/pokopia-favorites.json` + `.js`, a "Blocks" view on the pairings page (favorite -> items, plus a Pokémon's favorites -> items).

## Phase 7 - Town planner
- Files: `town.html`, `js/town.js`. Progress: `town[area] = {w, h, cells: {"x,y": {kind, ref}}}`.
- 12 x 12 squares per area, tools Select / Place / Erase, place a house (from Pairings) or a habitat (from the guide); legend of what is in the area; saved and synced with the rest.

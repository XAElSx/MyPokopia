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
- [x] Phase 2: Habitat database. `data/pokopia-habitats.json/.js` (254 habitats, requirements with item slugs, areas). Slug check: all 254 slugs used by the Pokémon data match, 0 missing (`docs/habitat-slug-report.md`). Rebuild: `python tools/build.py habitats`.
- [x] Phase 3: Habitat guide (`habitats.html`). Search, area/dex/built filters, requirements, Pokémon with rarity/time/weather, built marks in progress. Links both ways with the tracker (`habitats.html#slug`, `index.html#pokemon-id`).
- [x] Phase 4: Crafting/recipes. `data/pokopia-recipes.json/.js` (884 recipes, 1710 items with where to find them), `recipes.html`. Habitat requirements link to their recipe. Rebuild: `python tools/build.py recipes`.

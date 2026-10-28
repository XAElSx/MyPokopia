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
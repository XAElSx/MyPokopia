# Open questions

- **Phase 1:** live Gist sync is untested because it needs your token. Tested with a stubbed `fetch` only. Please press Connect once with a real token and check the status line.
- **Phase 4:** 9 recipes have source problems (see `[recipe]` lines in `data/verify-list.txt`): misspelled material names on Serebii (Linestone, Iron ignot, Stones) that don't match any item, and 3 recipes with no materials parsed (Gold wall, Confectionery wall (lower), "C"). I did not guess the correct materials. Check them in the game if you build those.
- **Phase 6:** Serebii lists no items for the favorite "Looks like food" (the page is empty), so the Blocks view says so. Three favorites list fewer Pokémon on their own page than the Pokémon pages do (Group activities: 13 water Pokémon missing; Lots of water: Horsea; Slender objects: Tatsugiri Curly form). The Pokémon data is used for "Pokémon that like it"; see the `[favorite]` lines in `data/verify-list.txt`.
- **Pictures:** they come straight from serebii.net, so they only show when you are online and Serebii keeps the same file paths. If you would rather have them stored in the repo (works offline, about 35 MB), say so.

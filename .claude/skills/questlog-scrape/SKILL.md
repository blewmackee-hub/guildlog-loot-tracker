---
name: questlog-scrape
description: Refresh GuildLog's item database (src/data/loot-data.json) from Questlog after a Throne & Liberty patch - new items, new bosses, raised level caps, drop rates. Use when the user says Questlog has new items/bosses/levels, a patch shipped, or the item data looks stale.
---

# Questlog scrape (GuildLog item data)

Everything goes through `scripts/add-questlog-items.js`. It talks to Questlog's tRPC API
(`https://questlog.gg/throne-and-liberty/api/trpc`) and edits `src/data/loot-data.json` in place
(minified JSON, one line - review with `git diff --stat`, not the raw diff).

## Ground rules learned the hard way
- **The item LIST endpoint (`database.getItems`) is stale after patches and capped at 1000 rows.** Never use it to
  find new items. `database.getItem?input={"id":...,"language":"en"}` is live - ask for ids directly.
- New ids follow series naming, so probe the next index of each existing series: `--discover`.
  A new *series* (e.g. `S2`, a new weapon naming scheme) is not found by that - get an example URL/id from the user.
- Questlog's item pages carry more than the list: `itemStats.main[level]`, `itemStats.extra[level]`,
  `itemDroppedFromNpcs`, `itemIsPartOfItemSets`, `itemPotential`, `passives`.
- Stat conversions live in the `STAT` table in the script (raw id -> our key; `all_*` fan out to melee/ranged/magic;
  unknown ids become `raw_<id>`). `statFormat.getStatFormat` gives labels, `%` and the multiplier (e.g. x0.01).
  New raw ids the script does not know still work as `raw_*` but need a label/group in `src/lib/gameData.js`
  (Directional/Misc groups) to display - that is how `raw_rear_damage_reduction` was added.
- Stored stats are `{base, perLevel}` from a least-squares fit over the item's level range, base at the first level.
  `weaponDamage` is the value at max level only. Fixed-level items have `perLevel: 0`.
- Sources: one row per distinct (npc name, rate); `SOURCES` names are unique, reuse an entry by name.
  Each armor piece belongs to ONE set (`setId`); sets are stored as `SETS[id] = {name, pieces, bonuses}`.
- Questlog fixes typos between patches ("Tallus" -> "Talus"); the scripts overwrite names, which is wanted.

## Workflow after a patch
1. `git status` clean? Then find new ids: `node scripts/add-questlog-items.js --discover`
2. Add them: `node scripts/add-questlog-items.js <id> <id> ...` (prints new bosses and sets it created).
   Armor, accessories and weapons are handled; materials/skill cores/recipes are NOT (extend the script if needed).
3. New bosses also drop old items: `node scripts/add-questlog-items.js --sources "<Boss Name>" ...`
   appends only that boss's rows to old items. Do not blanket-refresh drop rates: Questlog re-rounds old rates and
   it churns hundreds of items. Do that only when the user asks (they planned it for the next patch with the Colossus boss).
4. Level caps moved (80 -> 90, arch weapons 85 -> 93 happened in the Sep 2026 patch):
   `node scripts/add-questlog-items.js --levels` rewrites `levelRange`/`stats`/`weaponDamage` on every item whose
   cap changed. Re-run `--verify` afterwards.
5. `node scripts/add-questlog-items.js --verify` re-converts a sample (every 4th item) and diffs against stored data.
   Expected noise: drop-rate rows, passive text Questlog reworded. Anything in slot/rarity/icon/levelRange/stats/set/
   traits/resonance/potential is a bug in the converter or a real patch change - investigate before merging.
6. `npx eslint scripts src/lib && npx next build`. The UI needs a Discord login to inspect items live.
7. Do not commit unless asked. Update the memory note about the patch state.

## Not covered / ideas
- Recipes (`RECIPES`), materials, skill cores, and item stat changes on old gear that are not level-cap changes
  (re-run a targeted convert on suspect ids and diff).
- `POTENTIAL_CATALOGS` are deduped by signature; new catalogs get the next `potential_N` id.

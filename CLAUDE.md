@AGENTS.md

## Commands
- `npm run dev` (port 3000), `npm run build`, `npm run lint`. Needs `.env.local` (copy `.env.local.example`: DATABASE_URL, Discord OAuth, AUTH_SECRET). The app is behind a Discord login.
- Known: lint reports 2 unescaped-apostrophe errors at `src/components/InheritanceTab.js:15`.

## Architecture
- Next.js App Router. `src/components/App.js` is the client shell (tabs: Database, Build, Wishlist, Farm Plan, DKP, Parties, Members). API routes in `src/app/api/`, logic in `src/lib/` (`calculations.js`, `gameData.js`, `db.js`, `guilds.js`), Postgres schema in `db/schema.sql`, auth via next-auth Discord.
- Game data lives in `src/data/loot-data.json` (minified, one line, ~3.4 MB). Never hand-edit it.

## Game data (Questlog)
- After a Throne & Liberty patch, use the `questlog-scrape` skill / `scripts/add-questlog-items.js` (`--discover`, `<ids>`, `--sources`, `--levels`, `--verify`).
- Questlog's item LIST API is stale after patches; fetch items by id. Stored stats are `{base, perLevel}` fits; weapon damage is stored at max level. Level caps: 90 (93 for archboss weapons).

## Gotchas
- The page background is `body::before` (fixed layer). Don't give `body` an opaque background or it hides the stone texture; `html` holds the base color.
- The Database list renders 60 rows and loads more via an IntersectionObserver tripwire in `App.js`. Don't render all ~1,470 items at once.
- Party Planner dropdowns are compact one-line `CustomSelect`s (styles scoped to `.party-planner__slots`).
- Inheritance ore cost (`estimateInheritCost`) is a fit to real examples, extrapolated above level 81.

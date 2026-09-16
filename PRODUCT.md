# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a guild member in a Throne & Liberty (T&L) guild. They browse the item database and build a paperdoll loadout for their character, then wishlist the specific gear that build calls for so officers know what to aim drops toward. From there they check the parties officers/leadership have assigned them to for in-game events, and (in guilds that use DKP rather than a loot council or seniority system) track their own DKP balance.

Secondary users: guild officers/leadership, who assign parties, curate the item database, and — in DKP guilds — adjust members' DKP balances. A subset of officers act as guild owner/admin for membership and settings; a separate site-admin role (gated by `isSiteAdmin`) handles cross-guild moderation.

## Product Purpose

GuildLog is a loot- and roster-management tool for T&L guilds. It replaces TLGM and similar Discord-bot-based guild management — which requires copious back-and-forth through bot commands, DMs, and manual attendance flares — with a single page members and officers both check directly. Success is a guild running loot, parties, and (optionally) DKP without that Discord overhead, and without members and officers working from different, stale copies of the same information.

## Positioning

One integrated system: item database, build/paperdoll planning, wishlist, DKP, party assignment, and farm planning all live together against the same character/guild data, instead of being stitched across a Discord bot, spreadsheets, and manual messages. A member's wishlist is derived from their own build, and officers assign parties and (optionally) loot against that same shared picture — nobody is reconciling separate sources of truth.

## Operating Context

- Sign-in is Discord-only (next-auth), then the member finds or registers their guild by name and enters a guild PIN.
- A Discord account can hold multiple characters, each scoped to a specific guild.
- Guilds are independent: each sets its own PIN, decides whether it uses DKP at all (vs. loot council or seniority), and has its own officers/members roster.
- Live in production at gllt.app, deployed on Vercel from `main`, backed by a Neon Postgres database (separate `production` and `dev` branches — schema changes must be applied to each independently since `db/schema.sql` is a manually-run source file, not an auto-migration).

## Capabilities and Constraints

- DKP is optional per guild — some guilds use loot council or seniority instead, so DKP-related UI must not assume every guild wants or uses it.
- Guild access is PIN-based, not per-member-invited; identity comes from Discord, guild membership comes from knowing the PIN.
- Roles: regular member, officer/leadership (assigns parties, and adjusts DKP where used), guild owner/admin (membership/settings), site admin (cross-guild moderation, separate from guild-level roles).
- Desktop and mobile web both matter — the app has an established mobile-responsive layout (hamburger nav, resized tables/grids) that any new work must keep intact alongside the desktop layout.

## Brand Commitments

Name "GuildLog" and the gllt.app domain are locked — no rebrand should be proposed.

## Product Principles

- One shared picture: what a member sees (build, wishlist, assigned party, DKP) and what an officer manages should be the same underlying data, not parallel copies.
- Don't assume DKP: guilds that use loot council/seniority instead are a normal case, not an edge case.
- Replace Discord-bot busywork: any workflow that used to mean a bot command, a DM, or a manual attendance flare is a candidate for living directly in the app instead.
- Officers and members are both first-class: this is not an admin tool with a read-only member view bolted on.

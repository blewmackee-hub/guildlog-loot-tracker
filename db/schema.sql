-- Solisium Loot Compendium - schema for the Discord + guild PIN
-- system (see project-brief.md addendum). Run this once against
-- whatever Postgres instance DATABASE_URL points at (Supabase, Neon,
-- or anything else) before using the guild features.
--
-- gen_random_uuid() is built into Postgres core since v13 - no
-- extension needed on any reasonably modern instance.

CREATE TABLE IF NOT EXISTS users (
  discord_id  TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set on every real Discord sign-in (upsertUser, called from auth.js's
-- jwt callback only when a fresh OAuth sign-in happens, not on every
-- session/token refresh) - "has this account signed in recently" for
-- the inactive-leader claim feature (claimLeadership in
-- src/lib/guilds.js). NULL for anyone who hasn't signed in since this
-- column was added; treated as "not stale" until they do, so no
-- existing leader becomes claimable the instant this ships.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS guilds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  pin_hash          TEXT NOT NULL,
  owner_discord_id  TEXT NOT NULL REFERENCES users(discord_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly DKP decay, configured per guild (leader-only - see
-- setDecaySettings in src/lib/guilds.js). dkp_decay_pct = 0 means
-- disabled. dkp_decay_weekday follows Postgres EXTRACT(DOW ...): 0 =
-- Sunday .. 6 = Saturday. There's no cron job - decay is applied
-- lazily (applyDueDecay, called from listGuildRoster) the next time
-- anyone loads the DKP tab on or after the configured day; dkp_decay_
-- last_applied guards against re-applying it twice in the same week.
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dkp_decay_pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dkp_decay_weekday INTEGER;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS dkp_decay_last_applied TIMESTAMPTZ;

-- One row per named character (matches the app's existing "Playing
-- as" profile switcher, now scoped to a guild + Discord account
-- instead of just a browser's localStorage). A single Discord user
-- can have multiple characters in the same guild (alts) and
-- characters in multiple different guilds.
CREATE TABLE IF NOT EXISTS characters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id   TEXT NOT NULL REFERENCES users(discord_id),
  guild_id     UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  build        JSONB NOT NULL DEFAULT '{}'::jsonb,
  wishlist     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (discord_id, guild_id, name)
);

-- PIN attempts are logged (not just counted) so the rate-limit
-- window is a simple "how many rows in the last N minutes" query -
-- no separate counter/reset-timer state to keep consistent.
CREATE TABLE IF NOT EXISTS guild_pin_attempts (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_id  TEXT NOT NULL,
  succeeded   BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_characters_discord_guild ON characters (discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_lookup ON guild_pin_attempts (guild_id, discord_id, attempted_at);
CREATE INDEX IF NOT EXISTS idx_guilds_name_search ON guilds (lower(name));

-- One row per (Discord account, guild) they have at least one
-- character in - DKP total and officer flag live here, at the same
-- grain as "guild member" already used by listGuildMembers, rather
-- than on `characters`, since a single account's several alts must
-- all share one DKP total and one role. Guild leader is NOT stored
-- here - it's guilds.owner_discord_id (already transferable via
-- transferOwnership), so there's exactly one place a leader change
-- has to be written. Rows are created lazily (getOrCreateCharacter,
-- or a backfill upsert the first time a guild's roster is read) so
-- no separate migration is needed for characters created before this
-- table existed.
CREATE TABLE IF NOT EXISTS guild_memberships (
  guild_id    UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_id  TEXT NOT NULL REFERENCES users(discord_id),
  dkp_total   INTEGER NOT NULL DEFAULT 0,
  is_officer  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, discord_id)
);

-- Attendance tracking (Yes/No per member) was tried and removed - drop
-- it if an earlier run of this file added it.
ALTER TABLE guild_memberships DROP COLUMN IF EXISTS attended;

-- One row per DKP adjustment (adjustDkp in src/lib/guilds.js) - a bulk
-- "add 25 to everyone selected" writes one row per target, not one row
-- for the whole batch, so each member's history reads independently.
-- No log for officer assignment or the old attendance feature - scoped
-- to DKP totals only, which is what "who changed what and why" was
-- actually about.
CREATE TABLE IF NOT EXISTS dkp_log (
  id                 BIGSERIAL PRIMARY KEY,
  guild_id           UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  actor_discord_id   TEXT NOT NULL REFERENCES users(discord_id),
  target_discord_id  TEXT NOT NULL REFERENCES users(discord_id),
  delta              INTEGER NOT NULL,
  reason             TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dkp_log_guild_time ON dkp_log (guild_id, created_at DESC);

-- Party planner templates (src/lib/guilds.js party* functions). Each
-- template is the whole 10-groups-of-6 board in one JSONB column
-- rather than a normalized groups/slots table - the board is always
-- read and written as one unit (load a template, edit it, save it
-- back), never queried slot-by-slot, so there's nothing a relational
-- shape would buy. `groups` shape: an array of exactly 10
-- { name: string, slots: [6 x (className string | null)] } objects,
-- validated in application code, not by a CHECK constraint - the slot
-- count and class list are UI-owned things that may still move.
CREATE TABLE IF NOT EXISTS party_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id       UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  groups         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by     TEXT REFERENCES users(discord_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_templates_guild ON party_templates (guild_id, name);

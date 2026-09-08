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

CREATE TABLE IF NOT EXISTS guilds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  pin_hash          TEXT NOT NULL,
  owner_discord_id  TEXT NOT NULL REFERENCES users(discord_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

const PIN_ATTEMPT_LIMIT = 5;
const PIN_ATTEMPT_WINDOW_MINUTES = 15;

export async function searchGuilds(searchText) {
  const q = (searchText || "").trim();
  if (!q) {
    const res = await query(`SELECT id, name, created_at FROM guilds ORDER BY name LIMIT 25`);
    return res.rows;
  }
  const res = await query(
    `SELECT id, name, created_at FROM guilds WHERE name ILIKE $1 ORDER BY name LIMIT 25`,
    [`%${q}%`]
  );
  return res.rows;
}

export async function registerGuild({ name, pin, ownerDiscordId }) {
  const trimmedName = (name || "").trim();
  if (trimmedName.length < 2) throw new HttpError(400, "Guild name must be at least 2 characters.");
  if (!/^\d{4,8}$/.test(pin || "")) throw new HttpError(400, "PIN must be 4-8 digits.");

  const pinHash = await bcrypt.hash(pin, 10);
  try {
    const res = await query(
      `INSERT INTO guilds (name, pin_hash, owner_discord_id) VALUES ($1, $2, $3) RETURNING id, name, created_at`,
      [trimmedName, pinHash, ownerDiscordId]
    );
    return res.rows[0];
  } catch (e) {
    if (e.code === "23505") {
      // unique_violation on guilds.name
      throw new HttpError(409, `A guild named "${trimmedName}" already exists. Ask its owner for the PIN, or pick a different name.`);
    }
    throw e;
  }
}

/* Rate limiting: reject before even checking the PIN once this
   (guild, discordId) pair has PIN_ATTEMPT_LIMIT failed attempts
   inside the trailing window - a successful attempt doesn't reset
   the window early, it just naturally ages out. */
export async function checkPinRateLimit({ guildId, discordId }) {
  const res = await query(
    `SELECT count(*)::int AS failed_count
     FROM guild_pin_attempts
     WHERE guild_id = $1 AND discord_id = $2 AND succeeded = false
       AND attempted_at > now() - ($3 || ' minutes')::interval`,
    [guildId, discordId, PIN_ATTEMPT_WINDOW_MINUTES]
  );
  const failedCount = res.rows[0].failed_count;
  if (failedCount >= PIN_ATTEMPT_LIMIT) {
    throw new HttpError(
      429,
      `Too many incorrect PIN attempts for this guild. Try again in a few minutes.`
    );
  }
}

export async function verifyGuildPin({ guildId, pin, discordId }) {
  await checkPinRateLimit({ guildId, discordId });

  const res = await query(`SELECT pin_hash FROM guilds WHERE id = $1`, [guildId]);
  if (res.rows.length === 0) throw new HttpError(404, "Guild not found.");

  const ok = await bcrypt.compare(pin || "", res.rows[0].pin_hash);
  await query(
    `INSERT INTO guild_pin_attempts (guild_id, discord_id, succeeded) VALUES ($1, $2, $3)`,
    [guildId, discordId, ok]
  );
  if (!ok) throw new HttpError(401, "Incorrect PIN.");
}

export async function getOrCreateCharacter({ discordId, guildId, name }) {
  const characterName = (name || "").trim() || "Main";
  const existing = await query(
    `SELECT id, name, build, wishlist FROM characters WHERE discord_id = $1 AND guild_id = $2 AND name = $3`,
    [discordId, guildId, characterName]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await query(
    `INSERT INTO characters (discord_id, guild_id, name) VALUES ($1, $2, $3) RETURNING id, name, build, wishlist`,
    [discordId, guildId, characterName]
  );
  return created.rows[0];
}

export async function listCharacters({ discordId, guildId }) {
  const res = await query(
    `SELECT id, name FROM characters WHERE discord_id = $1 AND guild_id = $2 ORDER BY created_at`,
    [discordId, guildId]
  );
  return res.rows;
}

export async function saveCharacterData({ characterId, discordId, build, wishlist }) {
  // discordId in the WHERE clause, not just id, so one signed-in
  // user can never overwrite another's character even if a
  // characterId leaked/was guessed.
  await query(
    `UPDATE characters SET build = $1, wishlist = $2, updated_at = now() WHERE id = $3 AND discord_id = $4`,
    [JSON.stringify(build), JSON.stringify(wishlist), characterId, discordId]
  );
}

export async function getGuildById(guildId) {
  const res = await query(`SELECT id, name FROM guilds WHERE id = $1`, [guildId]);
  return res.rows[0] || null;
}

/* Shared by GET /api/character, POST /api/character (new alt), and
   POST /api/character/switch - discordId is always part of the WHERE
   clause so a character id alone (from a cookie or a request body)
   can never resolve to someone else's character. Returns null rather
   than throwing so callers can 404/redirect however fits their route. */
export async function getCharacterContext({ discordId, characterId }) {
  const res = await query(
    `SELECT id, name, guild_id, build, wishlist FROM characters WHERE id = $1 AND discord_id = $2`,
    [characterId, discordId]
  );
  const character = res.rows[0];
  if (!character) return null;
  const [guild, characters] = await Promise.all([
    getGuildById(character.guild_id),
    listCharacters({ discordId, guildId: character.guild_id }),
  ]);
  return { character, guild, characters };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

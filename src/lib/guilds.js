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
  const res = await query(`SELECT id, name, owner_discord_id FROM guilds WHERE id = $1`, [guildId]);
  return res.rows[0] || null;
}

/* Owner-only roster: one row per Discord account with characters in
   this guild, each carrying its own character list (so the owner can
   see who has alts before kicking) and whether they're the current
   owner (to badge them and hide the pointless "promote" action). */
export async function listGuildMembers({ guildId }) {
  const res = await query(
    `SELECT u.discord_id AS "discordId", u.username,
            (u.discord_id = g.owner_discord_id) AS "isOwner",
            json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name) AS characters
     FROM characters c
     JOIN users u ON u.discord_id = c.discord_id
     JOIN guilds g ON g.id = $1
     WHERE c.guild_id = $1
     GROUP BY u.discord_id, u.username, g.owner_discord_id
     ORDER BY u.username`,
    [guildId]
  );
  return res.rows;
}

/* Owner-initiated removal, e.g. someone kicked from the guild
   in-game: deletes every character the TARGET has in this guild.
   Re-checks ownership server-side (never trust a client-asserted
   "I'm the owner") and refuses to let the owner kick themselves this
   way - that's what leaveGuild is for, so there's exactly one code
   path that empties a guild owner's own characters. */
export async function kickMember({ guildId, targetDiscordId, requesterDiscordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id !== requesterDiscordId) {
    throw new HttpError(403, "Only the guild owner can remove members.");
  }
  if (targetDiscordId === requesterDiscordId) {
    throw new HttpError(400, "Use \"Leave Guild\" to remove your own characters.");
  }
  await query(`DELETE FROM characters WHERE discord_id = $1 AND guild_id = $2`, [targetDiscordId, guildId]);
}

/* Hands the guild off to another member, e.g. the owner is leaving
   or wants to pass leadership along. The target must already have a
   character in this guild - ownership can't be handed to someone who
   isn't a member. Re-checks the requester is the CURRENT owner (never
   trusts a client claim), same pattern as kickMember/deleteGuild. */
export async function transferOwnership({ guildId, newOwnerDiscordId, requesterDiscordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id !== requesterDiscordId) {
    throw new HttpError(403, "Only the guild owner can transfer ownership.");
  }
  if (newOwnerDiscordId === requesterDiscordId) {
    throw new HttpError(400, "You're already the owner.");
  }
  const member = await query(
    `SELECT 1 FROM characters WHERE discord_id = $1 AND guild_id = $2 LIMIT 1`,
    [newOwnerDiscordId, guildId]
  );
  if (member.rows.length === 0) {
    throw new HttpError(404, "That person doesn't have a character in this guild.");
  }
  await query(`UPDATE guilds SET owner_discord_id = $1 WHERE id = $2`, [newOwnerDiscordId, guildId]);
}

/* Deletes the guild itself (not just one member's characters) - the
   whole point being to fix "there's no way to get rid of a guild
   once it's created". CASCADE on characters.guild_id and
   guild_pin_attempts.guild_id (db/schema.sql) takes every member's
   characters and PIN-attempt history with it in one statement. */
export async function deleteGuild({ guildId, requesterDiscordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id !== requesterDiscordId) {
    throw new HttpError(403, "Only the guild owner can delete this guild.");
  }
  await query(`DELETE FROM guilds WHERE id = $1`, [guildId]);
}

/* "Leave guild" for someone who left it in-game: deletes ALL of the
   signed-in user's characters in this guild (every alt, not just the
   active one) - PIN access isn't real membership (anyone with the
   PIN can rejoin any time), so the meaningful thing to revoke is
   their own build/wishlist data living under this guild, not access
   to it. discordId is part of the WHERE clause, same pattern as
   saveCharacterData, so this can never touch another member's rows. */
export async function leaveGuild({ discordId, guildId }) {
  await query(`DELETE FROM characters WHERE discord_id = $1 AND guild_id = $2`, [discordId, guildId]);
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
  const [guildRow, characters] = await Promise.all([
    getGuildById(character.guild_id),
    listCharacters({ discordId, guildId: character.guild_id }),
  ]);
  // isOwner, not the raw owner_discord_id, is what the client gets -
  // no reason to expose another account's id to every guildmate.
  const guild = guildRow && { id: guildRow.id, name: guildRow.name, isOwner: guildRow.owner_discord_id === discordId };
  return { character, guild, characters };
}

/* Aggregate-only view for the Farm Plan tab: how many characters in
   this guild have each item wishlisted ("14 wishlisted"), without
   exposing whose wishlist it is or any individual's crafting recipe
   list - crafting materials are personal and untradable, so only the
   counts are shared, never the underlying per-character rows. */
export async function getGuildWishlistTally({ guildId }) {
  const res = await query(`SELECT wishlist FROM characters WHERE guild_id = $1`, [guildId]);
  const tally = {};
  for (const row of res.rows) {
    for (const itemId of Object.keys(row.wishlist || {})) {
      tally[itemId] = (tally[itemId] || 0) + 1;
    }
  }
  return tally;
}

/* --- site-admin moderation (see /lib/admin.js) ---------------------------
   These bypass the owner check entirely - callers MUST have already
   verified isAdmin(session.user.discordId) themselves. Kept separate
   from the owner-scoped functions above rather than adding an
   isAdminOverride flag to them, so an admin code path can never be
   reached by accident through the normal owner-only routes. */

/* Every guild with its owner's username and how many characters are
   in it, newest first, optionally filtered by name - the moderation
   list view. No PIN/hash exposed. */
export async function adminListGuilds({ q } = {}) {
  const searchText = (q || "").trim();
  const res = await query(
    `SELECT g.id, g.name, g.created_at, g.owner_discord_id AS "ownerDiscordId", u.username AS "ownerUsername",
            count(c.id)::int AS "characterCount"
     FROM guilds g
     JOIN users u ON u.discord_id = g.owner_discord_id
     LEFT JOIN characters c ON c.guild_id = g.id
     WHERE $1 = '' OR g.name ILIKE '%' || $1 || '%'
     GROUP BY g.id, g.name, g.created_at, g.owner_discord_id, u.username
     ORDER BY g.created_at DESC
     LIMIT 100`,
    [searchText]
  );
  return res.rows;
}

export async function adminRenameGuild({ guildId, name }) {
  const trimmedName = (name || "").trim();
  if (trimmedName.length < 2) throw new HttpError(400, "Guild name must be at least 2 characters.");
  try {
    const res = await query(`UPDATE guilds SET name = $1 WHERE id = $2 RETURNING id, name`, [trimmedName, guildId]);
    if (res.rows.length === 0) throw new HttpError(404, "Guild not found.");
    return res.rows[0];
  } catch (e) {
    if (e.code === "23505") {
      throw new HttpError(409, `A guild named "${trimmedName}" already exists.`);
    }
    throw e;
  }
}

export async function adminDeleteGuild({ guildId }) {
  const res = await query(`DELETE FROM guilds WHERE id = $1 RETURNING id`, [guildId]);
  if (res.rows.length === 0) throw new HttpError(404, "Guild not found.");
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

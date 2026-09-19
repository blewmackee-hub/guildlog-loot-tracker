import bcrypt from "bcryptjs";
import { query, withTransaction } from "@/lib/db";

const PIN_ATTEMPT_LIMIT = 5;
const PIN_GUILD_ATTEMPT_LIMIT = 30;
const PIN_ATTEMPT_WINDOW_MINUTES = 15;
const MAX_GUILD_NAME_LENGTH = 40;
const MAX_CHARACTER_NAME_LENGTH = 30;
const MAX_CHARACTERS_PER_GUILD = 10; // per Discord account
const MAX_DKP_REASON_LENGTH = 200;
const MAX_DKP_DELTA = 1_000_000;
const DECAY_LOG_REASON = "Weekly decay";

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

async function hashPin(pin) {
  if (!/^\d{6}$/.test(pin || "")) throw new HttpError(400, "PIN must be exactly 6 digits.");
  return bcrypt.hash(pin, 10);
}

// Owner-only. Existing members keep their characters; only the PIN
// needed to join changes.
export async function changeGuildPin({ guildId, requesterDiscordId, pin }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id !== requesterDiscordId) {
    throw new HttpError(403, "Only the guild owner can change the PIN.");
  }
  await query(`UPDATE guilds SET pin_hash = $1 WHERE id = $2`, [await hashPin(pin), guildId]);
}

export async function registerGuild({ name, pin, ownerDiscordId }) {
  const trimmedName = (typeof name === "string" ? name : "").trim();
  if (trimmedName.length < 2) throw new HttpError(400, "Guild name must be at least 2 characters.");
  if (trimmedName.length > MAX_GUILD_NAME_LENGTH) {
    throw new HttpError(400, `Guild name can be at most ${MAX_GUILD_NAME_LENGTH} characters.`);
  }
  const pinHash = await hashPin(pin);
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

/* Rate limiting: every attempt is logged BEFORE the PIN is compared,
   then failures in the trailing window (this attempt included) are
   counted - so parallel requests can't all read "0 failures" and slip
   past, the way a count-then-insert check allowed. At most
   PIN_ATTEMPT_LIMIT of a burst get through to bcrypt. A correct PIN
   flips its own row to succeeded. Two caps: per (guild, account), and a
   per-guild ceiling so spinning up extra Discord accounts doesn't reset
   the budget (tradeoff: someone can burn it to briefly block joins). */
export async function verifyGuildPin({ guildId, pin, discordId }) {
  const guildRes = await query(`SELECT pin_hash FROM guilds WHERE id = $1`, [guildId]);
  if (guildRes.rows.length === 0) throw new HttpError(404, "Guild not found.");

  const attempt = await query(
    `INSERT INTO guild_pin_attempts (guild_id, discord_id, succeeded) VALUES ($1, $2, false) RETURNING id`,
    [guildId, discordId]
  );
  const counts = await query(
    `SELECT count(*) FILTER (WHERE discord_id = $2)::int AS mine, count(*)::int AS total
     FROM guild_pin_attempts
     WHERE guild_id = $1 AND succeeded = false
       AND attempted_at > now() - ($3 || ' minutes')::interval`,
    [guildId, discordId, PIN_ATTEMPT_WINDOW_MINUTES]
  );
  const { mine, total } = counts.rows[0];
  if (mine > PIN_ATTEMPT_LIMIT || total > PIN_GUILD_ATTEMPT_LIMIT) {
    throw new HttpError(429, `Too many incorrect PIN attempts for this guild. Try again in a few minutes.`);
  }

  const ok = await bcrypt.compare(typeof pin === "string" ? pin : "", guildRes.rows[0].pin_hash);
  if (!ok) throw new HttpError(401, "Incorrect PIN.");
  await query(`UPDATE guild_pin_attempts SET succeeded = true WHERE id = $1`, [attempt.rows[0].id]);
}

export async function getOrCreateCharacter({ discordId, guildId, name }) {
  const characterName = (typeof name === "string" ? name : "").trim() || "Main";
  if (characterName.length > MAX_CHARACTER_NAME_LENGTH) {
    throw new HttpError(400, `Character name can be at most ${MAX_CHARACTER_NAME_LENGTH} characters.`);
  }
  const existing = await query(
    `SELECT id, name, build, wishlist FROM characters WHERE discord_id = $1 AND guild_id = $2 AND lower(name) = lower($3)
     ORDER BY created_at LIMIT 1`,
    [discordId, guildId, characterName]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const count = await query(`SELECT count(*)::int AS n FROM characters WHERE discord_id = $1 AND guild_id = $2`, [discordId, guildId]);
  if (count.rows[0].n >= MAX_CHARACTERS_PER_GUILD) {
    throw new HttpError(400, `You can have at most ${MAX_CHARACTERS_PER_GUILD} characters in one guild.`);
  }
  const created = await query(
    `INSERT INTO characters (discord_id, guild_id, name) VALUES ($1, $2, $3) RETURNING id, name, build, wishlist`,
    [discordId, guildId, characterName]
  );
  return created.rows[0];
}

/* Deletes ONE of the signed-in user's own characters (an alt). discordId
   is in the WHERE clause, so a character id from anyone else's account
   matches nothing. The last character in a guild can't be deleted this
   way - "Leave Guild" is the path that empties a guild (and hands off
   leadership). The row lock keeps two simultaneous deletes from each
   seeing the other's character still there and removing both. Returns the
   oldest remaining character's id, for the caller to switch to. */
export async function deleteCharacter({ discordId, characterId }) {
  return withTransaction(async (client) => {
    const target = await client.query(`SELECT guild_id FROM characters WHERE id = $1 AND discord_id = $2`, [characterId, discordId]);
    if (target.rows.length === 0) throw new HttpError(404, "Character not found.");
    const guildId = target.rows[0].guild_id;
    const mine = await client.query(
      `SELECT id FROM characters WHERE discord_id = $1 AND guild_id = $2 ORDER BY created_at FOR UPDATE`,
      [discordId, guildId]
    );
    if (mine.rows.length < 2) {
      throw new HttpError(400, "You can't delete your only character in this guild - use Leave Guild instead.");
    }
    await client.query(`DELETE FROM characters WHERE id = $1 AND discord_id = $2`, [characterId, discordId]);
    return { nextCharacterId: mine.rows.find((r) => r.id !== characterId).id };
  });
}

async function listCharacters({ discordId, guildId }) {
  const res = await query(
    `SELECT id, name FROM characters WHERE discord_id = $1 AND guild_id = $2 ORDER BY created_at`,
    [discordId, guildId]
  );
  return res.rows;
}

// build/wishlist are stored as JSONB and scanned guild-wide (item-owners,
// wishlist tally) - a non-object (or a huge blob) from one member would
// break those for everyone, so reject anything but a reasonably sized
// plain object here rather than trusting the client.
const CHARACTER_JSON_MAX_BYTES = 200_000;

function requireJsonObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object.`);
  }
  const json = JSON.stringify(value);
  if (json.length > CHARACTER_JSON_MAX_BYTES) throw new HttpError(413, `${label} is too large.`);
  return json;
}

export async function saveCharacterData({ characterId, discordId, build, wishlist }) {
  const buildJson = requireJsonObject(build, "build");
  const wishlistJson = requireJsonObject(wishlist, "wishlist");
  // discordId in the WHERE clause, not just id, so one signed-in
  // user can never overwrite another's character even if a
  // characterId leaked/was guessed.
  await query(
    `UPDATE characters SET build = $1, wishlist = $2, updated_at = now() WHERE id = $3 AND discord_id = $4`,
    [buildJson, wishlistJson, characterId, discordId]
  );
}

export async function getGuildById(guildId) {
  const res = await query(
    `SELECT id, name, owner_discord_id,
            dkp_decay_pct AS "dkpDecayPct", dkp_decay_weekday AS "dkpDecayWeekday", dkp_decay_last_applied AS "dkpDecayLastApplied"
     FROM guilds WHERE id = $1`,
    [guildId]
  );
  return res.rows[0] || null;
}

const OFFICER_CAP = 3;

// leader > officer > member, in that priority order - a guild's owner
// is always "leader" regardless of their guild_memberships.is_officer
// flag (which is only meaningful for everyone else).
function roleFor({ guild, discordId, isOfficer }) {
  if (guild.owner_discord_id === discordId) return "leader";
  if (isOfficer) return "officer";
  return "member";
}

export async function getMemberRole({ guildId, discordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id === discordId) return "leader";
  const res = await query(
    `SELECT gm.is_officer AS "isOfficer" FROM guild_memberships gm
     WHERE gm.guild_id = $1 AND gm.discord_id = $2
       AND EXISTS (SELECT 1 FROM characters c WHERE c.guild_id = gm.guild_id AND c.discord_id = gm.discord_id)`,
    [guildId, discordId]
  );
  return roleFor({ guild, discordId, isOfficer: res.rows[0]?.isOfficer || false });
}

// Kick/leave keep the guild_memberships row (so DKP survives a rejoin)
// but must drop officer status, or the flag would come back with them.
function clearOfficer({ guildId, discordId }) {
  return query(`UPDATE guild_memberships SET is_officer = false WHERE guild_id = $1 AND discord_id = $2`, [guildId, discordId]);
}

// Called before any write that targets a guild_memberships row a
// member might not have yet (e.g. their first-ever DKP adjustment) -
// ON CONFLICT DO NOTHING makes this safe to call unconditionally
// rather than checking existence first.
async function ensureGuildMembership({ guildId, discordId }) {
  await query(
    `INSERT INTO guild_memberships (guild_id, discord_id) VALUES ($1, $2)
     ON CONFLICT (guild_id, discord_id) DO NOTHING`,
    [guildId, discordId]
  );
}

// Leader-only. Promoting is capped at OFFICER_CAP, enforced here (not
// just client-side). The guild row is locked for the count-then-update so
// concurrent promotions queue up instead of both seeing a free slot.
export async function setOfficer({ guildId, targetDiscordId, requesterDiscordId, makeOfficer }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id !== requesterDiscordId) {
    throw new HttpError(403, "Only the guild leader can assign officers.");
  }
  await ensureGuildMembership({ guildId, discordId: targetDiscordId });
  await withTransaction(async (client) => {
    await client.query(`SELECT 1 FROM guilds WHERE id = $1 FOR UPDATE`, [guildId]);
    if (makeOfficer) {
      const countRes = await client.query(
        `SELECT count(*)::int AS n FROM guild_memberships WHERE guild_id = $1 AND is_officer = true AND discord_id <> $2`,
        [guildId, targetDiscordId]
      );
      if (countRes.rows[0].n >= OFFICER_CAP) {
        throw new HttpError(400, `Officer slots are full (${OFFICER_CAP}/${OFFICER_CAP}).`);
      }
    }
    await client.query(
      `UPDATE guild_memberships SET is_officer = $1 WHERE guild_id = $2 AND discord_id = $3`,
      [!!makeOfficer, guildId, targetDiscordId]
    );
  });
}

// Midnight UTC of the most recent occurrence of `weekday` (0=Sunday..
// 6=Saturday, matching Postgres EXTRACT(DOW ...)) that is today or
// earlier - "this week's decay day", whether or not it's arrived yet
// this exact week vs. last.
function mostRecentOccurrence(weekday, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// Called once a day by the scheduled job (GET /api/cron/decay, see
// vercel.json) - never from a page load, so opening the DKP tab can't
// trigger it. A guild is decayed when its chosen weekday's most recent
// occurrence is newer than dkp_decay_last_applied; a missed run is
// caught up by the next daily one. The claim (conditional UPDATE of
// dkp_decay_last_applied) and the decay happen in one transaction, so a
// retry or double-fire can't apply it twice and a failure can't mark a
// guild done without decaying it. Each changed balance gets a dkp_log
// row (attributed to the guild owner) so the history shows what moved.
export async function applyDueDecays() {
  const guilds = await query(
    `SELECT id, dkp_decay_weekday AS weekday, dkp_decay_last_applied AS "lastApplied"
     FROM guilds WHERE dkp_decay_pct > 0 AND dkp_decay_weekday IS NOT NULL`
  );
  const applied = [];
  for (const g of guilds.rows) {
    const due = mostRecentOccurrence(g.weekday);
    if (g.lastApplied && new Date(g.lastApplied) >= due) continue;
    const affected = await withTransaction(async (client) => {
      const claim = await client.query(
        `UPDATE guilds SET dkp_decay_last_applied = now()
         WHERE id = $1 AND dkp_decay_pct > 0 AND dkp_decay_weekday = $3
           AND (dkp_decay_last_applied IS NULL OR dkp_decay_last_applied < $2)
         RETURNING dkp_decay_pct AS pct, owner_discord_id AS owner`,
        [g.id, due, g.weekday]
      );
      if (claim.rows.length === 0) return null; // someone else got there first
      const { pct, owner } = claim.rows[0];
      const res = await client.query(
        `WITH old AS (SELECT discord_id, dkp_total FROM guild_memberships WHERE guild_id = $1 FOR UPDATE),
              upd AS (
                UPDATE guild_memberships gm SET dkp_total = round(o.dkp_total * $2::numeric)::integer
                FROM old o WHERE gm.guild_id = $1 AND gm.discord_id = o.discord_id
                RETURNING gm.discord_id, gm.dkp_total AS new_total, o.dkp_total AS old_total)
         INSERT INTO dkp_log (guild_id, actor_discord_id, target_discord_id, delta, reason)
         SELECT $1, $3, discord_id, new_total - old_total, $4 FROM upd WHERE new_total <> old_total`,
        [g.id, 1 - pct / 100, owner, `${DECAY_LOG_REASON} -${pct}%`]
      );
      return res.rowCount;
    });
    if (affected !== null) applied.push({ guildId: g.id, affected });
  }
  return applied;
}

// The DKP tab's "decay just ran" notice: the most recent scheduled decay
// in the last 48 hours, read back from the log it wrote. Null when none.
async function recentDecay(guild) {
  const res = await query(
    `SELECT max(created_at) AS "appliedAt", count(*)::int AS affected
     FROM dkp_log WHERE guild_id = $1 AND reason LIKE $2 AND created_at > now() - interval '48 hours'`,
    [guild.id, `${DECAY_LOG_REASON}%`]
  );
  const row = res.rows[0];
  return row.appliedAt ? { pct: guild.dkpDecayPct, affected: row.affected, appliedAt: row.appliedAt } : null;
}

// Officer/leader gate - same as adjustDkp, since this is a DKP setting
// like the rest of them, not a guild-structure decision
export async function setDecaySettings({ guildId, requesterDiscordId, pct, weekday }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  const requesterRole = await getMemberRole({ guildId, discordId: requesterDiscordId });
  if (requesterRole === "member") {
    throw new HttpError(403, "Only officers and the guild leader can set DKP decay.");
  }
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
    throw new HttpError(400, "Decay percentage must be a whole number between 0 and 100.");
  }
  const normalizedWeekday = pct === 0 ? null : weekday;
  if (pct > 0 && (!Number.isInteger(normalizedWeekday) || normalizedWeekday < 0 || normalizedWeekday > 6)) {
    throw new HttpError(400, "Pick a day of the week for decay to apply on.");
  }
  // A newly set decay starts at the NEXT occurrence of the chosen day, not
  // retroactively for one that already passed this week.
  await query(
    `UPDATE guilds SET dkp_decay_pct = $1, dkp_decay_weekday = $2,
       dkp_decay_last_applied = CASE WHEN $1::int > 0
         THEN GREATEST(COALESCE(dkp_decay_last_applied, '-infinity'::timestamptz), $4::timestamptz)
         ELSE dkp_decay_last_applied END
     WHERE id = $3`,
    [pct, normalizedWeekday, guildId, pct > 0 ? mostRecentOccurrence(normalizedWeekday) : null]
  );
}

// Every (Discord account, guild) pair with a DKP total and role, for the
// DKP tab - open to any member (mirrors getGuildWishlistTally), not
// owner/leader-only like listGuildMembers. Backfills membership rows for
// characters created before guild_memberships existed, so nothing needs a
// one-off migration script.
export async function listGuildRoster({ guildId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  const decayApplied = await recentDecay(guild);

  await query(
    `INSERT INTO guild_memberships (guild_id, discord_id)
     SELECT DISTINCT guild_id, discord_id FROM characters WHERE guild_id = $1
     ON CONFLICT (guild_id, discord_id) DO NOTHING`,
    [guildId]
  );

  const res = await query(
    `SELECT gm.discord_id AS "discordId", u.username, gm.dkp_total AS "dkpTotal", gm.is_officer AS "isOfficer",
            EXISTS (SELECT 1 FROM characters c WHERE c.guild_id = gm.guild_id AND c.discord_id = gm.discord_id) AS "inGuild",
            COALESCE((SELECT json_agg(c.name ORDER BY lower(c.name)) FROM characters c WHERE c.guild_id = gm.guild_id AND c.discord_id = gm.discord_id), '[]'::json) AS characters
     FROM guild_memberships gm
     JOIN users u ON u.discord_id = gm.discord_id
     WHERE gm.guild_id = $1
     ORDER BY u.username`,
    [guildId]
  );
  const ROLE_RANK = { leader: 0, officer: 1, member: 2 };
  const roster = res.rows
    .map((r) => ({
      discordId: r.discordId,
      username: r.username,
      dkpTotal: r.dkpTotal,
      inGuild: r.inGuild,
      characters: r.characters,
      role: roleFor({ guild, discordId: r.discordId, isOfficer: r.isOfficer }),
    }))
    // Leader, then officers, then members - alphabetical (already the
    // SQL order) within each tier.
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);
  return {
    roster,
    officerCap: OFFICER_CAP,
    decay: { pct: guild.dkpDecayPct, weekday: guild.dkpDecayWeekday },
    decayApplied,
  };
}

// Re-checks server-side that the requester is an officer or the leader -
// the UI hides the edit control from plain members, but that's a
// convenience gate only (see kickMember/transferOwnership for the same
// pattern elsewhere in this file). Delta-based (not an absolute set) so
// the same call handles both the per-row +/- box and the bulk "add 25
// to everyone selected" action - targetDiscordIds is always an array,
// one element for the single-row case.
export async function adjustDkp({ guildId, targetDiscordIds, requesterDiscordId, delta, reason }) {
  const requesterRole = await getMemberRole({ guildId, discordId: requesterDiscordId });
  if (requesterRole === "member") {
    throw new HttpError(403, "Only officers and the guild leader can edit DKP.");
  }
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_DKP_DELTA) {
    throw new HttpError(400, `DKP adjustment must be a non-zero whole number up to ${MAX_DKP_DELTA.toLocaleString("en-US")}.`);
  }
  if (!Array.isArray(targetDiscordIds) || !targetDiscordIds.every((id) => typeof id === "string")) {
    throw new HttpError(400, "No members selected.");
  }
  const ids = [...new Set(targetDiscordIds)].filter(Boolean);
  if (ids.length === 0) {
    throw new HttpError(400, "No members selected.");
  }
  // Only people who belong to this guild (a character, or a roster row -
  // kicked members keep theirs so their DKP survives a rejoin).
  const known = await query(
    `SELECT count(DISTINCT id)::int AS n FROM (
       SELECT discord_id AS id FROM characters WHERE guild_id = $1 AND discord_id = ANY($2::text[])
       UNION ALL
       SELECT discord_id FROM guild_memberships WHERE guild_id = $1 AND discord_id = ANY($2::text[])
     ) t`,
    [guildId, ids]
  );
  if (known.rows[0].n !== ids.length) {
    throw new HttpError(400, "Some selected people aren't members of this guild.");
  }
  const trimmedReason = (typeof reason === "string" ? reason : "").trim().slice(0, MAX_DKP_REASON_LENGTH) || null;
  await Promise.all(ids.map((discordId) => ensureGuildMembership({ guildId, discordId })));
  await query(
    `UPDATE guild_memberships SET dkp_total = dkp_total + $1 WHERE guild_id = $2 AND discord_id = ANY($3::text[])`,
    [delta, guildId, ids]
  );
  // One log row per target, not one row for the whole batch, so a
  // member's own history reads independently of who else was in the
  // same bulk action.
  await query(
    `INSERT INTO dkp_log (guild_id, actor_discord_id, target_discord_id, delta, reason)
     SELECT $1, $2, target_id, $4, $5 FROM unnest($3::text[]) AS target_id`,
    [guildId, requesterDiscordId, ids, delta, trimmedReason]
  );
}

// Drops a DKP-table row for someone who is no longer in the guild (kicked
// or left - they have no character here). Officer/leader gate, and the
// "no character" check lives in the DELETE itself so a simultaneous
// rejoin can't lose an active member's points. The audit log is kept.
export async function removeDkpMember({ guildId, targetDiscordId, requesterDiscordId }) {
  await requireEditor({ guildId, requesterDiscordId, action: "remove people from the DKP table" });
  const guild = await getGuildById(guildId);
  if (guild.owner_discord_id === targetDiscordId) {
    throw new HttpError(400, "The guild leader can't be removed from the DKP table.");
  }
  const res = await query(
    `DELETE FROM guild_memberships gm
     WHERE gm.guild_id = $1 AND gm.discord_id = $2
       AND NOT EXISTS (SELECT 1 FROM characters c WHERE c.guild_id = gm.guild_id AND c.discord_id = gm.discord_id)
     RETURNING 1`,
    [guildId, typeof targetDiscordId === "string" ? targetDiscordId : ""]
  );
  if (res.rows.length === 0) {
    throw new HttpError(400, "Only people who are no longer in the guild can be removed from the DKP table.");
  }
}

// Visible to any guild member (same openness as the DKP totals
// themselves) - the whole point of an audit trail is that everyone can
// see it happened, not just officers. Writing to it stays
// officer/leader-gated via adjustDkp above.
export async function getDkpLog({ guildId, limit = 50 }) {
  const res = await query(
    `SELECT l.id, l.delta, l.reason, l.created_at AS "createdAt",
            actor.username AS "actorUsername", target.username AS "targetUsername"
     FROM dkp_log l
     JOIN users actor ON actor.discord_id = l.actor_discord_id
     JOIN users target ON target.discord_id = l.target_discord_id
     WHERE l.guild_id = $1
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [guildId, limit]
  );
  return res.rows;
}

/* Per-item "who has this" lookup for the item detail panel - unlike
   getGuildWishlistTally (aggregate counts only, used for the Farm Plan
   badges), this deliberately surfaces WHO, since the point of the
   feature is finding someone to trade with or ask for a loaner. Two
   independent checks per character: `build`'s values are slot ->
   {itemId,...} so an equipped match needs a value-level scan
   (jsonb_each), while `wishlist` is keyed directly by itemId, so a
   wishlisted match is a plain key-existence check (`?`). A character
   can show up as both if it's equipped on one alt's build and
   wishlisted on another of the same person's characters. */
export async function getItemOwners({ guildId, itemId }) {
  const res = await query(
    `SELECT u.username, c.name AS "characterName",
            EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(c.build) = 'object' THEN c.build ELSE '{}'::jsonb END) b WHERE b.value->>'itemId' = $2) AS equipped,
            (c.wishlist ? $2) AS wishlisted
     FROM characters c
     JOIN users u ON u.discord_id = c.discord_id
     WHERE c.guild_id = $1
       AND (EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(c.build) = 'object' THEN c.build ELSE '{}'::jsonb END) b WHERE b.value->>'itemId' = $2) OR c.wishlist ? $2)
     ORDER BY u.username, c.name`,
    [guildId, itemId]
  );
  return res.rows;
}

/* Guild roster for the Members tab (leader and officers): one row per
   CHARACTER, with the Discord account it belongs to alongside, since
   guilds think in characters, not accounts. isOwner/isOfficer describe
   the account, so the UI can badge them and hide actions that don't
   apply. */
export async function listGuildMembers({ guildId }) {
  const res = await query(
    `SELECT c.id AS "characterId", c.name AS "characterName",
            u.discord_id AS "discordId", u.username,
            (u.discord_id = g.owner_discord_id) AS "isOwner",
            COALESCE(gm.is_officer, false) AS "isOfficer"
     FROM characters c
     JOIN users u ON u.discord_id = c.discord_id
     JOIN guilds g ON g.id = c.guild_id
     LEFT JOIN guild_memberships gm ON gm.guild_id = c.guild_id AND gm.discord_id = c.discord_id
     WHERE c.guild_id = $1
     ORDER BY lower(c.name), c.name`,
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
  await clearOfficer({ guildId, discordId: targetDiscordId });
}

/* Removes ONE character from this guild (leader or officer). Officers
   can only remove plain members' characters (or their own alts); only the
   leader can remove an officer's or the leader's. Removing an account's
   LAST character is a full kick, so its officer flag is dropped too
   (DKP is kept). Your own last character is refused - that's Leave
   Guild. Scoped to this guild, so a character id from another guild
   matches nothing; the row lock stops two removals from racing. */
export async function kickCharacter({ guildId, characterId, requesterDiscordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  const requesterRole = await getMemberRole({ guildId, discordId: requesterDiscordId });
  if (requesterRole === "member") {
    throw new HttpError(403, "Only officers and the guild leader can remove characters.");
  }
  const { targetDiscordId, remaining } = await withTransaction(async (client) => {
    const target = await client.query(`SELECT discord_id FROM characters WHERE id = $1 AND guild_id = $2`, [characterId, guildId]);
    if (target.rows.length === 0) throw new HttpError(404, "Character not found.");
    const targetDiscordId = target.rows[0].discord_id;
    const isSelf = targetDiscordId === requesterDiscordId;
    if (!isSelf && requesterRole !== "leader") {
      const om = await client.query(`SELECT is_officer FROM guild_memberships WHERE guild_id = $1 AND discord_id = $2`, [guildId, targetDiscordId]);
      if (guild.owner_discord_id === targetDiscordId || om.rows[0]?.is_officer) {
        throw new HttpError(403, "Only the guild leader can remove an officer's or the leader's characters.");
      }
    }
    const mine = await client.query(`SELECT id FROM characters WHERE discord_id = $1 AND guild_id = $2 FOR UPDATE`, [targetDiscordId, guildId]);
    if (isSelf && mine.rows.length < 2) {
      throw new HttpError(400, "That's your only character here - use Leave Guild instead.");
    }
    await client.query(`DELETE FROM characters WHERE id = $1 AND guild_id = $2`, [characterId, guildId]);
    return { targetDiscordId, remaining: mine.rows.length - 1 };
  });
  if (remaining === 0) await clearOfficer({ guildId, discordId: targetDiscordId });
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

const LEADER_INACTIVITY_DAYS = 14;

/* "Leave guild" for someone who left it in-game: deletes ALL of the
   signed-in user's characters in this guild (every alt, not just the
   active one) - PIN access isn't real membership (anyone with the
   PIN can rejoin any time), so the meaningful thing to revoke is
   their own build/wishlist data living under this guild, not access
   to it. discordId is part of the WHERE clause, same pattern as
   saveCharacterData, so this can never touch another member's rows.

   If the LEADER leaves, the guild would otherwise be left with
   owner_discord_id pointing at someone with zero characters in it -
   effectively leaderless (no one could promote/demote officers, kick
   anyone, or delete the guild). Hand leadership to another real member
   first - an officer if one exists (by earliest-joined), otherwise the
   longest-standing plain member. Picked from `characters`, not
   `guild_memberships`, since a membership row can outlive someone
   actually leaving (see kickMember/leaveGuild - neither cleans up
   guild_memberships, only characters). If no one else is in the guild,
   it's left ownerless same as before - nothing to hand off to. */
export async function leaveGuild({ discordId, guildId }) {
  const guild = await getGuildById(guildId);
  if (guild && guild.owner_discord_id === discordId) {
    const candidate = await query(
      `SELECT c.discord_id AS "discordId"
       FROM characters c
       LEFT JOIN guild_memberships gm ON gm.guild_id = c.guild_id AND gm.discord_id = c.discord_id
       WHERE c.guild_id = $1 AND c.discord_id != $2
       GROUP BY c.discord_id
       ORDER BY bool_or(COALESCE(gm.is_officer, false)) DESC, min(c.created_at) ASC
       LIMIT 1`,
      [guildId, discordId]
    );
    if (candidate.rows.length > 0) {
      await query(`UPDATE guilds SET owner_discord_id = $1 WHERE id = $2`, [candidate.rows[0].discordId, guildId]);
    }
  }
  await query(`DELETE FROM characters WHERE discord_id = $1 AND guild_id = $2`, [discordId, guildId]);
  await clearOfficer({ guildId, discordId });
}

// The leader's last sign-in OR last time they opened the app, whichever is
// newer (users.last_login_at moves on a Discord sign-in, last_seen_at on
// real use - see upsertUser/touchLastSeen in src/lib/db.js). Sign-in alone
// isn't activity: a session lasts 30 days, so a leader using the app daily
// would look inactive after 14. Null when neither has ever been recorded.
async function leaderLastActive(leaderDiscordId) {
  const res = await query(
    `SELECT GREATEST(last_login_at, last_seen_at) AS "lastActive" FROM users WHERE discord_id = $1`,
    [leaderDiscordId]
  );
  return res.rows[0]?.lastActive ?? null;
}

// Anyone with a character in the guild can claim leadership once the
// current leader has gone LEADER_INACTIVITY_DAYS without signing in or
// opening the app. A leader with no recorded activity at all is treated as
// "not stale" rather than instantly claimable.
export async function claimLeadership({ guildId, requesterDiscordId }) {
  const guild = await getGuildById(guildId);
  if (!guild) throw new HttpError(404, "Guild not found.");
  if (guild.owner_discord_id === requesterDiscordId) {
    throw new HttpError(400, "You're already the leader.");
  }
  const member = await query(`SELECT 1 FROM characters WHERE discord_id = $1 AND guild_id = $2 LIMIT 1`, [requesterDiscordId, guildId]);
  if (member.rows.length === 0) {
    throw new HttpError(403, "You must be a member of this guild to claim leadership.");
  }
  const lastActive = await leaderLastActive(guild.owner_discord_id);
  if (!lastActive) {
    throw new HttpError(400, "The current leader's activity isn't tracked yet - leadership can't be claimed until they use the app at least once more.");
  }
  const daysSince = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < LEADER_INACTIVITY_DAYS) {
    throw new HttpError(400, `The guild leader was active ${Math.floor(daysSince)} day(s) ago - leadership can only be claimed after ${LEADER_INACTIVITY_DAYS} days of inactivity.`);
  }
  await query(`UPDATE guilds SET owner_discord_id = $1 WHERE id = $2`, [requesterDiscordId, guildId]);
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
  let guild = null;
  if (guildRow) {
    const isOwner = guildRow.owner_discord_id === discordId;
    // canClaimLeadership surfaces the same LEADER_INACTIVITY_DAYS check
    // claimLeadership re-verifies server-side - this is only so the
    // client knows whether to show the "Claim Leadership" prompt at
    // all, never trusted as authorization on its own.
    let canClaimLeadership = false;
    let isOfficer = false;
    if (!isOwner) {
      const gm = await query(`SELECT is_officer FROM guild_memberships WHERE guild_id = $1 AND discord_id = $2`, [guildRow.id, discordId]);
      isOfficer = gm.rows[0]?.is_officer === true;
      const lastActive = await leaderLastActive(guildRow.owner_discord_id);
      if (lastActive) {
        const daysSince = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
        canClaimLeadership = daysSince >= LEADER_INACTIVITY_DAYS;
      }
    }
    // isOwner, not the raw owner_discord_id, is what the client gets -
    // no reason to expose another account's id to every guildmate.
    guild = { id: guildRow.id, name: guildRow.name, isOwner, isOfficer, canClaimLeadership };
  }
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

const PARTY_GROUP_COUNT = 10;
const PARTY_SLOT_COUNT = 6;

// Coerces whatever the client sent into exactly PARTY_GROUP_COUNT
// groups of PARTY_SLOT_COUNT slots (extra trimmed, missing padded
// blank) rather than rejecting anything short of perfect shape -
// the board's dimensions are fixed by the UI, not something a
// template is allowed to vary, but a slightly-off payload (e.g. an
// older client) shouldn't hard-fail a save. Each slot is a
// {member, className} pair - `member` a discordId, `className` one of
// CLASS_ROLES (src/lib/gameData.js), either half independently
// optional. A bare string is also accepted as a slot value and read as
// a class-only assignment, so boards saved before this pairing existed
// still load instead of silently losing their data.
function normalizePartyGroups(groups) {
  const input = Array.isArray(groups) ? groups : [];
  const out = [];
  for (let i = 0; i < PARTY_GROUP_COUNT; i++) {
    const g = input[i] || {};
    const slotsIn = Array.isArray(g.slots) ? g.slots : [];
    const slots = [];
    for (let s = 0; s < PARTY_SLOT_COUNT; s++) {
      const v = slotsIn[s];
      if (typeof v === "string") {
        slots.push({ member: null, className: v || null });
      } else if (v && typeof v === "object") {
        slots.push({
          member: typeof v.member === "string" && v.member ? v.member : null,
          className: typeof v.className === "string" && v.className ? v.className : null,
        });
      } else {
        slots.push({ member: null, className: null });
      }
    }
    out.push({ name: typeof g.name === "string" ? g.name.slice(0, 60) : "", slots });
  }
  return out;
}

// Roster for the Party Planner's per-slot member dropdown - just
// (discordId, username), one row per account regardless of how many
// characters/alts it has in this guild (unlike listGuildMembers, which
// nests characters and is owner-only). Open to any member, same as the
// DKP roster, since assigning "who's in which group" isn't sensitive.
export async function listGuildMemberNames({ guildId }) {
  const res = await query(
    `SELECT DISTINCT u.discord_id AS "discordId", u.username
     FROM characters c JOIN users u ON u.discord_id = c.discord_id
     WHERE c.guild_id = $1 ORDER BY u.username`,
    [guildId]
  );
  return res.rows;
}

export async function listPartyTemplates({ guildId }) {
  const res = await query(
    `SELECT id, name, groups, updated_at AS "updatedAt" FROM party_templates WHERE guild_id = $1 ORDER BY name`,
    [guildId]
  );
  return res.rows;
}

// Officer/leader gate, same pattern as adjustDkp/setDecaySettings -
// party comp is guild-structure like DKP editing, not leader-only
// like officer assignment.
async function requireEditor({ guildId, requesterDiscordId, action }) {
  const requesterRole = await getMemberRole({ guildId, discordId: requesterDiscordId });
  if (requesterRole === "member") {
    throw new HttpError(403, `Only officers and the guild leader can ${action}.`);
  }
}

export async function createPartyTemplate({ guildId, requesterDiscordId, name, groups }) {
  await requireEditor({ guildId, requesterDiscordId, action: "save party templates" });
  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new HttpError(400, "Template name is required.");
  const res = await query(
    `INSERT INTO party_templates (guild_id, name, groups, created_by) VALUES ($1, $2, $3, $4)
     RETURNING id, name, groups, updated_at AS "updatedAt"`,
    [guildId, trimmedName, JSON.stringify(normalizePartyGroups(groups)), requesterDiscordId]
  );
  return res.rows[0];
}

export async function updatePartyTemplate({ guildId, templateId, requesterDiscordId, name, groups }) {
  await requireEditor({ guildId, requesterDiscordId, action: "edit party templates" });
  const fields = [];
  const values = [];
  if (name !== undefined) {
    const trimmedName = (name || "").trim();
    if (!trimmedName) throw new HttpError(400, "Template name is required.");
    values.push(trimmedName);
    fields.push(`name = $${values.length}`);
  }
  if (groups !== undefined) {
    values.push(JSON.stringify(normalizePartyGroups(groups)));
    fields.push(`groups = $${values.length}`);
  }
  if (fields.length === 0) return;
  fields.push(`updated_at = now()`);
  values.push(guildId);
  values.push(templateId);
  const res = await query(
    `UPDATE party_templates SET ${fields.join(", ")} WHERE guild_id = $${values.length - 1} AND id = $${values.length}
     RETURNING id, name, groups, updated_at AS "updatedAt"`,
    values
  );
  if (res.rows.length === 0) throw new HttpError(404, "Template not found.");
  return res.rows[0];
}

export async function deletePartyTemplate({ guildId, templateId, requesterDiscordId }) {
  await requireEditor({ guildId, requesterDiscordId, action: "delete party templates" });
  const res = await query(`DELETE FROM party_templates WHERE guild_id = $1 AND id = $2 RETURNING id`, [guildId, templateId]);
  if (res.rows.length === 0) throw new HttpError(404, "Template not found.");
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

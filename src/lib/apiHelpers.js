import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { isAdmin } from "@/lib/admin";
import { HttpError } from "@/lib/guilds";
import { query } from "@/lib/db";

/* Every route handler needs some subset of "who is this", "which
   guild are they in", and "are they allowed to do this" before its
   real work starts - these throw the same HttpError the lib layer
   already uses for business-rule failures, so one try/catch per
   handler (via errorResponse) covers guards and logic alike. */

export async function requireDiscordId(message = "Not signed in.") {
  const session = await auth();
  if (!session?.user?.discordId) throw new HttpError(401, message);
  return session.user.discordId;
}

/* The active_character cookie is unsigned, so its guildId is only a
   claim - accept it only if this Discord account really has a
   character in that guild (which is what the PIN join creates, and
   what kick/leave deletes). Returns null for no cookie, a forged or
   malformed id, or someone no longer in the guild. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getVerifiedActiveGuild(discordId) {
  const active = await getActiveCharacter();
  if (!active || typeof active.guildId !== "string" || !UUID_RE.test(active.guildId)) return null;
  const res = await query(`SELECT 1 FROM characters WHERE discord_id = $1 AND guild_id = $2 LIMIT 1`, [
    discordId,
    active.guildId,
  ]);
  return res.rows.length > 0 ? active : null;
}

export async function requireActiveGuild(message = "No active guild.") {
  const discordId = await requireDiscordId();
  const active = await getVerifiedActiveGuild(discordId);
  if (!active) throw new HttpError(400, message);
  return active;
}

export async function requireAdmin() {
  const discordId = await requireDiscordId();
  if (!isAdmin(discordId)) throw new HttpError(403, "Admin access only.");
  return discordId;
}

export function errorResponse(e) {
  const status = e instanceof HttpError ? e.status : 500;
  return NextResponse.json({ error: e.message }, { status });
}

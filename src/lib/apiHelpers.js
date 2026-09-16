import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { isAdmin } from "@/lib/admin";
import { HttpError } from "@/lib/guilds";

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

export async function requireActiveGuild(message = "No active guild.") {
  const active = await getActiveCharacter();
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

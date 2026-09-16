import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { clearActiveCharacter } from "@/lib/guildSession";
import { deleteGuild } from "@/lib/guilds";

// POST /api/guild/delete - deletes the requester's CURRENT guild
// (from the active_character cookie) entirely, taking every member's
// characters with it. deleteGuild re-checks ownership server-side.
// Any other member whose cookie still points here just hits the
// existing stale-cookie fallback on their next /api/character call.
export async function POST() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    await deleteGuild({ guildId: active.guildId, requesterDiscordId: discordId });
    await clearActiveCharacter();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

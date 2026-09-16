import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { clearActiveCharacter } from "@/lib/guildSession";
import { leaveGuild } from "@/lib/guilds";

// POST /api/character/leave - for someone who left the guild in-game.
// Deletes every character the signed-in user has in their CURRENT
// guild (all alts, not just the active one) and clears the
// active_character cookie, sending them back to /guild to find or
// register wherever they landed next.
export async function POST() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    await leaveGuild({ discordId, guildId: active.guildId });
    await clearActiveCharacter();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

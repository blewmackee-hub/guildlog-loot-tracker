import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { getGuildById, listGuildMembers, HttpError } from "@/lib/guilds";

// GET /api/guild/members - owner-only roster of the signed-in user's
// CURRENT guild (from the active_character cookie), each member's
// Discord username plus their character names. Ownership is
// re-checked server-side; a non-owner gets a 403, not a member list.
export async function GET() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const guild = await getGuildById(active.guildId);
    if (!guild || guild.owner_discord_id !== discordId) {
      throw new HttpError(403, "Only the guild owner can view members.");
    }
    const members = await listGuildMembers({ guildId: active.guildId });
    return NextResponse.json({ members });
  } catch (e) {
    return errorResponse(e);
  }
}

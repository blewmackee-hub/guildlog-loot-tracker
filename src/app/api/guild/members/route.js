import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { getMemberRole, listGuildMembers, HttpError } from "@/lib/guilds";

// GET /api/guild/members - roster of the signed-in user's CURRENT guild,
// one row per character (with the Discord account it belongs to), for
// the Members tab. Leader and officers only - re-checked here; a plain
// member gets a 403.
export async function GET() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const myRole = await getMemberRole({ guildId: active.guildId, discordId });
    if (myRole === "member") {
      throw new HttpError(403, "Only officers and the guild leader can view members.");
    }
    const members = await listGuildMembers({ guildId: active.guildId });
    return NextResponse.json({ members, myRole, me: discordId });
  } catch (e) {
    return errorResponse(e);
  }
}

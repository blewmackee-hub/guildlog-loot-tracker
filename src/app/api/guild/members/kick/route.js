import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { kickMember, kickCharacter } from "@/lib/guilds";

// POST /api/guild/members/kick { characterId } removes just that one
// character (an alt) instead - see kickCharacter.
// POST /api/guild/members/kick { discordId } - removes every
// character the target has in the requester's CURRENT guild (from
// the active_character cookie). kickMember re-checks that the
// requester actually owns that guild - this route never trusts a
// client-asserted guildId or "I'm the owner" claim.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    if (body.characterId) {
      await kickCharacter({ guildId: active.guildId, characterId: body.characterId, requesterDiscordId: discordId });
      return NextResponse.json({ ok: true });
    }
    await kickMember({ guildId: active.guildId, targetDiscordId: body.discordId, requesterDiscordId: discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

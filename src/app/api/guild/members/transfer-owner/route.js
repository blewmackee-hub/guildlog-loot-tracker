import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { transferOwnership } from "@/lib/guilds";

// POST /api/guild/members/transfer-owner { discordId } - hands the
// requester's CURRENT guild (from the active_character cookie) to
// another member. transferOwnership re-checks the requester actually
// owns it and that the target already has a character there.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await transferOwnership({ guildId: active.guildId, newOwnerDiscordId: body.discordId, requesterDiscordId: discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

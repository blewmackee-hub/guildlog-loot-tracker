import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { changeGuildPin } from "@/lib/guilds";

// POST /api/guild/pin { pin } - sets a new join PIN on the requester's
// CURRENT guild. Owner-only; changeGuildPin re-checks ownership.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await changeGuildPin({ guildId: active.guildId, requesterDiscordId: discordId, pin: body.pin });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

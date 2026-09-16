import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { setOfficer } from "@/lib/guilds";

// POST /api/guild/officers { discordId, makeOfficer } - promotes or
// demotes a member to/from officer in the signed-in user's CURRENT
// guild. Leader-only, capped at the officer slot limit - setOfficer
// re-checks both server-side.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await setOfficer({
      guildId: active.guildId,
      targetDiscordId: body.discordId,
      requesterDiscordId: discordId,
      makeOfficer: !!body.makeOfficer,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

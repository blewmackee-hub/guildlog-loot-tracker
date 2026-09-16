import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { claimLeadership } from "@/lib/guilds";

// POST /api/guild/claim-leadership - hands ownership of the signed-in
// user's CURRENT guild to them, if the current leader has gone 10+
// days without a real Discord sign-in. claimLeadership re-checks
// server-side that the requester is an actual member and the leader is
// genuinely stale - the client's "Claim Leadership" prompt (gated on
// guild.canClaimLeadership from GET /api/character) is a convenience
// display only, never trusted as authorization on its own.
export async function POST() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    await claimLeadership({ guildId: active.guildId, requesterDiscordId: discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

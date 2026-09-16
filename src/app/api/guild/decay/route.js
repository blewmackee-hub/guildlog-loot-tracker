import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { setDecaySettings } from "@/lib/guilds";

// POST /api/guild/decay { pct, weekday } - sets the signed-in user's
// CURRENT guild's weekly DKP decay (pct 0 disables it). There's no cron
// job behind this - decay is applied lazily the next time anyone loads
// the DKP tab on or after the chosen day (see applyDueDecay in
// src/lib/guilds.js). setDecaySettings re-checks server-side that the
// requester is an officer or the guild leader - never trusts a
// client-asserted role.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await setDecaySettings({ guildId: active.guildId, requesterDiscordId: discordId, pct: body.pct, weekday: body.weekday });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

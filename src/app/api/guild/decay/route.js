import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { setDecaySettings, HttpError } from "@/lib/guilds";

// POST /api/guild/decay { pct, weekday } - sets the signed-in user's
// CURRENT guild's weekly DKP decay (pct 0 disables it). There's no cron
// job behind this - decay is applied lazily the next time anyone loads
// the DKP tab on or after the chosen day (see applyDueDecay in
// src/lib/guilds.js). setDecaySettings re-checks server-side that the
// requester is an officer or the guild leader - never trusts a
// client-asserted role.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  const body = await request.json();
  try {
    await setDecaySettings({
      guildId: active.guildId,
      requesterDiscordId: session.user.discordId,
      pct: body.pct,
      weekday: body.weekday,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

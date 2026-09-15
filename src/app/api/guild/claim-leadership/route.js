import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { claimLeadership, HttpError } from "@/lib/guilds";

// POST /api/guild/claim-leadership - hands ownership of the signed-in
// user's CURRENT guild to them, if the current leader has gone 10+
// days without a real Discord sign-in. claimLeadership re-checks
// server-side that the requester is an actual member and the leader is
// genuinely stale - the client's "Claim Leadership" prompt (gated on
// guild.canClaimLeadership from GET /api/character) is a convenience
// display only, never trusted as authorization on its own.
export async function POST() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  try {
    await claimLeadership({ guildId: active.guildId, requesterDiscordId: session.user.discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

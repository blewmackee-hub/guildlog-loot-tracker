import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { listGuildRoster, adjustDkp, getDkpLog, HttpError } from "@/lib/guilds";

// GET /api/guild/dkp - every member of the signed-in user's CURRENT
// guild with their DKP total and role, the requester's own role (so
// the client knows whether to show edit controls), and the recent
// adjustment history. Open to any member, not leader/officer-only -
// same openness as wishlist-tally, since DKP totals (and who changed
// them) are meant to be visible to the whole guild.
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  try {
    const [{ roster, officerCap, decay }, log] = await Promise.all([
      listGuildRoster({ guildId: active.guildId }),
      getDkpLog({ guildId: active.guildId }),
    ]);
    const me = roster.find((m) => m.discordId === session.user.discordId);
    return NextResponse.json({ roster, officerCap, decay, log, myRole: me?.role ?? "member" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// POST /api/guild/dkp { discordIds: [...], delta, reason? } - adds
// `delta` (negative to subtract) to every listed member's DKP total
// and records one audit-log row per target. Always an array so the
// same endpoint covers a single row's +/- box and the "apply to
// everyone selected" bulk action. adjustDkp re-checks server-side that
// the requester is an officer or the leader in THIS guild - never
// trusts a client-asserted role.
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
    await adjustDkp({
      guildId: active.guildId,
      targetDiscordIds: body.discordIds,
      requesterDiscordId: session.user.discordId,
      delta: body.delta,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { setOfficer, HttpError } from "@/lib/guilds";

// POST /api/guild/officers { discordId, makeOfficer } - promotes or
// demotes a member to/from officer in the signed-in user's CURRENT
// guild. Leader-only, capped at the officer slot limit - setOfficer
// re-checks both server-side.
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
    await setOfficer({
      guildId: active.guildId,
      targetDiscordId: body.discordId,
      requesterDiscordId: session.user.discordId,
      makeOfficer: !!body.makeOfficer,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

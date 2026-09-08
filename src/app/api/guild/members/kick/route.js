import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { kickMember, HttpError } from "@/lib/guilds";

// POST /api/guild/members/kick { discordId } - removes every
// character the target has in the requester's CURRENT guild (from
// the active_character cookie). kickMember re-checks that the
// requester actually owns that guild - this route never trusts a
// client-asserted guildId or "I'm the owner" claim.
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
    await kickMember({
      guildId: active.guildId,
      targetDiscordId: body.discordId,
      requesterDiscordId: session.user.discordId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

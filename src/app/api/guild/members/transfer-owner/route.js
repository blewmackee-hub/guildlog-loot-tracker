import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { transferOwnership, HttpError } from "@/lib/guilds";

// POST /api/guild/members/transfer-owner { discordId } - hands the
// requester's CURRENT guild (from the active_character cookie) to
// another member. transferOwnership re-checks the requester actually
// owns it and that the target already has a character there.
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
    await transferOwnership({
      guildId: active.guildId,
      newOwnerDiscordId: body.discordId,
      requesterDiscordId: session.user.discordId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

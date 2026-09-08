import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter, clearActiveCharacter } from "@/lib/guildSession";
import { deleteGuild, HttpError } from "@/lib/guilds";

// POST /api/guild/delete - deletes the requester's CURRENT guild
// (from the active_character cookie) entirely, taking every member's
// characters with it. deleteGuild re-checks ownership server-side.
// Any other member whose cookie still points here just hits the
// existing stale-cookie fallback on their next /api/character call.
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
    await deleteGuild({ guildId: active.guildId, requesterDiscordId: session.user.discordId });
    await clearActiveCharacter();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

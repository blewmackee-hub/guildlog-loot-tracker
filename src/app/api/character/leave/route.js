import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter, clearActiveCharacter } from "@/lib/guildSession";
import { leaveGuild } from "@/lib/guilds";

// POST /api/character/leave - for someone who left the guild in-game.
// Deletes every character the signed-in user has in their CURRENT
// guild (all alts, not just the active one) and clears the
// active_character cookie, sending them back to /guild to find or
// register wherever they landed next.
export async function POST() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  await leaveGuild({ discordId: session.user.discordId, guildId: active.guildId });
  await clearActiveCharacter();
  return NextResponse.json({ ok: true });
}

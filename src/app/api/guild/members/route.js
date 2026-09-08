import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { getGuildById, listGuildMembers } from "@/lib/guilds";

// GET /api/guild/members - owner-only roster of the signed-in user's
// CURRENT guild (from the active_character cookie), each member's
// Discord username plus their character names. Ownership is
// re-checked server-side; a non-owner gets a 403, not a member list.
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  const guild = await getGuildById(active.guildId);
  if (!guild || guild.owner_discord_id !== session.user.discordId) {
    return NextResponse.json({ error: "Only the guild owner can view members." }, { status: 403 });
  }
  const members = await listGuildMembers({ guildId: active.guildId });
  return NextResponse.json({ members });
}

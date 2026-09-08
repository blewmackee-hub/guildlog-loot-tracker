import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setActiveCharacter } from "@/lib/guildSession";
import { getCharacterContext } from "@/lib/guilds";

// POST /api/character/switch { characterId } - swap the active
// character cookie to another of the signed-in user's characters. No
// PIN needed: guild membership was already proven when this
// character (or a sibling in the same guild) was first joined - this
// only lets someone pick among characters THEY own, re-checked via
// discordId inside getCharacterContext's WHERE clause.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const body = await request.json();
  const ctx = await getCharacterContext({ discordId: session.user.discordId, characterId: body.characterId });
  if (!ctx) {
    return NextResponse.json({ error: "Character not found." }, { status: 404 });
  }
  await setActiveCharacter({ guildId: ctx.character.guild_id, characterId: ctx.character.id });
  return NextResponse.json(ctx);
}

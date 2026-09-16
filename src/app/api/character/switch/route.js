import { NextResponse } from "next/server";
import { requireDiscordId, errorResponse } from "@/lib/apiHelpers";
import { setActiveCharacter } from "@/lib/guildSession";
import { getCharacterContext, HttpError } from "@/lib/guilds";

// POST /api/character/switch { characterId } - swap the active
// character cookie to another of the signed-in user's characters. No
// PIN needed: guild membership was already proven when this
// character (or a sibling in the same guild) was first joined - this
// only lets someone pick among characters THEY own, re-checked via
// discordId inside getCharacterContext's WHERE clause.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const body = await request.json();
    const ctx = await getCharacterContext({ discordId, characterId: body.characterId });
    if (!ctx) throw new HttpError(404, "Character not found.");
    await setActiveCharacter({ guildId: ctx.character.guild_id, characterId: ctx.character.id });
    return NextResponse.json(ctx);
  } catch (e) {
    return errorResponse(e);
  }
}

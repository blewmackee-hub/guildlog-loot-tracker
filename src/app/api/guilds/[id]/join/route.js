import { NextResponse } from "next/server";
import { requireDiscordId, errorResponse } from "@/lib/apiHelpers";
import { verifyGuildPin, getOrCreateCharacter } from "@/lib/guilds";
import { setActiveCharacter } from "@/lib/guildSession";

// POST /api/guilds/[id]/join { pin, characterName? } - the PIN check
// that turns "I found my guild" into an actual character. Rate
// limited inside verifyGuildPin (5 wrong PINs / 15 min per
// guild+Discord-account pair, see src/lib/guilds.js).
export async function POST(request, { params }) {
  try {
    const discordId = await requireDiscordId("Sign in with Discord first.");
    const { id: guildId } = await params; // Next.js 16: route params are async
    const body = await request.json();
    await verifyGuildPin({ guildId, pin: body.pin, discordId });
    const character = await getOrCreateCharacter({ discordId, guildId, name: body.characterName });
    await setActiveCharacter({ guildId, characterId: character.id });
    return NextResponse.json({ character });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyGuildPin, getOrCreateCharacter, HttpError } from "@/lib/guilds";
import { setActiveCharacter } from "@/lib/guildSession";

// POST /api/guilds/[id]/join { pin, characterName? } - the PIN check
// that turns "I found my guild" into an actual character. Rate
// limited inside verifyGuildPin (5 wrong PINs / 15 min per
// guild+Discord-account pair, see src/lib/guilds.js).
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  }
  const { id: guildId } = await params; // Next.js 16: route params are async
  const body = await request.json();
  try {
    await verifyGuildPin({ guildId, pin: body.pin, discordId: session.user.discordId });
    const character = await getOrCreateCharacter({
      discordId: session.user.discordId,
      guildId,
      name: body.characterName,
    });
    await setActiveCharacter({ guildId, characterId: character.id });
    return NextResponse.json({ character });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

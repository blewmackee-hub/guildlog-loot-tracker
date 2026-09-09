import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter, setActiveCharacter } from "@/lib/guildSession";
import { saveCharacterData, getOrCreateCharacter, getCharacterContext } from "@/lib/guilds";
import { isAdmin } from "@/lib/admin";

// GET /api/character - the signed-in user's currently active
// character (per the active_character cookie set by /join or
// /switch), plus its sibling characters in the same guild (for the
// "Playing as" switcher) and the guild's own name. isSiteAdmin just
// tells the client whether to show the /admin link - the route
// itself re-checks isAdmin server-side regardless.
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const isSiteAdmin = isAdmin(session.user.discordId);
  const active = await getActiveCharacter();
  if (!active) return NextResponse.json({ character: null, guild: null, characters: [], isSiteAdmin });

  const ctx = await getCharacterContext({ discordId: session.user.discordId, characterId: active.characterId });
  return NextResponse.json(ctx ? { ...ctx, isSiteAdmin } : { character: null, guild: null, characters: [], isSiteAdmin });
}

// POST /api/character { name } - create a new alt character in the
// CURRENT guild (from the active_character cookie) and switch to it.
// getOrCreateCharacter is idempotent on (discordId, guildId, name),
// so re-submitting an existing name just switches to it instead of
// erroring.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild - join one first." }, { status: 400 });
  }
  const body = await request.json();
  const character = await getOrCreateCharacter({
    discordId: session.user.discordId,
    guildId: active.guildId,
    name: body.name,
  });
  await setActiveCharacter({ guildId: active.guildId, characterId: character.id });
  const ctx = await getCharacterContext({ discordId: session.user.discordId, characterId: character.id });
  return NextResponse.json(ctx);
}

// PUT /api/character { build, wishlist } - saves onto whichever
// character the active_character cookie points at. discordId is
// re-checked server-side in saveCharacterData, not just trusted from
// the cookie.
export async function PUT(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active character - join a guild first." }, { status: 400 });
  }
  const body = await request.json();
  await saveCharacterData({
    characterId: active.characterId,
    discordId: session.user.discordId,
    build: body.build ?? {},
    wishlist: body.wishlist ?? {},
  });
  return NextResponse.json({ ok: true });
}

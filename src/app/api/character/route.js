import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, getVerifiedActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { setActiveCharacter } from "@/lib/guildSession";
import { query, touchLastSeen } from "@/lib/db";
import { saveCharacterData, getOrCreateCharacter, getCharacterContext, deleteCharacter } from "@/lib/guilds";
import { isAdmin } from "@/lib/admin";

// GET /api/character - the signed-in user's currently active
// character (per the active_character cookie set by /join or
// /switch), plus its sibling characters in the same guild (for the
// "Playing as" switcher) and the guild's own name. isSiteAdmin just
// tells the client whether to show the /admin link - the route
// itself re-checks isAdmin server-side regardless.
export async function GET() {
  try {
    const discordId = await requireDiscordId();
    await touchLastSeen(discordId);
    const isSiteAdmin = isAdmin(discordId);
    const active = await getVerifiedActiveGuild(discordId);
    if (!active) return NextResponse.json({ character: null, guild: null, characters: [], isSiteAdmin });

    let ctx = await getCharacterContext({ discordId, characterId: active.characterId });
    if (!ctx) {
      // The active character is gone (removed by the guild owner, or
      // deleted elsewhere) - fall back to another of this account's
      // characters in the same guild rather than dropping to the guild picker.
      const next = await query(`SELECT id FROM characters WHERE discord_id = $1 AND guild_id = $2 ORDER BY created_at LIMIT 1`, [discordId, active.guildId]);
      if (next.rows[0]) {
        await setActiveCharacter({ guildId: active.guildId, characterId: next.rows[0].id });
        ctx = await getCharacterContext({ discordId, characterId: next.rows[0].id });
      }
    }
    return NextResponse.json(ctx ? { ...ctx, isSiteAdmin } : { character: null, guild: null, characters: [], isSiteAdmin });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/character { name } - create a new alt character in the
// CURRENT guild (from the active_character cookie) and switch to it.
// getOrCreateCharacter is idempotent on (discordId, guildId, name),
// so re-submitting an existing name just switches to it instead of
// erroring.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild("No active guild - join one first.");
    const body = await request.json();
    const character = await getOrCreateCharacter({ discordId, guildId: active.guildId, name: body.name });
    await setActiveCharacter({ guildId: active.guildId, characterId: character.id });
    const ctx = await getCharacterContext({ discordId, characterId: character.id });
    return NextResponse.json(ctx);
  } catch (e) {
    return errorResponse(e);
  }
}

// PUT /api/character { build, wishlist } - saves onto whichever
// character the active_character cookie points at. discordId is
// re-checked server-side in saveCharacterData, not just trusted from
// the cookie.
export async function PUT(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild("No active character - join a guild first.");
    const body = await request.json();
    await saveCharacterData({
      characterId: active.characterId,
      discordId,
      build: body.build ?? {},
      wishlist: body.wishlist ?? {},
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/character { characterId } - deletes one of the signed-in
// user's own alts (never someone else's, never their last one in the
// guild - see deleteCharacter). If it was the active character, the
// cookie moves to another of theirs; the response is that active
// character's context, same shape as POST/switch.
export async function DELETE(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    const { nextCharacterId } = await deleteCharacter({ discordId, characterId: body.characterId });
    const activeId = active.characterId === body.characterId ? nextCharacterId : active.characterId;
    if (activeId !== active.characterId) await setActiveCharacter({ guildId: active.guildId, characterId: activeId });
    return NextResponse.json(await getCharacterContext({ discordId, characterId: activeId }));
  } catch (e) {
    return errorResponse(e);
  }
}

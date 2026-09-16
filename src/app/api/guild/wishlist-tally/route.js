import { NextResponse } from "next/server";
import { requireDiscordId, errorResponse } from "@/lib/apiHelpers";
import { getActiveCharacter } from "@/lib/guildSession";
import { getGuildWishlistTally } from "@/lib/guilds";

// GET /api/guild/wishlist-tally - how many characters in the signed-in
// user's CURRENT guild have each item wishlisted (item id -> count),
// for the Farm Plan tab's "N wishlisted" badges. Open to any member,
// not owner-only - unlike /api/guild/members, this returns aggregate
// counts only, never whose wishlist an item came from, so there's
// nothing here more sensitive than "this many people want this."
export async function GET() {
  try {
    await requireDiscordId();
    const active = await getActiveCharacter();
    if (!active) return NextResponse.json({ tally: {} });
    const tally = await getGuildWishlistTally({ guildId: active.guildId });
    return NextResponse.json({ tally });
  } catch (e) {
    return errorResponse(e);
  }
}

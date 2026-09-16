import { NextResponse } from "next/server";
import { requireDiscordId, errorResponse } from "@/lib/apiHelpers";
import { getActiveCharacter } from "@/lib/guildSession";
import { getItemOwners, HttpError } from "@/lib/guilds";

// GET /api/guild/item-owners?itemId=... - which of the signed-in
// user's guildmates have this item equipped or wishlisted, for the
// item detail panel's "Guild" section. Open to any member, same as
// wishlist-tally - unlike that endpoint this deliberately names names,
// since the point is finding who to ask about a trade or loaner.
export async function GET(request) {
  try {
    await requireDiscordId();
    const active = await getActiveCharacter();
    if (!active) return NextResponse.json({ owners: [] });
    const itemId = new URL(request.url).searchParams.get("itemId");
    if (!itemId) throw new HttpError(400, "itemId is required.");
    const owners = await getItemOwners({ guildId: active.guildId, itemId });
    return NextResponse.json({ owners });
  } catch (e) {
    return errorResponse(e);
  }
}

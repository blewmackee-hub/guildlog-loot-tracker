import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { getItemOwners } from "@/lib/guilds";

// GET /api/guild/item-owners?itemId=... - which of the signed-in
// user's guildmates have this item equipped or wishlisted, for the
// item detail panel's "Guild" section. Open to any member, same as
// wishlist-tally - unlike that endpoint this deliberately names names,
// since the point is finding who to ask about a trade or loaner.
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ owners: [] });
  }
  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }
  const owners = await getItemOwners({ guildId: active.guildId, itemId });
  return NextResponse.json({ owners });
}

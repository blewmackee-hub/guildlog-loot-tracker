import { NextResponse } from "next/server";
import { requireDiscordId, errorResponse } from "@/lib/apiHelpers";
import { registerGuild, searchGuilds } from "@/lib/guilds";

// GET /api/guilds?q=searchtext - "find your guild" lookup. No PIN
// needed to search/list names; the PIN only gates joining one.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const guilds = await searchGuilds(q);
    return NextResponse.json({ guilds });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/guilds { name, pin } - "register your guild". Whoever
// registers it becomes owner_discord_id (can rotate the PIN later -
// not built yet, see project-brief.md open questions).
export async function POST(request) {
  try {
    const discordId = await requireDiscordId("Sign in with Discord first.");
    const body = await request.json();
    const guild = await registerGuild({ name: body.name, pin: body.pin, ownerDiscordId: discordId });
    return NextResponse.json({ guild });
  } catch (e) {
    return errorResponse(e);
  }
}

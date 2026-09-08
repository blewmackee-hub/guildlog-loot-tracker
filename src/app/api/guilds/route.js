import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { registerGuild, searchGuilds, HttpError } from "@/lib/guilds";

// GET /api/guilds?q=searchtext - "find your guild" lookup. No PIN
// needed to search/list names; the PIN only gates joining one.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  try {
    const guilds = await searchGuilds(q);
    return NextResponse.json({ guilds });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/guilds { name, pin } - "register your guild". Whoever
// registers it becomes owner_discord_id (can rotate the PIN later -
// not built yet, see project-brief.md open questions).
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });
  }
  const body = await request.json();
  try {
    const guild = await registerGuild({
      name: body.name,
      pin: body.pin,
      ownerDiscordId: session.user.discordId,
    });
    return NextResponse.json({ guild });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

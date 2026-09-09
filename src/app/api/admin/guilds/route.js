import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminListGuilds } from "@/lib/guilds";

// GET /api/admin/guilds?q=... - every guild (optionally name-filtered),
// with owner username and character count, for the moderation panel.
// 403s for anyone not on ADMIN_DISCORD_IDS, guild ownership included.
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });
  }
  const q = new URL(request.url).searchParams.get("q") || "";
  const guilds = await adminListGuilds({ q });
  return NextResponse.json({ guilds });
}

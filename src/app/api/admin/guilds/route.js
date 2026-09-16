import { NextResponse } from "next/server";
import { requireAdmin, errorResponse } from "@/lib/apiHelpers";
import { adminListGuilds } from "@/lib/guilds";

// GET /api/admin/guilds?q=... - every guild (optionally name-filtered),
// with owner username and character count, for the moderation panel.
// 403s for anyone not on ADMIN_DISCORD_IDS, guild ownership included.
export async function GET(request) {
  try {
    await requireAdmin();
    const q = new URL(request.url).searchParams.get("q") || "";
    const guilds = await adminListGuilds({ q });
    return NextResponse.json({ guilds });
  } catch (e) {
    return errorResponse(e);
  }
}

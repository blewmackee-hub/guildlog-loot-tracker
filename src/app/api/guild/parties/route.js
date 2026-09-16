import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { listPartyTemplates, listGuildMemberNames, getMemberRole, createPartyTemplate } from "@/lib/guilds";

// GET /api/guild/parties - every saved party template for the
// signed-in user's current guild, the guild's member roster (for the
// per-slot member dropdown), and the requester's own role (so the
// client knows whether to show edit controls). Open to any member -
// viewing party comps is guild-wide like the DKP totals, only
// saving/editing is officer/leader-gated.
export async function GET() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const [templates, members, myRole] = await Promise.all([
      listPartyTemplates({ guildId: active.guildId }),
      listGuildMemberNames({ guildId: active.guildId }),
      getMemberRole({ guildId: active.guildId, discordId }),
    ]);
    return NextResponse.json({ templates, members, myRole });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/guild/parties { name, groups } - saves a brand-new
// template. createPartyTemplate re-checks server-side that the
// requester owns the guild.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    const template = await createPartyTemplate({ guildId: active.guildId, requesterDiscordId: discordId, name: body.name, groups: body.groups });
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}

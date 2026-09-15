import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { listPartyTemplates, listGuildMemberNames, getMemberRole, createPartyTemplate, HttpError } from "@/lib/guilds";

// GET /api/guild/parties - every saved party template for the
// signed-in user's current guild, the guild's member roster (for the
// per-slot member dropdown), and the requester's own role (so the
// client knows whether to show edit controls). Open to any member -
// viewing party comps is guild-wide like the DKP totals, only
// saving/editing is officer/leader-gated.
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  try {
    const [templates, members, myRole] = await Promise.all([
      listPartyTemplates({ guildId: active.guildId }),
      listGuildMemberNames({ guildId: active.guildId }),
      getMemberRole({ guildId: active.guildId, discordId: session.user.discordId }),
    ]);
    return NextResponse.json({ templates, members, myRole });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// POST /api/guild/parties { name, groups } - saves a brand-new
// template. createPartyTemplate re-checks server-side that the
// requester owns the guild.
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  const body = await request.json();
  try {
    const template = await createPartyTemplate({
      guildId: active.guildId,
      requesterDiscordId: session.user.discordId,
      name: body.name,
      groups: body.groups,
    });
    return NextResponse.json({ template });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

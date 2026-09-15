import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import { updatePartyTemplate, deletePartyTemplate, HttpError } from "@/lib/guilds";

// PUT /api/guild/parties/:id { name?, groups? } - renames and/or
// overwrites a template's board. Either field can be sent alone (a
// rename-only or a board-save-only). updatePartyTemplate re-checks
// the requester owns the guild, and that the template belongs to
// the requester's own guild.
export async function PUT(request, { params }) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    const template = await updatePartyTemplate({
      guildId: active.guildId,
      templateId: id,
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

// DELETE /api/guild/parties/:id
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const active = await getActiveCharacter();
  if (!active) {
    return NextResponse.json({ error: "No active guild." }, { status: 400 });
  }
  const { id } = await params;
  try {
    await deletePartyTemplate({
      guildId: active.guildId,
      templateId: id,
      requesterDiscordId: session.user.discordId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

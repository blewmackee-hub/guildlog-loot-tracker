import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { updatePartyTemplate, deletePartyTemplate } from "@/lib/guilds";

// PUT /api/guild/parties/:id { name?, groups? } - renames and/or
// overwrites a template's board. Either field can be sent alone (a
// rename-only or a board-save-only). updatePartyTemplate re-checks
// the requester owns the guild, and that the template belongs to
// the requester's own guild.
export async function PUT(request, { params }) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const { id } = await params;
    const body = await request.json();
    const template = await updatePartyTemplate({ guildId: active.guildId, templateId: id, requesterDiscordId: discordId, name: body.name, groups: body.groups });
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/guild/parties/:id
export async function DELETE(request, { params }) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const { id } = await params;
    await deletePartyTemplate({ guildId: active.guildId, templateId: id, requesterDiscordId: discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

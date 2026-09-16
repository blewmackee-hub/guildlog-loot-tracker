import { NextResponse } from "next/server";
import { requireAdmin, errorResponse } from "@/lib/apiHelpers";
import { adminRenameGuild, adminDeleteGuild } from "@/lib/guilds";

// PATCH /api/admin/guilds/[id] { name } - rename any guild regardless
// of ownership, e.g. neutralizing a bad-faith/impersonation name
// without kicking out its members.
export async function PATCH(request, { params }) {
  try {
    await requireAdmin();
    const { id: guildId } = await params;
    const body = await request.json();
    const guild = await adminRenameGuild({ guildId, name: body.name });
    return NextResponse.json({ guild });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/admin/guilds/[id] - delete any guild regardless of
// ownership. CASCADEs to every member's characters, same as the
// owner-initiated deleteGuild.
export async function DELETE(request, { params }) {
  try {
    await requireAdmin();
    const { id: guildId } = await params;
    await adminDeleteGuild({ guildId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

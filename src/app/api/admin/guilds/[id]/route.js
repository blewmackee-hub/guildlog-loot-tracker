import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { adminRenameGuild, adminDeleteGuild, HttpError } from "@/lib/guilds";

// PATCH /api/admin/guilds/[id] { name } - rename any guild regardless
// of ownership, e.g. neutralizing a bad-faith/impersonation name
// without kicking out its members.
export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });
  }
  const { id: guildId } = await params;
  const body = await request.json();
  try {
    const guild = await adminRenameGuild({ guildId, name: body.name });
    return NextResponse.json({ guild });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// DELETE /api/admin/guilds/[id] - delete any guild regardless of
// ownership. CASCADEs to every member's characters, same as the
// owner-initiated deleteGuild.
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Admin access only." }, { status: 403 });
  }
  const { id: guildId } = await params;
  try {
    await adminDeleteGuild({ guildId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

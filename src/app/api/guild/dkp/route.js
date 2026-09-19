import { NextResponse } from "next/server";
import { requireDiscordId, requireActiveGuild, errorResponse } from "@/lib/apiHelpers";
import { listGuildRoster, adjustDkp, getDkpLog, removeDkpMember } from "@/lib/guilds";

// GET /api/guild/dkp - every member of the signed-in user's CURRENT
// guild with their DKP total and role, the requester's own role (so
// the client knows whether to show edit controls), and the recent
// adjustment history. Open to any member, not leader/officer-only -
// same openness as wishlist-tally, since DKP totals (and who changed
// them) are meant to be visible to the whole guild.
export async function GET() {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const [{ roster, officerCap, decay, decayApplied }, log] = await Promise.all([
      listGuildRoster({ guildId: active.guildId }),
      getDkpLog({ guildId: active.guildId }),
    ]);
    const me = roster.find((m) => m.discordId === discordId);
    return NextResponse.json({ roster, officerCap, decay, decayApplied, log, myRole: me?.role ?? "member" });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/guild/dkp { discordIds: [...], delta, reason? } - adds
// `delta` (negative to subtract) to every listed member's DKP total
// and records one audit-log row per target. Always an array so the
// same endpoint covers a single row's +/- box and the "apply to
// everyone selected" bulk action. adjustDkp re-checks server-side that
// the requester is an officer or the leader in THIS guild - never
// trusts a client-asserted role.
export async function POST(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await adjustDkp({
      guildId: active.guildId,
      targetDiscordIds: body.discordIds,
      requesterDiscordId: discordId,
      delta: body.delta,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/guild/dkp { discordId } - removes a former member's row
// (no character left in this guild) from the DKP table. Officer/leader
// only, re-checked in removeDkpMember.
export async function DELETE(request) {
  try {
    const discordId = await requireDiscordId();
    const active = await requireActiveGuild();
    const body = await request.json();
    await removeDkpMember({ guildId: active.guildId, targetDiscordId: body.discordId, requesterDiscordId: discordId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

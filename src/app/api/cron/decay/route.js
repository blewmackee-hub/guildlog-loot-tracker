import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiHelpers";
import { applyDueDecays } from "@/lib/guilds";

export const dynamic = "force-dynamic";

// GET /api/cron/decay - the daily scheduled job (see vercel.json) that
// applies every guild's weekly DKP decay once its chosen weekday has
// arrived. Not a user endpoint: it needs `Authorization: Bearer
// $CRON_SECRET` (Vercel sends this itself when CRON_SECRET is set) and
// refuses everything when the secret isn't configured. Safe to call more
// than once - applyDueDecays claims each guild's decay atomically.
function secretMatches(header) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const digest = (v) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request) {
  try {
    if (!secretMatches(request.headers.get("authorization") || "")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const applied = await applyDueDecays();
    return NextResponse.json({ applied });
  } catch (e) {
    return errorResponse(e);
  }
}

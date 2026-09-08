import { cookies } from "next/headers";

const COOKIE_NAME = "active_character";

/* Layer 2 of the auth model (see project-brief.md addendum) is
   deliberately NOT part of the NextAuth/Discord session - it's just
   "which guild + character is this signed-in Discord user currently
   looking at", set after a correct PIN. The actual access control
   still happens server-side on every character read/write (matching
   discordId, not trusting this cookie's guildId/characterId alone),
   so this cookie only needs to survive tampering gracefully (bad
   JSON -> treated as "none set"), not resist it. cookies() is async
   in Next.js 16. */
export async function setActiveCharacter({ guildId, characterId }) {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify({ guildId, characterId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getActiveCharacter() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function clearActiveCharacter() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

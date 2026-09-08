import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { upsertUser } from "@/lib/db";

/* Identity only - this is layer 1 of the two-layer auth model from
   project-brief.md's addendum. No Discord bot, no server/guild
   membership checking - just "sign in with Discord" to prove who
   someone is. Layer 2 (which guild + its PIN) is handled separately
   in src/app/guild/* once someone is signed in; it is NOT part of
   the NextAuth session, it lives in its own short-lived cookie set
   by /api/guilds/[id]/join after a correct PIN - see src/lib/guildSession.js. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      // `user`/`account` are only present on the sign-in request
      // itself (not later token refreshes). `user.name`/`user.image`
      // come from Discord's provider.profile() mapping (avatar URL
      // fully resolved) - but `user.id` is USELESS here: Auth.js core
      // deliberately sets it to a fresh crypto.randomUUID() on every
      // sign-in (see @auth/core/lib/actions/callback/oauth/callback.js),
      // not the provider's own id, "so the user remains independent of
      // the provider". The actual stable Discord snowflake lives on
      // account.providerAccountId instead - that's what every table's
      // discord_id foreign key needs to stay constant across logins.
      if (account && user) {
        token.discordId = account.providerAccountId;
        token.avatarUrl = user.image ?? null;
        try {
          await upsertUser({
            discordId: account.providerAccountId,
            username: user.name,
            avatarUrl: user.image ?? null,
          });
        } catch (e) {
          // DB not configured/reachable yet - don't block sign-in on it;
          // guild registration/lookup will fail loudly later if this
          // never succeeds, which is the right place to surface it.
          console.error("upsertUser failed during sign-in:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.discordId;
      }
      return session;
    },
  },
});

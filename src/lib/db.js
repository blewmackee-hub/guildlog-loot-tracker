import { Pool } from "pg";

/* One pool per server process (Next.js dev/hot-reload can otherwise
   accumulate a new pool per reload - stash it on globalThis so it
   survives module re-evaluation in dev). Requires DATABASE_URL - see
   .env.local.example. Run db/schema.sql against that database once
   before using any of this. */
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local, fill in a real Postgres connection string (Supabase or Neon both work), and run db/schema.sql against it."
    );
  }
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase/Neon terminate TLS with certs that Node's default
      // trust store sometimes can't chase down in serverless
      // environments; rejectUnauthorized:false is the standard
      // workaround both providers document. Not needed for a plain
      // local Postgres without sslmode=require in the URL.
      ssl: process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__pgPool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

// Only called on a real Discord OAuth sign-in (see auth.js's jwt
// callback - it checks `account && user`, which isn't present on a
// plain session/token refresh), so last_login_at is a genuine "last
// time they signed in" mark, not "last time they had a valid session" -
// see the inactive-leader claim feature in src/lib/guilds.js.
export async function upsertUser({ discordId, username, avatarUrl }) {
  await query(
    `INSERT INTO users (discord_id, username, avatar_url, last_login_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url, last_login_at = now()`,
    [discordId, username, avatarUrl]
  );
}

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
      // Verify the server certificate (Neon's is publicly trusted, so
      // Node's default trust store is enough). Only used when the URL asks
      // for TLS; a plain local Postgres stays unencrypted.
      ssl: process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.__pgPool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

// Marks "this account used the app just now", at most once an hour so it
// costs one cheap conditional UPDATE per app load, not a write per request.
// Together with last_login_at this is what the inactive-leader claim
// measures - see leaderLastActive in src/lib/guilds.js.
// Best-effort: it must never take the app down (a database that hasn't had
// the last_seen_at migration yet would otherwise fail every app load).
export async function touchLastSeen(discordId) {
  try {
    await query(
      `UPDATE users SET last_seen_at = now()
       WHERE discord_id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 hour')`,
      [discordId]
    );
  } catch (e) {
    console.error("touchLastSeen failed (is users.last_seen_at migrated?):", e.message);
  }
}

// Runs fn(client) between BEGIN/COMMIT on one connection, rolling back
// if it throws - for read-then-write checks that must not interleave.
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
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

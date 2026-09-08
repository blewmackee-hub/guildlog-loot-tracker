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

export async function upsertUser({ discordId, username, avatarUrl }) {
  await query(
    `INSERT INTO users (discord_id, username, avatar_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url`,
    [discordId, username, avatarUrl]
  );
}

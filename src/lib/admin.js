/* Site-wide moderation, separate from per-guild ownership - a small
   allowlist of Discord IDs (not usernames, which can change) set via
   ADMIN_DISCORD_IDS. Anyone on it can rename or delete ANY guild
   through /admin, regardless of who owns it - for cleaning up
   trolling/impersonation without waiting on the guild's own owner. */
export function isAdmin(discordId) {
  if (!discordId) return false;
  const ids = (process.env.ADMIN_DISCORD_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(discordId);
}

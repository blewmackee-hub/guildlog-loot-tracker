import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — GuildLog",
};

export default function PrivacyPage() {
  return (
    <div className="app">
      <div className="layout">
        <div className="admin-panel__topbar">
          <Link href="/" className="btn-secondary btn-secondary--sm">Back to GuildLog</Link>
        </div>
        <div className="panel doc-page">
          <h3 className="panel-title">Privacy Policy</h3>
          <p className="doc-page__updated">Last updated: September 9, 2026</p>

          <p>
            This page explains what GuildLog collects, why, and what it does not do with it. GuildLog is a small,
            self-hosted hobby project — there is no advertising, no analytics tracking, and nothing here is sold to
            anyone.
          </p>

          <h4>What we collect</h4>
          <p>
            When you sign in with Discord, GuildLog stores your Discord account ID, username, and avatar image URL —
            that&apos;s it. Discord&apos;s sign-in screen also requests your email address as part of its standard
            permission set, but GuildLog never stores or reads it.
          </p>
          <p>
            Everything else in your account is data you choose to enter: a guild name and PIN (the PIN is stored as
            a one-way hash, never in plain text, so we can&apos;t see it either), character names, and the gear
            build/wishlist you put together. Failed PIN attempts are logged briefly (which guild, which Discord
            account, and when) purely to block repeated guessing — this is deleted automatically when the guild it
            belongs to is deleted.
          </p>

          <h4>Cookies</h4>
          <p>
            GuildLog sets two cookies, both required for the app to function: one to keep you signed in, and one to
            remember which guild/character you&apos;re currently viewing. Neither is used for advertising or
            tracking across other sites.
          </p>

          <h4>Who else sees it</h4>
          <p>
            Your data is processed by the infrastructure GuildLog runs on — Vercel (hosting) and Neon (database
            storage) — and by Discord for the sign-in step itself (governed by{" "}
            <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">Discord&apos;s own privacy policy</a>).
            No one else receives your data. Guild names, character names, and gear builds are visible to other
            members of the same guild by design — that&apos;s the point of a shared guild planner — but never to
            people outside it.
          </p>

          <h4>Deleting your data</h4>
          <p>
            &quot;Leave Guild&quot; in the app deletes all of your characters in that guild immediately. Deleting a
            guild you own deletes it and every member&apos;s characters in it. To request deletion of your Discord
            ID from anything remaining after that, email{" "}
            <a href="mailto:info@gllt.app">info@gllt.app</a>.
          </p>

          <h4>Children</h4>
          <p>
            GuildLog is not directed at children and follows Discord&apos;s own minimum age requirement for sign-in.
          </p>

          <h4>Changes</h4>
          <p>
            If what GuildLog collects changes, this page will be updated and the date at the top will change with it.
          </p>

          <h4>Contact</h4>
          <p>
            Questions about this policy: <a href="mailto:info@gllt.app">info@gllt.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}

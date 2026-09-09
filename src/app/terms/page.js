import Link from "next/link";

export const metadata = {
  title: "Terms of Service — GuildLog",
};

export default function TermsPage() {
  return (
    <div className="app">
      <div className="layout">
        <div className="admin-panel__topbar">
          <Link href="/" className="btn-secondary btn-secondary--sm">Back to GuildLog</Link>
        </div>
        <div className="panel doc-page">
          <h3 className="panel-title">Terms of Service</h3>
          <p className="doc-page__updated">Last updated: September 9, 2026</p>

          <p>
            GuildLog (&quot;the app&quot;, &quot;we&quot;) is a free, fan-made gear-planning and loot-tracking tool for
            <em> Throne and Liberty</em>. It is not affiliated with, endorsed by, or sponsored by Amazon Games, NCSoft,
            or Discord Inc. All game names, item names, and related assets referenced in the app belong to their
            respective owners.
          </p>

          <h4>Using GuildLog</h4>
          <p>
            You sign in with Discord to identify yourself. GuildLog does not add a bot to any Discord server, cannot
            read or send Discord messages, and only uses your Discord account to confirm who you are. By using
            GuildLog you agree to follow{" "}
            <a href="https://discord.com/terms" target="_blank" rel="noopener noreferrer">Discord&apos;s own Terms of Service</a>{" "}
            as well, including its minimum age requirement.
          </p>

          <h4>Guilds and PINs</h4>
          <p>
            A guild in GuildLog is protected by a PIN that its owner sets and shares with whoever they want to let
            in — GuildLog has no way to verify who you share that PIN with, so you&apos;re responsible for who gets
            access to a guild you own. Guild owners can rename, transfer ownership of, or permanently delete their own
            guild (which deletes every member&apos;s characters in it) at any time from within the app.
          </p>

          <h4>Your content</h4>
          <p>
            Guild names, character names, and anything else you type into GuildLog is your responsibility. Don&apos;t
            use it to impersonate someone else, harass others, or post anything illegal or abusive. Site moderators
            may rename or delete a guild that violates this, independent of the guild owner, to keep the app usable
            for everyone else.
          </p>

          <h4>No warranty</h4>
          <p>
            GuildLog is a hobby project provided &quot;as is&quot;, with no uptime guarantee and no warranty of any
            kind. Game data (stats, drop rates, recipes) is community-sourced and may be incomplete or wrong — don&apos;t
            treat it as authoritative. We&apos;re not liable for any loss of data or in-game decisions made based on
            information in the app.
          </p>

          <h4>Changes</h4>
          <p>
            These terms may change as the app changes. Continuing to use GuildLog after an update means you accept
            the current version.
          </p>

          <h4>Contact</h4>
          <p>
            Questions about these terms: <a href="mailto:info@gllt.app">info@gllt.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}

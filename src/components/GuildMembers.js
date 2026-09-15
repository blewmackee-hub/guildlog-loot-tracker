"use client";

import { useState, useEffect } from "react";
import { UserX, Crown } from "lucide-react";

/* Owner-only roster (App.js only renders this tab when isGuildOwner).
   The server re-checks ownership on every call regardless - this is
   a convenience gate, not the real security boundary. Kicking a
   member removes ALL of their characters in this guild, same as
   "Leave Guild" does for one's own - see src/lib/guilds.js. */
export default function GuildMembers({ guildName, onDeleteGuild, onOwnerChanged }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  // { type: "kick" | "promote", discordId } | null - one shared shape
  // so a kick-confirm and a promote-confirm can never both be open.
  const [confirming, setConfirming] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteTypedName, setDeleteTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);

  function load() {
    fetch("/api/guild/members")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMembers(data.members);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function kick(discordId) {
    setBusyKey(`kick:${discordId}`);
    setError(null);
    try {
      const res = await fetch("/api/guild/members/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConfirming(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function promote(discordId) {
    setBusyKey(`promote:${discordId}`);
    setError(null);
    try {
      const res = await fetch("/api/guild/members/transfer-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConfirming(null);
      load();
      onOwnerChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="guild-members">
      <h3 className="panel-title">Guild Members</h3>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!members && !error && <p className="muted">Loading…</p>}
      {members && members.length === 0 && <p className="muted">No members yet.</p>}
      {members && members.map((m, i) => (
        <div className="guild-member-row scan-row" key={m.discordId} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
          <div className="guild-member-row__info">
            <span className="guild-member-row__name">
              {m.username}
              {m.isOwner && <span className="guild-member-row__owner-badge">Owner</span>}
            </span>
            <span className="muted">{m.characters.map((c) => c.name).join(", ")}</span>
          </div>
          {confirming?.discordId === m.discordId ? (
            confirming.type === "kick" ? (
              <div className="guild-member-row__confirm">
                <span className="profile-bar__leave-warning">Remove {m.username} and their character(s)?</span>
                <button className="profile-bar__leave-confirm" disabled={busyKey === `kick:${m.discordId}`} onClick={() => kick(m.discordId)}>
                  {busyKey === `kick:${m.discordId}` ? "Removing…" : "Remove"}
                </button>
                <button className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            ) : (
              <div className="guild-member-row__confirm">
                <span className="profile-bar__leave-warning">Make {m.username} the new owner? You&apos;ll no longer have owner controls.</span>
                <button className="profile-bar__leave-confirm" disabled={busyKey === `promote:${m.discordId}`} onClick={() => promote(m.discordId)}>
                  {busyKey === `promote:${m.discordId}` ? "Promoting…" : "Promote"}
                </button>
                <button className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
              </div>
            )
          ) : (
            <div className="guild-member-row__actions">
              {!m.isOwner && (
                <button className="guild-member-row__promote" title="Promote to owner" aria-label={`Promote ${m.username} to owner`} onClick={() => setConfirming({ type: "promote", discordId: m.discordId })}>
                  <Crown size={15} strokeWidth={1.5} />
                </button>
              )}
              <button className="guild-member-row__kick" title="Remove member" aria-label={`Remove ${m.username}`} onClick={() => setConfirming({ type: "kick", discordId: m.discordId })}>
                <UserX size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="danger-zone">
        <h4>Clicking this will erase all guild data, proceed with caution</h4>
        {!confirmingDelete ? (
          <button className="btn-secondary btn-secondary--danger" onClick={() => setConfirmingDelete(true)}>
            Delete Guild
          </button>
        ) : (
          <div className="danger-zone__confirm">
            <p className="profile-bar__leave-warning">
              This permanently deletes <strong>{guildName}</strong> and every member&apos;s characters in it. Type the guild
              name to confirm.
            </p>
            <input
              className="guild-form__input"
              aria-label={`Type "${guildName}" to confirm deletion`}
              autoComplete="off"
              spellCheck={false}
              value={deleteTypedName}
              onChange={(e) => setDeleteTypedName(e.target.value)}
              placeholder={guildName}
            />
            <div className="danger-zone__actions">
              <button
                className="profile-bar__leave-confirm"
                disabled={deleteTypedName !== guildName || deleting}
                onClick={async () => {
                  setDeleting(true);
                  await onDeleteGuild();
                }}
              >
                {deleting ? "Deleting…" : "Delete Guild Permanently"}
              </button>
              <button className="btn-secondary" onClick={() => { setConfirmingDelete(false); setDeleteTypedName(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

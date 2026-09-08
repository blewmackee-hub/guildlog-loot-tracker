"use client";

import { useState, useEffect } from "react";
import { UserX } from "lucide-react";

/* Owner-only roster (App.js only renders this tab when isGuildOwner).
   The server re-checks ownership on every call regardless - this is
   a convenience gate, not the real security boundary. Kicking a
   member removes ALL of their characters in this guild, same as
   "Leave Guild" does for one's own - see src/lib/guilds.js. */
export default function GuildMembers({ guildName, onDeleteGuild }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
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
    setBusyId(discordId);
    setError(null);
    try {
      const res = await fetch("/api/guild/members/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConfirmingId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="guild-members">
      <h3 className="panel-title">Guild Members</h3>
      {error && <p className="auth-error">{error}</p>}
      {!members && !error && <p className="muted">Loading…</p>}
      {members && members.length === 0 && <p className="muted">No members yet.</p>}
      {members && members.map((m) => (
        <div className="guild-member-row" key={m.discordId}>
          <div className="guild-member-row__info">
            <span className="guild-member-row__name">{m.username}</span>
            <span className="muted">{m.characters.map((c) => c.name).join(", ")}</span>
          </div>
          {confirmingId === m.discordId ? (
            <div className="guild-member-row__confirm">
              <span className="profile-bar__leave-warning">Remove {m.username} and their character(s)?</span>
              <button className="profile-bar__leave-confirm" disabled={busyId === m.discordId} onClick={() => kick(m.discordId)}>
                {busyId === m.discordId ? "Removing…" : "Remove"}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmingId(null)}>Cancel</button>
            </div>
          ) : (
            <button className="guild-member-row__kick" title="Remove member" onClick={() => setConfirmingId(m.discordId)}>
              <UserX size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}

      <div className="danger-zone">
        <h4>Danger Zone</h4>
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

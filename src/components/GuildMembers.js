"use client";

import { useState, useEffect } from "react";
import { Crown, X } from "lucide-react";
import { postJSON } from "@/lib/apiClient";

/* Guild roster, one row per CHARACTER (with the Discord account it
   belongs to as subtext). Shown to the leader and officers; App.js only
   renders the tab for them. Officers can remove characters of plain
   members (and their own alts); the leader can remove anyone's and also
   gets promote-to-leader, PIN change and Delete Guild. The server
   re-checks every one of these - this only decides what to show. Removing
   an account's last character is a full kick (see kickCharacter in
   src/lib/guilds.js). */
export default function GuildMembers({ isOwner, guildName, onDeleteGuild, onChanged }) {
  const [members, setMembers] = useState(null);
  const [me, setMe] = useState(null); // this account's discordId, from any of its own rows
  const [error, setError] = useState(null);
  // { type: "char" | "promote", characterId, discordId, ... } | null - one
  // shared shape so two confirms can never both be open.
  const [confirming, setConfirming] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteTypedName, setDeleteTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState(null); // { ok, text }
  const pinsMismatch = newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin;

  function load() {
    fetch("/api/guild/members")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMembers(data.members);
        setMe(data.me);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function kickChar(characterId) {
    setBusyKey(`char:${characterId}`);
    setError(null);
    try {
      await postJSON("/api/guild/members/kick", { characterId });
      setConfirming(null);
      load();
      onChanged?.(); // the removed character may be one of your own (header dropdown)
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
      await postJSON("/api/guild/members/transfer-owner", { discordId });
      setConfirming(null);
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function changePin(e) {
    e.preventDefault();
    setPinBusy(true);
    setPinMsg(null);
    try {
      await postJSON("/api/guild/pin", { pin: newPin });
      setNewPin("");
      setConfirmPin("");
      setPinMsg({ ok: true, text: "PIN changed. Share the new one with anyone who needs to join." });
    } catch (err) {
      setPinMsg({ ok: false, text: err.message });
    } finally {
      setPinBusy(false);
    }
  }

  // Mirrors the server's rules in kickCharacter (which enforces them):
  // your own last character can't be removed here, and officers can't
  // remove an officer's or the leader's.
  const countFor = (discordId) => members.filter((x) => x.discordId === discordId).length;
  function canRemove(m) {
    if (m.discordId === me) return countFor(m.discordId) > 1;
    return isOwner || (!m.isOwner && !m.isOfficer);
  }

  return (
    <div className="guild-members">
      <h3 className="panel-title">Guild Members</h3>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!members && !error && <p className="muted">Loading…</p>}
      {members && members.length === 0 && <p className="muted">No members yet.</p>}
      {members && members.map((m, i) => (
        <div className="guild-member-row scan-row" key={m.characterId} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
          <div className="guild-member-row__info">
            <span className="guild-member-row__name">
              {m.characterName}
              {m.isOwner && <span className="guild-member-row__owner-badge">Owner</span>}
              {m.isOfficer && !m.isOwner && <span className="dkp-row__officer-badge">Officer</span>}
            </span>
            <span className="muted">{m.username}</span>
          </div>
          {confirming?.characterId === m.characterId ? (
            confirming.type === "char" ? (
              <div className="guild-member-row__confirm">
                <span className="profile-bar__leave-warning">
                  Remove {m.characterName} ({m.username})?
                  {countFor(m.discordId) === 1 && " This is their only character, so they'll be removed from the guild."}
                </span>
                <button className="profile-bar__leave-confirm" disabled={busyKey === `char:${m.characterId}`} onClick={() => kickChar(m.characterId)}>
                  {busyKey === `char:${m.characterId}` ? "Removing…" : "Remove"}
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
              {isOwner && !m.isOwner && (
                <button className="guild-member-row__promote" title="Make owner" aria-label={`Make ${m.username} the owner`} onClick={() => setConfirming({ type: "promote", characterId: m.characterId, discordId: m.discordId })}>
                  <Crown size={15} strokeWidth={1.5} />
                </button>
              )}
              {canRemove(m) && (
                <button className="guild-member-row__kick" title="Remove character" aria-label={`Remove ${m.characterName}`} onClick={() => setConfirming({ type: "char", characterId: m.characterId, discordId: m.discordId })}>
                  <X size={15} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {isOwner && (
        <>
          <form className="guild-form guild-members__pin" onSubmit={changePin}>
            <h4 className="guild-members__pin-title">Change guild PIN</h4>
            <input
              className="guild-form__input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="New PIN (6 digits)"
              aria-label="New guild PIN, 6 digits"
              autoComplete="off"
              spellCheck={false}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />
            <input
              className={`guild-form__input ${pinsMismatch ? "guild-form__input--invalid" : ""}`}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Confirm new PIN"
              aria-label="Confirm new guild PIN"
              aria-invalid={pinsMismatch}
              autoComplete="off"
              spellCheck={false}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
            />
            {pinsMismatch && <span className="guild-form__hint guild-form__hint--danger">PINs don&apos;t match.</span>}
            {pinMsg && (
              <span role="status" className={`guild-form__hint ${pinMsg.ok ? "" : "guild-form__hint--danger"}`}>{pinMsg.text}</span>
            )}
            <button type="submit" className="btn-secondary" disabled={pinBusy || newPin.length !== 6 || newPin !== confirmPin}>
              {pinBusy ? "Saving…" : "Change PIN"}
            </button>
          </form>

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
        </>
      )}
    </div>
  );
}

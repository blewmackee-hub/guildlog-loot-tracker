"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, ShieldAlert, User } from "lucide-react";
import Modal from "./Modal";

/* Characters are scoped to a guild + Discord account (src/lib/guilds.js),
   so switching here just points the active_character cookie at a
   different one of the signed-in user's own characters in the same
   guild - no PIN re-entry needed. "+ New" creates another alt.
   isSiteAdmin (from GET /api/character, see src/lib/admin.js) just
   decides whether the /admin link shows here - the route itself
   re-checks admin status server-side regardless. */
export default function ProfileBar({ guildName, activeCharacterId, characters, onSwitch, onCreate, onDeleteCharacter, onLeaveGuild, isSiteAdmin }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingDeleteChar, setConfirmingDeleteChar] = useState(false);
  const [leaveTypedName, setLeaveTypedName] = useState("");

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="profile-bar">
      {guildName && (
        <span className="profile-bar__guild">
          <div className="live-dot" title="Online" />
          <span className="profile-bar__label">{guildName} ·</span>
        </span>
      )}
      <span className="profile-bar__label" id="profile-bar-character-label">Playing as</span>
      <User className="profile-bar__select-icon" size={13} strokeWidth={1.75} aria-hidden="true" />
      <select
        className="profile-bar__select"
        aria-labelledby="profile-bar-character-label"
        value={activeCharacterId}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="profile-bar__actions">
      {adding ? (
        <>
          <input
            className="profile-bar__input"
            aria-label="New character name"
            autoComplete="off"
            autoFocus
            value={draft}
            placeholder="Name…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button className="btn-secondary btn-secondary--sm" onClick={submit}>Add</button>
          <button className="btn-secondary btn-secondary--sm" onClick={() => setAdding(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn-secondary btn-secondary--sm" onClick={() => setAdding(true)}>+ New</button>
      )}
      {characters.length > 1 && (
        <button className="btn-secondary btn-secondary--sm profile-bar__leave-trigger" onClick={() => setConfirmingDeleteChar(true)}>
          Delete Character
        </button>
      )}
      {confirmingDeleteChar && (
        <Modal title="Delete Character?" tone="danger" onClose={() => setConfirmingDeleteChar(false)}>
          <p className="profile-bar__leave-warning">
            This permanently erases <strong>{characters.find((c) => c.id === activeCharacterId)?.name}</strong>&apos;s build and
            wishlist. Your other characters in {guildName} are not affected.
          </p>
          <div className="modal-panel__actions">
            <button className="btn-secondary btn-secondary--sm" onClick={() => setConfirmingDeleteChar(false)}>Cancel</button>
            <button
              className="profile-bar__leave-confirm"
              onClick={() => {
                setConfirmingDeleteChar(false);
                onDeleteCharacter(activeCharacterId);
              }}
            >
              Delete Character
            </button>
          </div>
        </Modal>
      )}
      <button className="btn-secondary btn-secondary--sm profile-bar__leave-trigger" onClick={() => setConfirmingLeave(true)}>
        Leave Guild
      </button>
      {confirmingLeave && (
        <Modal
          title="Leave Guild?"
          tone="danger"
          onClose={() => { setConfirmingLeave(false); setLeaveTypedName(""); }}
        >
          <p className="profile-bar__leave-warning">
            This permanently erases all data for your character(s) in {guildName}. Type the guild name to confirm.
          </p>
          <input
            className="guild-form__input"
            aria-label={`Type "${guildName}" to confirm leaving`}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={leaveTypedName}
            onChange={(e) => setLeaveTypedName(e.target.value)}
            placeholder={guildName}
          />
          <div className="modal-panel__actions">
            <button className="btn-secondary btn-secondary--sm" onClick={() => { setConfirmingLeave(false); setLeaveTypedName(""); }}>
              Cancel
            </button>
            <button
              className="profile-bar__leave-confirm"
              disabled={leaveTypedName !== guildName}
              onClick={() => {
                setConfirmingLeave(false);
                onLeaveGuild();
              }}
            >
              Leave Guild
            </button>
          </div>
        </Modal>
      )}
      {isSiteAdmin && (
        <Link href="/admin" className="profile-bar__signout" title="Guild moderation" aria-label="Guild moderation">
          <ShieldAlert size={15} strokeWidth={1.5} />
        </Link>
      )}
      <button
        className="profile-bar__signout profile-bar__signout--danger"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        <LogOut size={15} strokeWidth={1.5} />
      </button>
      </div>
    </div>
  );
}

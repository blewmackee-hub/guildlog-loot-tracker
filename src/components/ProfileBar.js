"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/* Characters are scoped to a guild + Discord account (src/lib/guilds.js),
   so switching here just points the active_character cookie at a
   different one of the signed-in user's own characters in the same
   guild - no PIN re-entry needed. "+ New" creates another alt. */
export default function ProfileBar({ guildName, activeCharacterId, characters, onSwitch, onCreate }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="profile-bar">
      {guildName && <span className="profile-bar__label">{guildName} ·</span>}
      <span className="profile-bar__label">Playing as</span>
      <select className="profile-bar__select" value={activeCharacterId} onChange={(e) => onSwitch(e.target.value)}>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {adding ? (
        <>
          <input
            className="profile-bar__input"
            autoFocus
            value={draft}
            placeholder="Name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button className="btn-secondary" onClick={submit}>Add</button>
          <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ New</button>
      )}
      <button
        className="profile-bar__signout"
        title="Sign out"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        <LogOut size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

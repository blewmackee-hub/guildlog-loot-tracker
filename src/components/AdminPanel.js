"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Pencil, Trash2 } from "lucide-react";

/* /admin only - gated server-side in src/app/admin/page.js via
   isAdmin(session.user.discordId), and every fetch here hits routes
   that re-check isAdmin themselves (src/app/api/admin/guilds/*), so
   this component never needs to trust anything client-side for
   security - it just renders whatever the (already-authorized)
   response contains. */
export default function AdminPanel() {
  const [guilds, setGuilds] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState(null); // guildId | null
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(null); // guildId | null
  const [busyId, setBusyId] = useState(null);

  function load(q) {
    fetch(`/api/admin/guilds?q=${encodeURIComponent(q ?? search)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGuilds(data.guilds);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function rename(guildId) {
    setBusyId(guildId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/guilds/${guildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setRenaming(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function del(guildId) {
    setBusyId(guildId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/guilds/${guildId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setConfirmingDelete(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="layout">
      <div className="admin-panel__topbar">
        <Link href="/guild" className="btn-secondary btn-secondary--sm">Back to app</Link>
      </div>
      <div className="panel admin-panel">
        <h3 className="panel-title">Guild Moderation</h3>

        <div className="search-row">
          <Search size={15} strokeWidth={1.5} />
          <input
            className="search-row__input"
            placeholder="Search guild name…"
            aria-label="Search guild name"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}
        {!guilds && !error && <p className="muted">Loading…</p>}
        {guilds && guilds.length === 0 && <p className="muted">No guilds found.</p>}

        {guilds && guilds.map((g) => (
          <div className="guild-member-row" key={g.id}>
            {renaming === g.id ? (
              <div className="guild-member-row__confirm">
                <input
                  className="guild-form__input"
                  aria-label="Guild name"
                  autoComplete="off"
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename(g.id);
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
                <button className="btn-secondary" disabled={busyId === g.id} onClick={() => rename(g.id)}>
                  {busyId === g.id ? "Saving…" : "Save"}
                </button>
                <button className="btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
              </div>
            ) : confirmingDelete === g.id ? (
              <div className="guild-member-row__confirm">
                <span className="profile-bar__leave-warning">
                  Delete <strong>{g.name}</strong> and every member&apos;s characters in it?
                </span>
                <button className="profile-bar__leave-confirm" disabled={busyId === g.id} onClick={() => del(g.id)}>
                  {busyId === g.id ? "Deleting…" : "Delete"}
                </button>
                <button className="btn-secondary" onClick={() => setConfirmingDelete(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="guild-member-row__info">
                  <span className="guild-member-row__name">{g.name}</span>
                  <span className="muted">
                    Owner: {g.ownerUsername} · {g.characterCount} character{g.characterCount === 1 ? "" : "s"} ·{" "}
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="guild-member-row__actions">
                  <button
                    className="guild-member-row__promote"
                    title="Rename guild"
                    aria-label={`Rename ${g.name}`}
                    onClick={() => {
                      setRenaming(g.id);
                      setRenameDraft(g.name);
                    }}
                  >
                    <Pencil size={15} strokeWidth={1.5} />
                  </button>
                  <button
                    className="guild-member-row__kick"
                    title="Delete guild"
                    aria-label={`Delete ${g.name}`}
                    onClick={() => setConfirmingDelete(g.id)}
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

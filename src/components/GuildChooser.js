"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* The A/B choice from project-brief.md's addendum: after Discord
   login, find an existing guild (search + enter its PIN) or
   register a new one (name + set a PIN). Either path ends the same
   way - POST to an endpoint that sets the active_character cookie -
   then we hand off to the main app. */
export default function GuildChooser({ discordName }) {
  const router = useRouter();
  const [mode, setMode] = useState("find"); // "find" | "register"
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // --- find mode ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [joinPin, setJoinPin] = useState("");
  const [characterName, setCharacterName] = useState("");

  useEffect(() => {
    if (mode !== "find") return;
    const t = setTimeout(() => {
      fetch(`/api/guilds?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setResults(data.guilds || []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function joinGuild(e) {
    e.preventDefault();
    if (!selectedGuild) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/guilds/${selectedGuild.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: joinPin, characterName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --- register mode ---
  const [newGuildName, setNewGuildName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [newCharacterName, setNewCharacterName] = useState("");

  async function registerGuild(e) {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGuildName, pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      // Registering doesn't auto-join - immediately join with the
      // same PIN so "register" feels like one step, not two.
      const joinRes = await fetch(`/api/guilds/${data.guild.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin, characterName: newCharacterName }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok) throw new Error(joinData.error || "Guild created, but joining it failed.");
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--wide">
        <div className="guild-chooser__intro">
          <h1>Welcome, {discordName}</h1>
          <p className="muted">Find your guild, or register a new one.</p>

          <div className="tabs guild-mode-tabs">
            <button className={`tab ${mode === "find" ? "tab--active" : ""}`} onClick={() => { setMode("find"); setError(null); }}>
              Find my guild
            </button>
            <button className={`tab ${mode === "register" ? "tab--active" : ""}`} onClick={() => { setMode("register"); setError(null); }}>
              Register a guild
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {mode === "find" ? (
          <form onSubmit={joinGuild} className="guild-form">
            <input
              className="search-row__input guild-form__input"
              type="text"
              placeholder="Search guild name…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedGuild(null); }}
            />
            {!selectedGuild && (
              <div className="guild-results">
                {results.length === 0 && <p className="muted">No guilds found. Maybe register it below instead?</p>}
                {results.map((g) => (
                  <button type="button" key={g.id} className="guild-result-row" onClick={() => setSelectedGuild(g)}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            {selectedGuild && (
              <>
                <p className="muted">Joining <strong>{selectedGuild.name}</strong></p>
                <input
                  className="guild-form__input"
                  type="password"
                  inputMode="numeric"
                  placeholder="Guild PIN"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value)}
                />
                <input
                  className="guild-form__input"
                  type="text"
                  placeholder="Character name"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Joining…" : "Join Guild"}
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={registerGuild} className="guild-form">
            <input
              className="guild-form__input"
              type="text"
              placeholder="Guild name"
              value={newGuildName}
              onChange={(e) => setNewGuildName(e.target.value)}
            />
            <input
              className="guild-form__input"
              type="password"
              inputMode="numeric"
              placeholder="Set a PIN (4-8 digits)"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />
            <input
              className="guild-form__input"
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
            />
            <input
              className="guild-form__input"
              type="text"
              placeholder="Character name"
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Registering…" : "Register Guild"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

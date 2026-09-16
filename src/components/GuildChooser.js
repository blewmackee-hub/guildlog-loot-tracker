"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { postJSON } from "@/lib/apiClient";

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
  // "loading" | "ok" | "error" - lets the results panel distinguish a
  // search in flight from a genuine zero-results answer from a dropped
  // request, instead of a failed fetch silently reading as "this guild
  // doesn't exist."
  const [searchStatus, setSearchStatus] = useState("loading");
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [joinPin, setJoinPin] = useState("");
  const [characterName, setCharacterName] = useState("");

  useEffect(() => {
    if (mode !== "find") return;
    const t = setTimeout(() => {
      setSearchStatus("loading");
      fetch(`/api/guilds?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.guilds || []);
          setSearchStatus("ok");
        })
        .catch(() => {
          setResults([]);
          setSearchStatus("error");
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function joinGuild(e) {
    e.preventDefault();
    if (!selectedGuild) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON(`/api/guilds/${selectedGuild.id}/join`, { pin: joinPin, characterName });
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
  const pinsMismatch = newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin;

  async function registerGuild(e) {
    e.preventDefault();
    if (pinsMismatch) return;
    setBusy(true);
    setError(null);
    try {
      const { guild } = await postJSON("/api/guilds", { name: newGuildName, pin: newPin });
      // Registering doesn't auto-join - immediately join with the
      // same PIN so "register" feels like one step, not two.
      await postJSON(`/api/guilds/${guild.id}/join`, { pin: newPin, characterName: newCharacterName });
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const cardBody = (
    <>
      <div className="guild-chooser__intro">
        <div className="auth-card__crest"><div className="auth-card__crest-gem" /></div>
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

      {error && <p className="auth-error" role="alert">{error}</p>}

      {mode === "find" && (
        <p className="muted guild-chooser__hint">
          Already registered? Discord login only confirms who you are - search for your guild below and enter the
          same character name and PIN you used before to get back to your page.
        </p>
      )}

      {mode === "find" ? (
        <form onSubmit={joinGuild} className="guild-form" key="find">
          <input
            className="search-row__input guild-form__input"
            type="text"
            placeholder="Search guild name…"
            aria-label="Search guild name"
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedGuild(null); }}
          />
          {!selectedGuild && (
            <div className="guild-results" aria-live="polite">
              {searchStatus === "loading" && <p className="muted">Searching…</p>}
              {searchStatus === "error" && (
                <p className="auth-error">Couldn&apos;t reach the server — check your connection and try again.</p>
              )}
              {searchStatus === "ok" && results.length === 0 && (
                <p className="muted">No guilds found. Maybe register it below instead?</p>
              )}
              {searchStatus === "ok" &&
                results.map((g, i) => (
                  <button
                    type="button"
                    key={g.id}
                    className="guild-result-row scan-row"
                    style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                    onClick={() => setSelectedGuild(g)}
                  >
                    {g.name}
                  </button>
                ))}
            </div>
          )}
          {selectedGuild && (
            <>
              <p className="muted guild-chooser__joining">
                <button
                  type="button"
                  className="guild-chooser__back"
                  onClick={() => { setSelectedGuild(null); setJoinPin(""); }}
                  title="Back to search results"
                  aria-label="Back to search results"
                >
                  <ArrowLeft size={14} strokeWidth={2} />
                </button>
                Joining <strong>{selectedGuild.name}</strong>
              </p>
              <input
                className="guild-form__input"
                type="password"
                inputMode="numeric"
                placeholder="Guild PIN"
                aria-label="Guild PIN"
                autoComplete="off"
                spellCheck={false}
                value={joinPin}
                onChange={(e) => setJoinPin(e.target.value)}
              />
              <input
                className="guild-form__input"
                type="text"
                placeholder="Character name"
                aria-label="Character name"
                autoComplete="off"
                spellCheck={false}
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
        <form onSubmit={registerGuild} className="guild-form" key="register">
          <input
            className="guild-form__input"
            type="text"
            placeholder="Guild name"
            aria-label="Guild name"
            autoComplete="off"
            spellCheck={false}
            value={newGuildName}
            onChange={(e) => setNewGuildName(e.target.value)}
          />
          <input
            className="guild-form__input"
            type="password"
            inputMode="numeric"
            placeholder="Set a PIN (4-8 digits)"
            aria-label="Set a PIN, 4 to 8 digits"
            autoComplete="off"
            spellCheck={false}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
          <input
            className={`guild-form__input ${pinsMismatch ? "guild-form__input--invalid" : ""}`}
            type="password"
            inputMode="numeric"
            placeholder="Confirm PIN"
            aria-label="Confirm PIN"
            aria-invalid={pinsMismatch}
            aria-describedby={pinsMismatch ? "confirm-pin-hint" : undefined}
            autoComplete="off"
            spellCheck={false}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
          />
          {pinsMismatch && (
            <span id="confirm-pin-hint" className="guild-form__hint guild-form__hint--danger">PINs don&apos;t match.</span>
          )}
          <input
            className="guild-form__input"
            type="text"
            placeholder="Character name"
            aria-label="Character name"
            autoComplete="off"
            spellCheck={false}
            value={newCharacterName}
            onChange={(e) => setNewCharacterName(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || pinsMismatch}>
            {busy ? "Registering…" : "Register Guild"}
          </button>
        </form>
      )}
    </>
  );

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--wide">
        {cardBody}
      </div>
    </div>
  );
}

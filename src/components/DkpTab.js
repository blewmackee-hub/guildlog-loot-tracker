"use client";

import { useState, useEffect, useRef } from "react";
import { Crown, Shield, Check, X } from "lucide-react";
import { postJSON } from "@/lib/apiClient";

// The "decay just ran" notice comes back from the server for 48 hours
// after each scheduled decay; remember (per browser) that it was dismissed
// so switching tabs doesn't bring it back.
const decayKey = (appliedAt) => `dkp-decay-dismissed:${appliedAt}`;
function decayDismissed(appliedAt) {
  try { return localStorage.getItem(decayKey(appliedAt)) === "1"; } catch { return false; }
}
function dismissDecay(appliedAt) {
  try { localStorage.setItem(decayKey(appliedAt), "1"); } catch {}
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Officer/leader editor for the guild's weekly DKP decay - same gate
// as the rest of the DKP tab's controls, not leader-only (see
// setDecaySettings in src/lib/guilds.js; the daily scheduled job applies
// it, see applyDueDecays). Plain members get a read-only summary.
function DecayControl({ decay, canEdit, onSave, busy }) {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(0);
  const [weekday, setWeekday] = useState(0);

  const summary = decay?.pct > 0 ? `${decay.pct}% every ${WEEKDAY_LABELS[decay.weekday]}` : "Off";

  if (!canEdit) {
    return (
      <div className="dkp-decay">
        <span className="dkp-decay__label">Weekly Decay</span>
        <span className="muted">{summary}</span>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        className="dkp-decay dkp-decay--button"
        onClick={() => {
          setPct(decay?.pct ?? 0);
          setWeekday(decay?.weekday ?? 0);
          setEditing(true);
        }}
        title="Edit weekly DKP decay"
      >
        <span className="dkp-decay__label">Weekly Decay</span>
        <span className="dkp-decay__value">{summary}</span>
      </button>
    );
  }

  return (
    <div className="dkp-decay dkp-decay--editing">
      <span className="dkp-decay__label">Weekly Decay</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max="100"
        className="dkp-decay__pct"
        aria-label="Weekly decay percentage"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
      />
      <span className="muted">%</span>
      <select
        className="dkp-decay__day"
        aria-label="Day of the week decay applies"
        value={weekday}
        onChange={(e) => setWeekday(Number(e.target.value))}
        disabled={Number(pct) === 0}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <option key={i} value={i}>{label}</option>
        ))}
      </select>
      <button
        className="btn-secondary btn-secondary--sm"
        disabled={busy}
        onClick={() => {
          onSave(Number(pct) || 0, Number(weekday));
          setEditing(false);
        }}
      >
        Save
      </button>
      <button className="btn-secondary btn-secondary--sm" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

/* Visible to every guild member (unlike GuildMembers, which is
   leader-only) - the server still re-checks who's allowed to edit
   anything (adjustDkp/setOfficer in src/lib/guilds.js), this component
   just hides controls that would 403.

   DKP is never typed in directly - only adjusted by delta (the +/-
   boxes, per-row or applied in bulk to every checked row) so there's
   always a "what changed and by how much" story instead of a bare
   overwritten number. */
export default function DkpTab() {
  const [roster, setRoster] = useState(null);
  const [myRole, setMyRole] = useState("member");
  const [officerCap, setOfficerCap] = useState(3);
  const [decay, setDecay] = useState(null);
  const [log, setLog] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [rowDraft, setRowDraft] = useState({}); // discordId -> { add, subtract }
  const [bulkAdd, setBulkAdd] = useState("");
  const [bulkSubtract, setBulkSubtract] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [decayBanner, setDecayBanner] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // discordId of a former member
  // discordId -> "good" | "bad", cleared a moment after a row's total
  // changes so the cell gets a brief flash instead of just snapping to
  // its new value with no feedback.
  const [flash, setFlash] = useState({});
  // The most recent adjustment, kept around for a few seconds so it can
  // be reversed with one click instead of re-typing the opposite delta.
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);

  function load() {
    fetch("/api/guild/dkp")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRoster(data.roster);
        setMyRole(data.myRole);
        setOfficerCap(data.officerCap);
        setDecay(data.decay);
        if (data.decayApplied && !decayDismissed(data.decayApplied.appliedAt)) setDecayBanner(data.decayApplied);
        setLog(data.log || []);
      })
      .catch((e) => setError(e.message));
  }

  function flashRows(discordIds, sign) {
    setFlash((f) => ({ ...f, ...Object.fromEntries(discordIds.map((id) => [id, sign])) }));
    setTimeout(() => {
      setFlash((f) => {
        const next = { ...f };
        discordIds.forEach((id) => delete next[id]);
        return next;
      });
    }, 700);
  }

  function offerUndo(discordIds, delta, reason) {
    clearTimeout(undoTimer.current);
    setUndo({ discordIds, delta, reason });
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
  }

  function dismissUndo() {
    clearTimeout(undoTimer.current);
    setUndo(null);
  }

  useEffect(load, []);

  async function saveDecay(pct, weekday) {
    setBusyKey("decay");
    setError(null);
    try {
      await postJSON("/api/guild/decay", { pct, weekday });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  const canEdit = myRole === "leader" || myRole === "officer";
  const canAssignOfficers = myRole === "leader";
  const officerCount = roster ? roster.filter((m) => m.role === "officer").length : 0;
  const allSelected = roster && roster.length > 0 && roster.every((m) => selected.has(m.discordId));

  function toggleSelect(discordId) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(discordId)) next.delete(discordId);
      else next.add(discordId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(roster.map((m) => m.discordId)));
  }

  async function adjustDkp(discordIds, delta, busyId, reason, { offersUndo = true } = {}) {
    if (!Number.isInteger(delta) || delta === 0 || discordIds.length === 0) return;
    setBusyKey(busyId);
    setError(null);
    try {
      await postJSON("/api/guild/dkp", { discordIds, delta, reason });
      flashRows(discordIds, delta > 0 ? "good" : "bad");
      if (offersUndo) offerUndo(discordIds, delta, reason);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  function undoLastAction() {
    if (!undo) return;
    const { discordIds, delta, reason } = undo;
    dismissUndo();
    adjustDkp(discordIds, -delta, "undo", `Undo: ${reason || "adjustment"}`, { offersUndo: false });
  }

  async function setOfficer(discordId, makeOfficer) {
    setBusyKey(`officer:${discordId}`);
    setError(null);
    try {
      await postJSON("/api/guild/officers", { discordId, makeOfficer });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function removeMember(discordId) {
    setBusyKey(`remove:${discordId}`);
    setError(null);
    try {
      await postJSON("/api/guild/dkp", { discordId }, "DELETE");
      setConfirmRemove(null);
      setSelected((s) => {
        const next = new Set(s);
        next.delete(discordId);
        return next;
      });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  function rowValue(discordId, field) {
    return rowDraft[discordId]?.[field] ?? "";
  }
  function setRowValue(discordId, field, value) {
    setRowDraft((d) => ({ ...d, [discordId]: { ...d[discordId], [field]: value } }));
  }

  return (
    <div className="dkp-tab panel">
      <div className="dkp-tab__head">
        <h3 className="panel-title">DKP</h3>
        {roster && (
          <DecayControl decay={decay} canEdit={canEdit} onSave={saveDecay} busy={busyKey === "decay"} />
        )}
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {decayBanner && (
        <div className="dkp-decay-banner">
          <span>
            Weekly decay applied: −{decayBanner.pct}% to {decayBanner.affected} member{decayBanner.affected === 1 ? "" : "s"}. Details are in the history.
          </span>
          <button className="dkp-decay-banner__dismiss" onClick={() => { dismissDecay(decayBanner.appliedAt); setDecayBanner(null); }} aria-label="Dismiss">
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      )}
      {undo && (
        <div className="dkp-undo-banner">
          <span>{undo.delta > 0 ? "Added" : "Subtracted"} {Math.abs(undo.delta)} DKP.</span>
          <button className="btn-secondary btn-secondary--sm" onClick={undoLastAction}>Undo</button>
          <button className="dkp-decay-banner__dismiss" onClick={dismissUndo} aria-label="Dismiss">
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      )}
      {!roster && !error && <p className="muted">Loading…</p>}
      {roster && roster.length === 0 && <p className="muted">No members yet.</p>}
      {canAssignOfficers && (
        <p className="muted dkp-tab__cap-note">Officer slots: {officerCount}/{officerCap}</p>
      )}

      {canEdit && roster && roster.length > 0 && (
        <div className="dkp-reason-row">
          <input
            type="text"
            className="dkp-reason-row__input"
            placeholder="Adjustment note (for the log history) — e.g. PvP Archboss"
            aria-label="Adjustment note"
            autoComplete="off"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
        </div>
      )}

      {roster && roster.length > 0 && (
        <div className="dkp-table__scroll">
          <table className="dkp-table">
            <thead>
              <tr>
                {canEdit && (
                  <th className="dkp-table__select-col">
                    <button
                      className={`trait-pool__check ${allSelected ? "trait-pool__check--checked" : ""}`}
                      onClick={toggleSelectAll}
                      title={allSelected ? "Deselect all" : "Select all"}
                      aria-label={allSelected ? "Deselect all" : "Select all"}
                      aria-pressed={allSelected}
                    >
                      {allSelected && <Check size={12} strokeWidth={3} />}
                    </button>
                  </th>
                )}
                <th className="dkp-table__name-col">Name</th>
                <th className="dkp-table__total-col">DKP</th>
                {canEdit && (
                  <>
                    <th className="dkp-table__adjust-col">
                      <div className="dkp-table__bulk">
                        <span className="dkp-table__sign">+</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="dkp-table__bulk-input"
                          aria-label="DKP to add to selected members"
                          value={bulkAdd}
                          onChange={(e) => setBulkAdd(e.target.value)}
                          placeholder="0"
                        />
                        <button
                          className="btn-secondary btn-secondary--sm dkp-apply-btn"
                          disabled={busyKey === "bulk-add" || selected.size === 0 || !bulkAdd}
                          onClick={() => adjustDkp([...selected], Number.parseInt(bulkAdd, 10), "bulk-add", bulkReason)}
                          title="Apply Selected"
                        >
                          <Check size={12} strokeWidth={3} className="dkp-apply-btn__icon" />
                          <span className="dkp-apply-btn__label">Apply Selected</span>
                        </button>
                      </div>
                    </th>
                    <th className="dkp-table__adjust-col">
                      <div className="dkp-table__bulk">
                        <span className="dkp-table__sign">−</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="dkp-table__bulk-input"
                          aria-label="DKP to subtract from selected members"
                          value={bulkSubtract}
                          onChange={(e) => setBulkSubtract(e.target.value)}
                          placeholder="0"
                        />
                        <button
                          className="btn-secondary btn-secondary--sm dkp-apply-btn"
                          disabled={busyKey === "bulk-subtract" || selected.size === 0 || !bulkSubtract}
                          onClick={() => adjustDkp([...selected], -Number.parseInt(bulkSubtract, 10), "bulk-subtract", bulkReason)}
                          title="Apply Selected"
                        >
                          <Check size={12} strokeWidth={3} className="dkp-apply-btn__icon" />
                          <span className="dkp-apply-btn__label">Apply Selected</span>
                        </button>
                      </div>
                    </th>
                  </>
                )}
                {canAssignOfficers && <th />}
              </tr>
            </thead>
            <tbody>
              {roster.map((m, i) => (
                <tr
                  key={m.discordId}
                  className={`scan-row ${selected.has(m.discordId) ? "dkp-table__row--selected" : ""}`}
                  style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                >
                  {canEdit && (
                    <td>
                      <button
                        className={`trait-pool__check ${selected.has(m.discordId) ? "trait-pool__check--checked" : ""}`}
                        onClick={() => toggleSelect(m.discordId)}
                        title="Select"
                        aria-label={`Select ${m.username}`}
                        aria-pressed={selected.has(m.discordId)}
                      >
                        {selected.has(m.discordId) && <Check size={12} strokeWidth={3} />}
                      </button>
                    </td>
                  )}
                  <td>
                    <span className="dkp-table__name">
                      {m.username}
                      {m.role === "leader" && <span className="guild-member-row__owner-badge">Leader</span>}
                      {m.role === "officer" && <span className="dkp-row__officer-badge">Officer</span>}
                      {canEdit && m.role !== "leader" && !m.inGuild && (
                        confirmRemove === m.discordId ? (
                          <span className="dkp-row__remove-confirm">
                            <span className="profile-bar__leave-warning">Remove from table?</span>
                            <button
                              className="profile-bar__leave-confirm"
                              disabled={busyKey === `remove:${m.discordId}`}
                              onClick={() => removeMember(m.discordId)}
                            >
                              {busyKey === `remove:${m.discordId}` ? "Removing…" : "Remove"}
                            </button>
                            <button className="btn-secondary btn-secondary--sm" onClick={() => setConfirmRemove(null)}>Cancel</button>
                          </span>
                        ) : (
                          <>
                            <span className="muted dkp-row__left-badge">Left guild</span>
                            <button
                              className="guild-member-row__kick"
                              title="Remove from DKP table"
                              aria-label={`Remove ${m.username} from the DKP table`}
                              onClick={() => setConfirmRemove(m.discordId)}
                            >
                              <X size={14} strokeWidth={1.5} />
                            </button>
                          </>
                        )
                      )}
                    </span>
                    {m.characters?.length > 0 && <span className="muted dkp-table__chars">{m.characters.join(", ")}</span>}
                  </td>
                  <td className={`dkp-table__total ${flash[m.discordId] ? `dkp-table__total--flash-${flash[m.discordId]}` : ""}`}>
                    {m.dkpTotal}
                  </td>
                  {canEdit && (
                    <>
                      <td className="dkp-table__adjust-col">
                        <div className="dkp-table__row-adjust">
                          <span className="dkp-table__sign">+</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="dkp-table__row-input"
                            placeholder="0"
                            aria-label={`DKP to add to ${m.username}`}
                            value={rowValue(m.discordId, "add")}
                            onChange={(e) => setRowValue(m.discordId, "add", e.target.value)}
                          />
                          <button
                            className="btn-secondary btn-secondary--sm dkp-apply-btn"
                            disabled={busyKey === `row-add:${m.discordId}` || !rowValue(m.discordId, "add")}
                            onClick={() => adjustDkp([m.discordId], Number.parseInt(rowValue(m.discordId, "add"), 10), `row-add:${m.discordId}`, bulkReason)}
                            title="Apply"
                          >
                            <Check size={12} strokeWidth={3} className="dkp-apply-btn__icon" />
                            <span className="dkp-apply-btn__label">Apply</span>
                          </button>
                        </div>
                      </td>
                      <td className="dkp-table__adjust-col">
                        <div className="dkp-table__row-adjust">
                          <span className="dkp-table__sign">−</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="dkp-table__row-input"
                            placeholder="0"
                            aria-label={`DKP to subtract from ${m.username}`}
                            value={rowValue(m.discordId, "subtract")}
                            onChange={(e) => setRowValue(m.discordId, "subtract", e.target.value)}
                          />
                          <button
                            className="btn-secondary btn-secondary--sm dkp-apply-btn"
                            disabled={busyKey === `row-subtract:${m.discordId}` || !rowValue(m.discordId, "subtract")}
                            onClick={() => adjustDkp([m.discordId], -Number.parseInt(rowValue(m.discordId, "subtract"), 10), `row-subtract:${m.discordId}`, bulkReason)}
                            title="Apply"
                          >
                            <Check size={12} strokeWidth={3} className="dkp-apply-btn__icon" />
                            <span className="dkp-apply-btn__label">Apply</span>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                  {canAssignOfficers && (
                    <td>
                      {m.role !== "leader" && (
                        m.role === "officer" ? (
                          <button
                            className="guild-member-row__kick"
                            title="Remove officer"
                            aria-label={`Remove ${m.username} as officer`}
                            disabled={busyKey === `officer:${m.discordId}`}
                            onClick={() => setOfficer(m.discordId, false)}
                          >
                            <Shield size={14} strokeWidth={1.5} />
                          </button>
                        ) : (
                          <button
                            className="guild-member-row__promote"
                            title={officerCount >= officerCap ? `Officer slots full (${officerCap}/${officerCap})` : "Make officer"}
                            aria-label={`Make ${m.username} an officer`}
                            disabled={busyKey === `officer:${m.discordId}` || officerCount >= officerCap}
                            onClick={() => setOfficer(m.discordId, true)}
                          >
                            <Crown size={14} strokeWidth={1.5} />
                          </button>
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roster && roster.length > 0 && (
        <div className="dkp-history">
          <button className="dkp-history__toggle" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? "Hide History" : `Show History (${log.length})`}
          </button>
          {showHistory && (
            <div className="dkp-history__list">
              {log.length === 0 && <p className="muted">No DKP adjustments yet.</p>}
              {log.map((entry) => (
                <div className="dkp-history__row" key={entry.id}>
                  <span className="dkp-history__text">
                    <span className={`dkp-history__delta ${entry.delta > 0 ? "dkp-history__delta--good" : "dkp-history__delta--bad"}`}>
                      {entry.delta > 0 ? "+" : "−"}{Math.abs(entry.delta)}
                    </span>{" "}
                    <strong>{entry.actorUsername}</strong> {entry.delta > 0 ? "added" : "subtracted"}{" "}
                    <strong>{Math.abs(entry.delta)}</strong> {entry.delta > 0 ? "to" : "from"}{" "}
                    <strong>{entry.targetUsername}</strong>
                    {entry.reason && <span className="muted"> — {entry.reason}</span>}
                  </span>
                  <span className="dkp-history__time muted">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

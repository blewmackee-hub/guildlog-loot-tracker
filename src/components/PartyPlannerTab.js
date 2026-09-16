"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Camera } from "lucide-react";
import { CLASS_ROLES, PARTY_GROUP_COUNT, PARTY_SLOT_COUNT } from "@/lib/gameData";
import { postJSON } from "@/lib/apiClient";
import CustomSelect from "./CustomSelect";
import Modal from "./Modal";

function blankGroups() {
  return Array.from({ length: PARTY_GROUP_COUNT }, () => ({
    name: "",
    slots: Array.from({ length: PARTY_SLOT_COUNT }, () => ({ member: null, className: null })),
  }));
}

/* Officer/leader editor for guild party comps - up to PARTY_GROUP_COUNT
   named 6-player groups, each slot an independent (member, class) pair
   picked from the guild's own roster (members, from listGuildMemberNames)
   and CLASS_ROLES. Boards are saved as named templates (party_templates
   table, src/lib/guilds.js) and picked from the "Saved" list on the
   left; the board in the main panel is always either a loaded template
   or an unsaved new one (selectedId === null). Plain members see the
   same board read-only - the server still re-checks who's allowed to
   write (createPartyTemplate/updatePartyTemplate/deletePartyTemplate),
   this component just hides the controls that would 403. */
export default function PartyPlannerTab() {
  const [templates, setTemplates] = useState(null);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState("member");
  const [selectedId, setSelectedId] = useState(null);
  const [boardName, setBoardName] = useState("");
  const [groups, setGroups] = useState(blankGroups());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const canEdit = myRole === "leader" || myRole === "officer";

  function memberName(discordId) {
    return members.find((m) => m.discordId === discordId)?.username || "";
  }

  function selectTemplate(t) {
    setSelectedId(t.id);
    setBoardName(t.name);
    setGroups(
      t.groups.map((g) => ({
        name: g.name || "",
        slots: g.slots.map((s) =>
          typeof s === "string" ? { member: null, className: s || null } : { member: s?.member || null, className: s?.className || null }
        ),
      }))
    );
    setConfirmingDeleteId(null);
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setBoardName("");
    setGroups(blankGroups());
    setConfirmingDeleteId(null);
    setError(null);
  }

  function refreshList() {
    return fetch("/api/guild/parties")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setTemplates(data.templates);
        setMembers(data.members || []);
        setMyRole(data.myRole);
        return data.templates;
      });
  }

  // Auto-load the first saved board on arrival, if one exists, so
  // both viewers and editors land on something useful rather than a
  // blank board.
  useEffect(() => {
    refreshList()
      .then((list) => {
        if (list.length > 0) selectTemplate(list[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  function setGroupName(idx, name) {
    setGroups((g) => g.map((grp, i) => (i === idx ? { ...grp, name } : grp)));
  }

  function setSlot(idx, slotIdx, patch) {
    setGroups((g) =>
      g.map((grp, i) =>
        i === idx
          ? { ...grp, slots: grp.slots.map((s, si) => (si === slotIdx ? { ...s, ...patch } : s)) }
          : grp
      )
    );
  }

  async function save() {
    if (!boardName.trim()) {
      setError("Give this board a name before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = selectedId
        ? await postJSON(`/api/guild/parties/${selectedId}`, { name: boardName, groups }, "PUT")
        : await postJSON("/api/guild/parties", { name: boardName, groups });
      const list = await refreshList();
      const fresh = list.find((t) => t.id === data.template.id);
      if (fresh) selectTemplate(fresh);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAsNew() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJSON("/api/guild/parties", { name: `${boardName || "Untitled"} Copy`, groups });
      const list = await refreshList();
      const fresh = list.find((t) => t.id === data.template.id);
      if (fresh) selectTemplate(fresh);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(id) {
    setBusy(true);
    setError(null);
    try {
      await postJSON(`/api/guild/parties/${id}`, null, "DELETE");
      const list = await refreshList();
      if (id === selectedId) {
        if (list.length > 0) selectTemplate(list[0]);
        else startNew();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div className="party-planner">
      <div className="party-planner__sidebar">
        <div className="party-planner__sidebar-head">
          <span>Saved</span>
          {canEdit && (
            <button className="party-planner__new-btn" title="Start a new board" onClick={startNew}>
              <Plus size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="party-planner__template-list">
          {templates === null && !error && <p className="muted">Loading…</p>}
          {templates && templates.length === 0 && <p className="muted">No saved boards yet.</p>}
          {templates &&
            templates.map((t) => (
              <div
                key={t.id}
                className={`party-planner__template-row ${selectedId === t.id ? "party-planner__template-row--active" : ""}`}
              >
                <button className="party-planner__template-name" onClick={() => selectTemplate(t)}>
                  {t.name}
                </button>
                {canEdit &&
                  (confirmingDeleteId === t.id ? (
                    <span className="party-planner__confirm-delete">
                      <button className="profile-bar__leave-confirm" disabled={busy} onClick={() => deleteTemplate(t.id)}>
                        Delete
                      </button>
                      <button className="btn-secondary btn-secondary--sm" onClick={() => setConfirmingDeleteId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="party-planner__template-delete"
                      title="Delete board"
                      onClick={() => setConfirmingDeleteId(t.id)}
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  ))}
              </div>
            ))}
        </div>
      </div>

      <div className="party-planner__board">
        <div className="party-planner__board-head">
          {canEdit ? (
            <input
              type="text"
              className="party-planner__board-name-input"
              placeholder="Board name…"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
            />
          ) : (
            <h3 className="panel-title">{boardName || "Party Planner"}</h3>
          )}
          <div className="party-planner__board-actions">
            <button className="btn-secondary btn-secondary--sm" onClick={() => setShowScreenshot(true)}>
              <Camera size={13} strokeWidth={2} /> Screenshot
            </button>
            {canEdit && (
              <>
                <button className="btn-secondary btn-secondary--sm" disabled={busy} onClick={save}>
                  {selectedId ? "Save" : "Save New Board"}
                </button>
                {selectedId && (
                  <button className="btn-secondary btn-secondary--sm" disabled={busy} onClick={saveAsNew}>
                    Save As New
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {!canEdit && (
          <p className="muted party-planner__view-note">Viewing only — officers and the guild leader can edit party groups.</p>
        )}

        <div className="party-planner__groups" key={selectedId ?? "new"}>
          {groups.map((group, gi) => (
            <div className="party-planner__group" key={gi}>
              {canEdit ? (
                <input
                  type="text"
                  className="party-planner__group-name-input"
                  placeholder={`Group ${gi + 1}`}
                  value={group.name}
                  onChange={(e) => setGroupName(gi, e.target.value)}
                />
              ) : (
                <div className="party-planner__group-name">{group.name || `Group ${gi + 1}`}</div>
              )}
              <div className="party-planner__slots">
                {group.slots.map((slot, si) => (
                  <div className="party-planner__slot" key={si}>
                    {canEdit ? (
                      <>
                        <CustomSelect
                          className="party-planner__slot-select party-planner__slot-select--member"
                          value={slot.member || ""}
                          onChange={(v) => setSlot(gi, si, { member: v || null })}
                          placeholder="— unassigned —"
                          ariaLabel="Member"
                          options={members.map((m) => ({ value: m.discordId, label: m.username }))}
                        />
                        <CustomSelect
                          className="party-planner__slot-select"
                          value={slot.className || ""}
                          onChange={(v) => setSlot(gi, si, { className: v || null })}
                          placeholder="— class —"
                          ariaLabel="Class"
                          options={CLASS_ROLES.map((c) => ({ value: c, label: c }))}
                        />
                      </>
                    ) : (
                      <span className={`party-planner__slot-value ${!slot.member && !slot.className ? "muted" : ""}`}>
                        {slot.member || slot.className
                          ? `${slot.member ? memberName(slot.member) : "—"}${slot.className ? ` · ${slot.className}` : ""}`
                          : "— empty —"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showScreenshot && (
        <Modal title={boardName || "Party Planner"} onClose={() => setShowScreenshot(false)} className="modal-panel--wide">
          <div className="party-planner__groups party-screenshot__groups">
            {groups.map((group, gi) => (
              <div className="party-planner__group" key={gi}>
                <div className="party-planner__group-name">{group.name || `Group ${gi + 1}`}</div>
                <div className="party-planner__slots">
                  {group.slots.map((slot, si) => (
                    <span key={si} className={`party-planner__slot-value ${!slot.member && !slot.className ? "muted" : ""}`}>
                      {slot.member || slot.className
                        ? `${slot.member ? memberName(slot.member) : "—"}${slot.className ? ` · ${slot.className}` : ""}`
                        : "— empty —"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

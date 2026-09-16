"use client";

import { useState } from "react";
import { X, SlidersHorizontal, Sparkle, Dices, Check, Sword, Shirt, Gem, Circle, Droplet, Link2, CircleDot, Pin } from "lucide-react";
import RarityDot from "./RarityDot";
import ItemIcon from "./ItemIcon";
import Modal from "./Modal";
import { SLOTS, RARITIES } from "@/lib/gameData";
import { ITEMS, POTENTIAL_CATALOGS } from "@/lib/calculations";

// Real item icons only exist for actual items - an empty slot has
// nothing to show yet, so it gets a generic circular icon for its
// broad equipment group instead (weapon/armor/accessory) rather than
// the old plain dashed rectangle.
const GROUP_ICON = { weapon: Sword, armor: Shirt, accessory: Gem };
// Accessory slots all share the "accessory" group above, but a Ring
// and a Necklace are nothing alike - give each its own silhouette so
// an empty accessory row reads at a glance instead of six identical
// gems.
const SLOT_ICON = { ring: Circle, necklace: Gem, earring: Droplet, belt: Link2, bracelet: CircleDot, brooch: Pin };

const SKILL_CORES = Object.values(ITEMS).filter((i) => i.isSkillCore);
const MAX_TRAITS = 3;
// How many of the Heroic Trait pool a Heroic item can have active at
// once - varies by equipment type, not a flat "1 of N" like the rest of
// the pick-pools here.
const HEROIC_TRAIT_CAP = { weapon: 2, armor: 3, accessory: 3 };
const TRAIT_TIERS = [1, 2, 3, 4];
const EMPTY_RESONANCE = { name: "", tier: 1 };

function formatPotentialOption(opt) {
  return opt.type === "stat" ? `${opt.label} +${opt.value}${opt.isPercent ? "%" : ""}` : opt.label;
}

function formatTierValue(value, isPercent) {
  return isPercent ? `${value}%` : `${value}`;
}

// Only the selections that are actually made show up anywhere outside
// the edit modal - the paperdoll slot itself stays a compact read-only
// summary, not a form. Needs `item` (not just the wishlist entry) to
// resolve a selected {id, tier} pair back to its label - the entry only
// stores the id, the label/tiers live on item.traitOptions/heroicTraitOptions.
function traitSummary(item, entry) {
  const parts = [];
  const traitOptions = item.traitOptions || [];
  const heroicTraitOptions = item.heroicTraitOptions || [];
  const resonanceOptions = item.resonanceOptions || [];
  (entry.selectedTraits || []).forEach(({ id, tier }) => {
    const opt = traitOptions.find((o) => o.id === id);
    if (opt) parts.push(`${opt.label} Lv${tier}`);
  });
  if (item.rarity === "heroic") {
    (entry.selectedHeroicTrait || []).forEach(({ id, tier }) => {
      const opt = heroicTraitOptions.find((o) => o.id === id);
      if (opt) parts.push(`Heroic Trait: ${opt.label} Lv${tier}`);
    });
  } else if (resonanceOptions.length > 0) {
    (entry.selectedResonance || []).forEach(({ id, tier }) => {
      const opt = resonanceOptions.find((o) => o.id === id);
      if (opt) parts.push(`Resonance: ${opt.label} Lv${tier}`);
    });
  } else if (entry.resonance?.name) {
    parts.push(`Resonance: ${entry.resonance.name} Lv${entry.resonance.tier}`);
  }
  return parts;
}

/* One row per candidate trait in the item's real pool (item.traitOptions
   or item.heroicTraitOptions - see Transform-Questlog.ps1's
   ConvertTo-TraitOptions), each with its real per-tier values. Clicking
   a tier button both picks that trait (if not already picked) and sets
   its tier in one action; clicking the checkbox on an already-picked row
   drops it. maxPicks=1 behaves like a radio group (picking a new one
   replaces the old), matching Heroic Trait's "1 of N" pool (grade-51/
   Heroic items only). */
function TraitPoolPicker({ options, selected, maxPicks, onChange }) {
  function getTier(id) {
    return selected.find((s) => s.id === id)?.tier;
  }
  function drop(id) {
    onChange(selected.filter((s) => s.id !== id));
  }
  function pick(id, tier) {
    const already = selected.some((s) => s.id === id);
    if (already) {
      onChange(selected.map((s) => (s.id === id ? { ...s, tier } : s)));
    } else if (maxPicks === 1) {
      onChange([{ id, tier }]);
    } else if (selected.length < maxPicks) {
      onChange([...selected, { id, tier }]);
    }
  }

  return (
    <div className="trait-pool">
      {options.map((opt) => {
        const tier = getTier(opt.id);
        const isSelected = tier !== undefined;
        const atCap = !isSelected && maxPicks > 1 && selected.length >= maxPicks;
        return (
          <div className={`trait-pool__row ${isSelected ? "trait-pool__row--active" : ""}`} key={opt.id}>
            <button
              type="button"
              className="trait-pool__check"
              disabled={atCap}
              onClick={() => (isSelected ? drop(opt.id) : pick(opt.id, 1))}
              title={isSelected ? "Remove this trait" : "Select this trait"}
              aria-label={isSelected ? `Remove ${opt.label}` : `Select ${opt.label}`}
              aria-pressed={isSelected}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </button>
            <span className="trait-pool__label">{opt.label}</span>
            <div className="trait-pool__tiers">
              {opt.tiers.map((value, i) => (
                <button
                  key={i}
                  type="button"
                  className={`trait-pool__tier-btn ${isSelected && tier === i + 1 ? "trait-pool__tier-btn--active" : ""}`}
                  disabled={atCap}
                  onClick={() => pick(opt.id, i + 1)}
                >
                  {formatTierValue(value, opt.isPercent)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Every item gets a Resonance slot - but there's no scraped catalog of
   candidate Resonance traits for regular (non-Heroic) gear the way
   there is for Traits/Heroic Trait, so it stays a manual name + tier
   pick, same as Enchant below. */
function ResonanceField({ resonance, onChange }) {
  const value = resonance || EMPTY_RESONANCE;
  return (
    <div className="trait-modal__resonance-row">
      <input
        className="trait-modal__input"
        type="text"
        placeholder="Resonance trait…"
        aria-label="Resonance trait"
        autoComplete="off"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <div className="trait-tier-buttons">
        {TRAIT_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`trait-tier-btn ${value.tier === tier ? "trait-tier-btn--active" : ""}`}
            onClick={() => onChange({ ...value, tier })}
          >
            {tier}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Traits and Heroic Trait are each a real pick-N-of-the-item's-own-pool
   (item.traitOptions/heroicTraitOptions, from Questlog's itemStats.traits/
   uniqueTraits - see Transform-Questlog.ps1). Heroic Trait only exists on
   Heroic-grade items, replacing the Resonance slot every other item gets
   (HEROIC_TRAIT_CAP: 2 picks for weapons, 3 for armor/accessories - a
   real in-game rule, not a display choice). Potential Ability is its
   own separate slot/modal (like Skill Core) since it applies to any
   item with a potentialCatalogId, not just these two. Opened as a
   popup so the paperdoll itself stays scannable - the slot only ever
   shows a one-line summary. */
function TraitModal({ item, entry, equipmentGroup, onUpdateMeta, onClose }) {
  const traitOptions = item.traitOptions || [];
  const heroicTraitOptions = item.heroicTraitOptions || [];
  const resonanceOptions = item.resonanceOptions || [];
  const selectedTraits = entry.selectedTraits || [];
  const selectedHeroicTrait = entry.selectedHeroicTrait || [];
  const selectedResonance = entry.selectedResonance || [];
  const isHeroic = item.rarity === "heroic";
  const heroicCap = HEROIC_TRAIT_CAP[equipmentGroup] || 1;

  return (
    <Modal title={`${item.name} — Traits`} onClose={onClose}>
      <div className="trait-modal">
        <div className="trait-modal__section">
          <span className="trait-modal__section-label">Traits ({selectedTraits.length}/{MAX_TRAITS})</span>
          {traitOptions.length > 0 ? (
            <TraitPoolPicker
              options={traitOptions}
              selected={selectedTraits}
              maxPicks={MAX_TRAITS}
              onChange={(next) => onUpdateMeta({ selectedTraits: next })}
            />
          ) : (
            <p className="muted">No trait data for this item yet.</p>
          )}
        </div>

        <div className="trait-modal__section trait-modal__section--divider">
          {isHeroic ? (
            <>
              <span className="trait-modal__section-label">Heroic Trait ({selectedHeroicTrait.length}/{heroicCap})</span>
              {heroicTraitOptions.length > 0 ? (
                <TraitPoolPicker
                  options={heroicTraitOptions}
                  selected={selectedHeroicTrait}
                  maxPicks={heroicCap}
                  onChange={(next) => onUpdateMeta({ selectedHeroicTrait: next })}
                />
              ) : (
                <p className="muted">No Heroic Trait data for this item yet.</p>
              )}
            </>
          ) : resonanceOptions.length > 0 ? (
            <>
              <span className="trait-modal__section-label">Resonance ({selectedResonance.length}/1)</span>
              <TraitPoolPicker
                options={resonanceOptions}
                selected={selectedResonance}
                maxPicks={1}
                onChange={(next) => onUpdateMeta({ selectedResonance: next })}
              />
            </>
          ) : (
            <>
              <span className="trait-modal__section-label">Resonance</span>
              <ResonanceField resonance={entry.resonance} onChange={(next) => onUpdateMeta({ resonance: next })} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Two distinct kinds of Skill Core, never interchangeable:
//  - Weapon-extracted (weaponType set - see Transform-Questlog.ps1's
//    extractableSkillCore) only fits a Heroic WEAPON of that SAME
//    weapon type.
//  - "Regular" ones (no weaponType - the hand-added set, dropped by
//    bosses off the loot table) socket into a Heroic ARMOR or
//    ACCESSORY slot instead - never a weapon.
// A search box since the combined list runs past 280 entries.
function SkillCoreModal({ equipmentGroup, weaponType, entry, onUpdateMeta, onClose }) {
  const [query, setQuery] = useState("");
  const pool =
    equipmentGroup === "weapon"
      ? SKILL_CORES.filter((sc) => sc.weaponType === weaponType)
      : SKILL_CORES.filter((sc) => !sc.weaponType);
  const options = pool.filter((sc) => !query.trim() || sc.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Modal title="Choose a Skill Core" onClose={onClose}>
      <input
        className="trait-modal__input skillcore-modal__search"
        type="text"
        placeholder="Search skill cores…"
        aria-label="Search skill cores"
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="skillcore-modal">
        <button
          className={`skillcore-modal__option ${!entry.skillCoreId ? "skillcore-modal__option--active" : ""}`}
          onClick={() => {
            onUpdateMeta({ skillCoreId: null });
            onClose();
          }}
        >
          — None —
        </button>
        {options.length === 0 && <p className="muted">No skill cores match &quot;{query}&quot;.</p>}
        {options.map((sc) => (
          <button
            key={sc.id}
            className={`skillcore-modal__option ${entry.skillCoreId === sc.id ? "skillcore-modal__option--active" : ""}`}
            onClick={() => {
              onUpdateMeta({ skillCoreId: sc.id });
              onClose();
            }}
          >
            {sc.name}
            {sc.sourceItemName && <span className="skillcore-modal__source">from {sc.sourceItemName}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* item.potentialCatalogId points at one of a handful of shared pools
   (POTENTIAL_CATALOGS - see Transform-Questlog.ps1's
   Get-PotentialCatalogId) combining flat stat rolls and specific
   weapon-skill-level-ups into ONE pick - a real item only ever gets
   one Potential Ability, not one of each. Not gated by rarity or
   equipment type (unlike Skill Core) - whichever items Questlog marked
   as having a roll get this slot, and the pool itself isn't filtered
   by the equipped item's own weapon type either (a bow can roll a
   staff skill). Sorted most-likely-first already; still needs a search
   box; a real pool runs 64-72 entries. */
function PotentialAbilityModal({ item, entry, onUpdateMeta, onClose }) {
  const [query, setQuery] = useState("");
  const options = POTENTIAL_CATALOGS[item.potentialCatalogId] || [];
  const filtered = options.filter((opt) => !query.trim() || opt.label.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedId = entry.selectedPotential?.id;

  return (
    <Modal title="Potential Ability" onClose={onClose}>
      <input
        className="trait-modal__input skillcore-modal__search"
        type="text"
        placeholder="Search potential abilities…"
        aria-label="Search potential abilities"
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="skillcore-modal">
        <button
          className={`skillcore-modal__option ${!selectedId ? "skillcore-modal__option--active" : ""}`}
          onClick={() => {
            onUpdateMeta({ selectedPotential: null });
            onClose();
          }}
        >
          — None —
        </button>
        {filtered.length === 0 && <p className="muted">No options match &quot;{query}&quot;.</p>}
        {filtered.map((opt) => (
          <button
            key={opt.id}
            className={`skillcore-modal__option ${selectedId === opt.id ? "skillcore-modal__option--active" : ""}`}
            onClick={() => {
              onUpdateMeta({ selectedPotential: { id: opt.id, type: opt.type } });
              onClose();
            }}
          >
            {formatPotentialOption(opt)}
            <span className="skillcore-modal__source">{opt.probability}% chance</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default function Paperdoll({ wishlist, onRemove, onSlotClick, onLevelChange, onUpdateMeta }) {
  const [editingTraitsSlot, setEditingTraitsSlot] = useState(null);
  const [pickingSkillCoreSlot, setPickingSkillCoreSlot] = useState(null);
  const [pickingPotentialSlot, setPickingPotentialSlot] = useState(null);
  // Traits/Skill Core/Potential Ability only clutter a slot once it's
  // picked out - so they stay hidden until the filled slot itself is
  // clicked, and a second click (or picking another slot) collapses
  // them again.
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  return (
    <div className="paperdoll">
      {SLOTS.map((slot) => {
        const entry = wishlist[slot.id];
        const item = entry ? ITEMS[entry.itemId] : null;
        const summary = item ? traitSummary(item, entry) : [];
        const skillCore = item && entry.skillCoreId ? ITEMS[entry.skillCoreId] : null;
        const potentialCatalog = item?.potentialCatalogId ? POTENTIAL_CATALOGS[item.potentialCatalogId] : null;
        const selectedPotential = entry?.selectedPotential
          ? potentialCatalog?.find((o) => o.id === entry.selectedPotential.id)
          : null;
        const isSelected = selectedSlotId === slot.id;
        return (
          <div key={slot.id} className={`slot slot--${slot.group} ${item ? "slot--filled" : "slot--empty"} ${isSelected ? "slot--selected" : ""}`}>
            {item ? (
              <div className="slot__content" key={item.id} style={{ "--rarity-color": RARITIES[item.rarity]?.color }}>
                <div className="slot__top">
                  <RarityDot rarity={item.rarity} shape="diamond" />
                  <ItemIcon item={item} size={24} />
                  <button
                    className="slot__item-name"
                    onClick={() => setSelectedSlotId(isSelected ? null : slot.id)}
                    aria-expanded={isSelected}
                    title={isSelected ? "Hide traits and sockets" : "Show traits and sockets"}
                  >
                    {item.name}
                  </button>
                  <button className="slot__remove" onClick={() => onRemove(slot.id)} title="Remove" aria-label={`Remove ${item.name}`}>
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
                {item.levelRange && (
                  <div className="slot__level">
                    <input
                      type="range"
                      aria-label={`${item.name} level`}
                      min={item.levelRange.min}
                      max={item.levelRange.max}
                      value={entry.level}
                      onChange={(e) => onLevelChange(slot.id, Number(e.target.value))}
                    />
                    <span>Current Lv {entry.level}{entry.level < item.levelRange.max ? ` / ${item.levelRange.max}` : ""}</span>
                  </div>
                )}
                {isSelected && (
                  <>
                    <button
                      className="skillcore-slot"
                      onClick={() => setEditingTraitsSlot(slot.id)}
                      title={summary.length > 0 ? summary.join(", ") : undefined}
                    >
                      <SlidersHorizontal size={13} strokeWidth={1.5} className="skillcore-slot__icon" />
                      <span className="skillcore-slot__name">{summary.length > 0 ? summary.join(" · ") : "+ Traits"}</span>
                    </button>
                    {item.rarity === "heroic" && (
                      <button className="skillcore-slot" onClick={() => setPickingSkillCoreSlot(slot.id)}>
                        <Sparkle size={13} strokeWidth={1.5} className="skillcore-slot__icon" />
                        <span className="skillcore-slot__name">{skillCore ? skillCore.name : "+ Skill Core"}</span>
                      </button>
                    )}
                    {potentialCatalog && (
                      <button className="skillcore-slot" onClick={() => setPickingPotentialSlot(slot.id)}>
                        <Dices size={13} strokeWidth={1.5} className="skillcore-slot__icon" />
                        <span className="skillcore-slot__name">
                          {selectedPotential ? formatPotentialOption(selectedPotential) : "+ Potential Ability"}
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <button className="slot__empty-btn" onClick={() => onSlotClick(slot)}>
                <span className="slot__empty-icon">
                  {(() => {
                    const Icon = SLOT_ICON[slot.slotGroup] || GROUP_ICON[slot.group] || Gem;
                    return <Icon size={15} strokeWidth={1.5} />;
                  })()}
                </span>
                <span className="slot__label">{slot.label}</span>
              </button>
            )}
          </div>
        );
      })}

      {editingTraitsSlot && wishlist[editingTraitsSlot] && (
        <TraitModal
          item={ITEMS[wishlist[editingTraitsSlot].itemId]}
          entry={wishlist[editingTraitsSlot]}
          equipmentGroup={SLOTS.find((s) => s.id === editingTraitsSlot)?.group}
          onUpdateMeta={(patch) => onUpdateMeta(editingTraitsSlot, patch)}
          onClose={() => setEditingTraitsSlot(null)}
        />
      )}

      {pickingSkillCoreSlot && wishlist[pickingSkillCoreSlot] && (
        <SkillCoreModal
          equipmentGroup={SLOTS.find((s) => s.id === pickingSkillCoreSlot)?.group}
          weaponType={ITEMS[wishlist[pickingSkillCoreSlot].itemId]?.weaponType}
          entry={wishlist[pickingSkillCoreSlot]}
          onUpdateMeta={(patch) => onUpdateMeta(pickingSkillCoreSlot, patch)}
          onClose={() => setPickingSkillCoreSlot(null)}
        />
      )}

      {pickingPotentialSlot && wishlist[pickingPotentialSlot] && (
        <PotentialAbilityModal
          item={ITEMS[wishlist[pickingPotentialSlot].itemId]}
          entry={wishlist[pickingPotentialSlot]}
          onUpdateMeta={(patch) => onUpdateMeta(pickingPotentialSlot, patch)}
          onClose={() => setPickingPotentialSlot(null)}
        />
      )}
    </div>
  );
}

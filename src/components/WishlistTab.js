import { X, Info } from "lucide-react";
import RarityDot from "./RarityDot";
import { SLOTS } from "@/lib/gameData";
import { ITEMS, slotsForGroup } from "@/lib/calculations";

/* Multiple candidates per slot, unlike the paperdoll (one item per
   slot instance). Grouped by slot/slotGroup so "which helmet am I
   deciding between" reads as one list. */
export default function WishlistTab({ savedItems, wishlist, onEquip, onRemove, onLevelChange }) {
  const entries = Object.entries(savedItems)
    .map(([itemId, entry]) => ({ item: ITEMS[itemId], entry }))
    .filter(({ item }) => item);

  if (entries.length === 0) {
    return (
      <div className="detail-empty">
        <Info size={22} strokeWidth={1.3} />
        <p>Nothing saved yet — use &quot;Save to Wishlist&quot; on any item in the Database to start comparing options for a slot.</p>
      </div>
    );
  }

  const groups = {};
  entries.forEach(({ item, entry }) => {
    const groupKey = item.slot || item.slotGroup || (item.isSkillCore ? "skillcore" : "unassigned");
    const groupLabel = item.slot
      ? SLOTS.find((s) => s.id === item.slot)?.label
      : item.slotGroup
      ? slotsForGroup(item.slotGroup)[0]?.label
      : item.isSkillCore
      ? "Skill Cores"
      : "Unassigned";
    if (!groups[groupKey]) groups[groupKey] = { label: groupLabel, items: [] };
    groups[groupKey].items.push({ item, entry });
  });

  const equippedItemIds = new Set(Object.values(wishlist).filter(Boolean).map((e) => e.itemId));

  return (
    <div className="wishlist-tab">
      {Object.entries(groups).map(([groupKey, group]) => (
        <div className="wishlist-group" key={groupKey}>
          <h3 className="wishlist-group__label">{group.label}</h3>
          {group.items.map(({ item, entry }, i) => {
            const isEquipped = equippedItemIds.has(item.id);
            const candidates = !item.slot && item.slotGroup ? slotsForGroup(item.slotGroup) : null;
            return (
              <div className="wishlist-entry scan-row" key={item.id} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                <div className="wishlist-entry__top">
                  <RarityDot rarity={item.rarity} />
                  <span className="wishlist-entry__name">{item.name}</span>
                  {isEquipped && <span className="wishlist-entry__badge">Equipped</span>}
                  <button className="slot__remove" onClick={() => onRemove(item.id)} title="Remove from wishlist">
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
                {item.levelRange && (
                  <div className="slot__level">
                    <input
                      type="range"
                      min={item.levelRange.min}
                      max={item.levelRange.max}
                      value={entry.level ?? item.levelRange.max}
                      onChange={(e) => onLevelChange(item.id, Number(e.target.value))}
                    />
                    <span>Lv {entry.level ?? item.levelRange.max}</span>
                  </div>
                )}
                <div className="wishlist-entry__actions">
                  {item.slot && (
                    <button className="btn-secondary" onClick={() => onEquip(item)}>Equip</button>
                  )}
                  {candidates && candidates.map((s, i) => (
                    <button key={s.id} className="btn-secondary" onClick={() => onEquip(item, s.id)}>
                      Equip to {s.label} {i + 1}{wishlist[s.id] ? " (replace)" : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

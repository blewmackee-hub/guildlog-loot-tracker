import { X } from "lucide-react";
import RarityDot from "./RarityDot";
import { SLOTS } from "@/lib/gameData";
import { ITEMS } from "@/lib/calculations";

export default function Paperdoll({ wishlist, onRemove, onSlotClick, onLevelChange }) {
  return (
    <div className="paperdoll">
      {SLOTS.map((slot) => {
        const entry = wishlist[slot.id];
        const item = entry ? ITEMS[entry.itemId] : null;
        return (
          <div key={slot.id} className={`slot slot--${slot.group} ${item ? "slot--filled" : "slot--empty"}`}>
            {item ? (
              <>
                <div className="slot__top">
                  <RarityDot rarity={item.rarity} />
                  <span className="slot__item-name">{item.name}</span>
                  <button className="slot__remove" onClick={() => onRemove(slot.id)} title="Remove">
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
                {item.levelRange && (
                  <div className="slot__level">
                    <input
                      type="range"
                      min={item.levelRange.min}
                      max={item.levelRange.max}
                      value={entry.level}
                      onChange={(e) => onLevelChange(slot.id, Number(e.target.value))}
                    />
                    <span>Current Lv {entry.level}{entry.level < item.levelRange.max ? ` / ${item.levelRange.max}` : ""}</span>
                  </div>
                )}
              </>
            ) : (
              <button className="slot__empty-btn" onClick={() => onSlotClick(slot)}>
                <span className="slot__label">{slot.label}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

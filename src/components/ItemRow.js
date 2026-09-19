import { memo } from "react";
import { ChevronRight } from "lucide-react";
import RarityDot from "./RarityDot";
import ItemIcon from "./ItemIcon";
import { SLOTS, RARITIES } from "@/lib/gameData";
import { slotsForGroup } from "@/lib/calculations";

// Only the first screenful plays the entrance animation; the rest just appear.
const ANIMATED_ROWS = 16;

export default memo(function ItemRow({ item, onSelect, selected, index }) {
  const slotLabel = item.slot
    ? SLOTS.find((s) => s.id === item.slot)?.label
    : slotsForGroup(item.slotGroup)[0]?.label;
  const rarityColor = RARITIES[item.rarity]?.color;
  const isBloomRarity = item.rarity === "epic" || item.rarity === "heroic";
  return (
    <button
      className={`item-row ${index < ANIMATED_ROWS ? "scan-row" : ""} ${isBloomRarity && index < ANIMATED_ROWS ? "item-row--bloom" : ""} ${selected ? "item-row--selected" : ""}`}
      onClick={() => onSelect(item)}
      style={{
        "--rarity-color": rarityColor,
        animationDelay: index < ANIMATED_ROWS ? `${index * 30}ms` : undefined,
      }}
    >
      <RarityDot rarity={item.rarity} />
      <ItemIcon item={item} />
      <span className="item-row__name">{item.name}</span>
      {item.levelRange && <span className="item-row__level">Lv {item.levelRange.max}</span>}
      <span className="item-row__slot">{item.isMaterial ? "Material" : item.isSkillCore ? "Skill Core" : slotLabel || ""}</span>
      <ChevronRight size={15} strokeWidth={1.5} />
    </button>
  );
});

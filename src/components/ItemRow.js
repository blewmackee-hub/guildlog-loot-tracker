import { ChevronRight } from "lucide-react";
import RarityDot from "./RarityDot";
import { SLOTS, RARITIES } from "@/lib/gameData";
import { slotsForGroup } from "@/lib/calculations";

export default function ItemRow({ item, onSelect, selected, index }) {
  const slotLabel = item.slot
    ? SLOTS.find((s) => s.id === item.slot)?.label
    : slotsForGroup(item.slotGroup)[0]?.label;
  const rarityColor = RARITIES[item.rarity]?.color;
  return (
    <button
      className={`item-row scan-row ${selected ? "item-row--selected" : ""}`}
      onClick={() => onSelect(item)}
      style={{
        "--rarity-color": rarityColor,
        animationDelay: index != null ? `${Math.min(index * 30, 400)}ms` : undefined,
      }}
    >
      <RarityDot rarity={item.rarity} />
      <span className="item-row__name">{item.name}</span>
      {item.levelRange && <span className="item-row__level">Lv {item.levelRange.max}</span>}
      <span className="item-row__slot">{item.isMaterial ? "Material" : item.isSkillCore ? "Skill Core" : slotLabel || ""}</span>
      <ChevronRight size={15} strokeWidth={1.5} />
    </button>
  );
}

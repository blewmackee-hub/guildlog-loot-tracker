import { ChevronRight } from "lucide-react";
import RarityDot from "./RarityDot";
import { SLOTS } from "@/lib/gameData";
import { slotsForGroup } from "@/lib/calculations";

export default function ItemRow({ item, onSelect, selected }) {
  const slotLabel = item.slot
    ? SLOTS.find((s) => s.id === item.slot)?.label
    : slotsForGroup(item.slotGroup)[0]?.label;
  return (
    <button className={`item-row ${selected ? "item-row--selected" : ""}`} onClick={() => onSelect(item)}>
      <RarityDot rarity={item.rarity} />
      <span className="item-row__name">{item.name}</span>
      {item.levelRange && <span className="item-row__level">Lv {item.levelRange.max}</span>}
      <span className="item-row__slot">{item.isMaterial ? "Material" : slotLabel || ""}</span>
      <ChevronRight size={15} strokeWidth={1.5} />
    </button>
  );
}

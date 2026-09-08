"use client";

import { useMemo } from "react";
import { Package, Info } from "lucide-react";
import { ORES } from "@/lib/gameData";
import { resolveInheritancePlan } from "@/lib/calculations";

export default function InheritanceTab({ wishlist }) {
  const { lines, totalsByOre } = useMemo(() => resolveInheritancePlan(wishlist), [wishlist]);

  if (lines.length === 0) {
    return (
      <div className="detail-empty">
        <Info size={22} strokeWidth={1.3} />
        <p>Every equipped slot is already at its item's max level — nothing to inherit. Lower a slot's Current Level in the Build tab to see costs here.</p>
      </div>
    );
  }

  return (
    <div className="inheritance-tab">
      <div className="ore-summary">
        <h3>Ore Needed To Reach Max Level</h3>
        <div className="ore-summary__grid">
          {Object.entries(totalsByOre).map(([name, amt]) => {
            const ore = Object.values(ORES).find((o) => o.name === name);
            return (
              <div className="ore-total-card" key={name} style={{ borderColor: ore?.color }}>
                <span className="ore-total-card__name" style={{ color: ore?.color }}>{name}</span>
                <span className="ore-total-card__amt">{amt}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="inheritance-list">
        <h3>Per-Slot Breakdown</h3>
        {lines.map((l) => (
          <div className="farm-card" key={l.slotId}>
            <div className="farm-card__header">
              <Package size={17} strokeWidth={1.5} />
              <div>
                <strong>{l.item.name}</strong>
                <span className="muted">Lv {l.fromLevel} → Lv {l.toLevel}</span>
              </div>
            </div>
            <ul>
              <li>
                <span style={{ color: l.ore?.color }}>{l.ore?.name || "Unknown ore"}</span>
                <span className="rate">{l.cost}</span>
              </li>
            </ul>
          </div>
        ))}
      </div>

      <p className="formula-note">
        Cost formula fitted from your example data (~level/4 − 6 ore per level step) — matches closely but isn't exact at every level yet. Send more examples, especially lower-level or wider jumps, to sharpen it.
      </p>
    </div>
  );
}

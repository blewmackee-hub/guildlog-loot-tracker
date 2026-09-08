"use client";

import { useMemo } from "react";
import { Hammer, Info } from "lucide-react";
import { SOURCE_ICON } from "@/lib/gameData";
import { SOURCES, resolveFarmPlan } from "@/lib/calculations";

export default function FarmPlan({ wishlist }) {
  const { farmBySource, craftChain } = useMemo(() => resolveFarmPlan(wishlist), [wishlist]);
  const sourceIds = Object.keys(farmBySource);

  if (sourceIds.length === 0 && craftChain.length === 0) {
    return (
      <div className="detail-empty">
        <Info size={22} strokeWidth={1.3} />
        <p>Your build is empty — add gear to generate a farm and craft plan.</p>
      </div>
    );
  }

  return (
    <div className="farm-plan">
      <div className="farm-plan__col">
        <h3>Farm Targets</h3>
        {sourceIds.length === 0 && <p className="muted">Nothing to farm directly — everything is crafted.</p>}
        {sourceIds.map((sid) => {
          const src = SOURCES[sid];
          const Icon = SOURCE_ICON[src.type];
          const needed = farmBySource[sid];
          return (
            <div className="farm-card" key={sid}>
              <div className="farm-card__header">
                <Icon size={17} strokeWidth={1.5} />
                <div>
                  <strong>{src.name}</strong>
                  <span className="muted">{src.note}</span>
                </div>
              </div>
              <ul>
                {needed.map((n, i) => (
                  <li key={i}>
                    <span>{n.name}</span>
                    <span className="rate">{n.rate}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="farm-plan__col">
        <h3>Crafting Queue</h3>
        {craftChain.length === 0 && <p className="muted">Nothing in your build is craftable.</p>}
        {craftChain.map(({ item, recipe }) => (
          <div className="farm-card" key={item.id}>
            <div className="farm-card__header">
              <Hammer size={17} strokeWidth={1.5} />
              <strong>{item.name}</strong>
            </div>
            <ul>
              {recipe.map((slot, i) =>
                slot.length === 1 ? (
                  <li key={i}>
                    <span>{slot[0].material?.name || slot[0].materialId}</span>
                    <span className="rate">×{slot[0].qty}</span>
                  </li>
                ) : (
                  <li key={i}>
                    <span className="material-alternatives">
                      {slot.map((alt, j) => (
                        <span key={alt.materialId}>{j > 0 && <em>or </em>}{alt.material?.name || alt.materialId} ×{alt.qty}</span>
                      ))}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

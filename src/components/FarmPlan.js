"use client";

import { useEffect, useMemo, useState } from "react";
import { Hammer, Info, Users } from "lucide-react";
import { SOURCE_ICON } from "@/lib/gameData";
import { SOURCES, resolveFarmPlan } from "@/lib/calculations";

export default function FarmPlan({ savedItems }) {
  const itemIds = useMemo(() => Object.keys(savedItems), [savedItems]);
  const { farmBySource, craftChain } = useMemo(() => resolveFarmPlan(itemIds), [itemIds]);
  const sourceIds = Object.keys(farmBySource);

  // Aggregate counts only ("14 wishlisted") - never whose wishlist an
  // item came from, so this can't leak another member's crafting
  // recipe list (see getGuildWishlistTally). Best-effort: if it fails
  // to load, the badges just don't show.
  const [tally, setTally] = useState({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/guild/wishlist-tally")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTally(data.tally || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [itemIds]);

  if (sourceIds.length === 0 && craftChain.length === 0) {
    return (
      <div className="detail-empty">
        <Info size={22} strokeWidth={1.3} />
        <p>Your wishlist is empty — save items to it to generate a farm and craft plan.</p>
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
                    <span className="farm-card__meta">
                      {tally[n.itemId] > 0 && (
                        <span className="wishlist-tally" title="Guildmates with this on their wishlist">
                          <Users size={11} strokeWidth={2} />
                          {tally[n.itemId]} wishlisted
                        </span>
                      )}
                      <span className="rate">{n.rate}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="farm-plan__col">
        <h3>Crafting Queue</h3>
        {craftChain.length === 0 && <p className="muted">Nothing in your wishlist is craftable.</p>}
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

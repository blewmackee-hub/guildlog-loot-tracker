"use client";

import { useEffect, useMemo, useState } from "react";
import { Hammer, Info, Users, HelpCircle } from "lucide-react";
import { SOURCE_ICON } from "@/lib/gameData";
import { SOURCES, resolveFarmPlan } from "@/lib/calculations";
import InheritanceTab from "./InheritanceTab";

// Farm Plan is guild-wide, not player-specific: it's driven entirely by
// /api/guild/wishlist-tally (every character in the guild's saved
// items, aggregated to item id -> count - see getGuildWishlistTally),
// not by this account's own Wishlist tab. Build and Inheritance are the
// only per-player tabs; the Inheritance ore summary is embedded below
// as a compact, player-specific sidebar (`wishlist` here is the
// Build/paperdoll map - see App.js).
export default function FarmPlan({ wishlist }) {
  const [tally, setTally] = useState(null); // null = still loading
  const [tallyError, setTallyError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/guild/wishlist-tally")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setTally(data.tally || {});
      })
      .catch((e) => !cancelled && setTallyError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const itemIds = useMemo(() => Object.keys(tally || {}), [tally]);
  const { farmBySource, craftChain, unresolved } = useMemo(() => resolveFarmPlan(itemIds), [itemIds]);
  const sourceIds = Object.keys(farmBySource);

  if (tallyError) {
    return (
      <div className="detail-empty panel">
        <Info size={22} strokeWidth={1.3} />
        <p>Couldn&apos;t load the guild&apos;s wishlist ({tallyError}).</p>
      </div>
    );
  }

  if (tally === null) {
    return (
      <div className="detail-empty panel">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (sourceIds.length === 0 && craftChain.length === 0 && unresolved.length === 0) {
    return (
      <div className="detail-empty panel">
        <Info size={22} strokeWidth={1.3} />
        <p>No one in the guild has wishlisted anything yet — save items to a Wishlist to generate a farm and craft plan.</p>
      </div>
    );
  }

  return (
    <div className="farm-plan-page">
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
          {craftChain.length === 0 && <p className="muted">Nothing wishlisted is craftable.</p>}
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

        {unresolved.length > 0 && (
          <div className="farm-plan__col">
            <h3>Unknown Source</h3>
            <p className="muted">Wishlisted, but no drop source or recipe is in the database yet.</p>
            <div className="farm-card">
              <div className="farm-card__header">
                <HelpCircle size={17} strokeWidth={1.5} />
                <strong>{unresolved.length} item{unresolved.length === 1 ? "" : "s"}</strong>
              </div>
              <ul>
                {unresolved.map((u) => (
                  <li key={u.itemId}>
                    <span>{u.name}</span>
                    {tally[u.itemId] > 0 && (
                      <span className="farm-card__meta">
                        <span className="wishlist-tally" title="Guildmates with this on their wishlist">
                          <Users size={11} strokeWidth={2} />
                          {tally[u.itemId]} wishlisted
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="farm-plan__ore-sidebar">
        <h3>Your Inheritance Ore</h3>
        <InheritanceTab wishlist={wishlist} compact />
      </div>
    </div>
  );
}

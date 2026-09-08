import { Hammer, Package, Info, Flame } from "lucide-react";
import RarityDot from "./RarityDot";
import { RARITIES, STAT_LABELS, SOURCE_ICON, unitFor, collapseUnifiedStats } from "@/lib/gameData";
import { ITEMS, SETS, SOURCES, RECIPES, resolveStatValue, slotsForGroup } from "@/lib/calculations";

export default function ItemDetail({ item, wishlist, pendingSlot, onAddToWishlist, savedItems, onToggleSaved }) {
  if (!item) {
    return (
      <div className="detail-empty">
        <Info size={22} strokeWidth={1.3} />
        <p>Select an item to see its stats, set, and drop sources.</p>
      </div>
    );
  }
  const recipe = RECIPES[item.id];
  const set = item.setId ? SETS[item.setId] : null;

  // Resolve every stat to its actual number first: when melee/ranged/
  // magic (or their PvP counterparts) come out numerically identical -
  // which happens whenever the only source is Questlog's "plain"
  // unified stat, e.g. all_critical_attack - show one plain-named line
  // instead of three redundant "Melee/Ranged/Magic X" lines.
  const resolvedStats = {};
  Object.entries(item.stats || {}).forEach(([k, v]) => {
    resolvedStats[k] = resolveStatValue(v, item.levelRange?.max, item.levelRange);
  });
  const { replacements, consumed } = collapseUnifiedStats(resolvedStats);

  return (
    <div className="detail">
      <div className="detail__header">
        <RarityDot rarity={item.rarity} />
        <div>
          <h3>{item.name}</h3>
          <span className="detail__rarity" style={{ color: RARITIES[item.rarity].color }}>
            {RARITIES[item.rarity].label}
          </span>
        </div>
      </div>

      {item.levelRange && (
        <div className="level-note">
          Item Level {item.levelRange.max} ({item.levelRange.min}–{item.levelRange.max}) — stats below shown at max level
        </div>
      )}

      {Object.keys(item.stats || {}).length > 0 && (
        <div className="detail__stats">
          {Object.keys(item.stats)
            .filter((k) => !consumed.has(k))
            .map((k) => {
              const rep = replacements[k];
              return (
                <div className="stat-line" key={k}>
                  <span>{rep ? rep.label : STAT_LABELS[k] || k}</span>
                  <span>+{rep ? rep.value : resolvedStats[k]}{unitFor(k)}</span>
                </div>
              );
            })}
        </div>
      )}

      {item.passive && (
        <div className="detail__section">
          <h4>Passive</h4>
          <div className="passive-card">
            <Flame size={15} strokeWidth={1.5} />
            <div>
              <strong>{item.passive.name}</strong>
              <p>{item.passive.description}</p>
            </div>
          </div>
        </div>
      )}

      {set && (
        <div className="detail__section">
          <h4>Set — {set.name}</h4>
          <p className="muted">
            Needs: {set.pieces.map((id) => ITEMS[id]?.name).filter(Boolean).join(" + ") || `${set.pieces.length} pieces (not all in the database yet)`}
          </p>
          {set.bonuses.map((b, i) => (
            <div className="set-bonus-line" key={i}>
              ({b.count}) {b.label}
            </div>
          ))}
        </div>
      )}

      <div className="detail__section">
        <h4>Sources</h4>
        {recipe ? (
          <div className="craft-note">
            <Hammer size={14} strokeWidth={1.5} /> Crafted — see materials below
          </div>
        ) : item.sources.length ? (
          <ul className="source-list">
            {item.sources.map(({ sourceId, rate }, i) => {
              const src = SOURCES[sourceId];
              const Icon = SOURCE_ICON[src.type];
              return (
                // Same boss can legitimately appear twice with two
                // different rates (a second drop mechanism Questlog
                // doesn't otherwise label) - sourceId alone isn't a
                // safe key here.
                <li key={`${sourceId}-${i}`}>
                  <Icon size={14} strokeWidth={1.5} />
                  <span>{src.name}</span>
                  <span className="rate">{rate}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No known source yet.</p>
        )}
      </div>

      {recipe && (
        <div className="detail__section">
          <h4>Materials Needed</h4>
          <ul className="source-list">
            {recipe.map((slot, i) =>
              slot.length === 1 ? (
                <li key={i}>
                  <Package size={14} strokeWidth={1.5} />
                  <span>{ITEMS[slot[0].materialId]?.name || slot[0].materialId}</span>
                  <span className="rate">×{slot[0].qty}</span>
                </li>
              ) : (
                <li key={i}>
                  <Package size={14} strokeWidth={1.5} />
                  <span className="material-alternatives">
                    {slot.map((alt, j) => (
                      <span key={alt.materialId}>{j > 0 && <em>or </em>}{ITEMS[alt.materialId]?.name || alt.materialId} ×{alt.qty}</span>
                    ))}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {!item.isMaterial && item.slot && (
        <button className="btn-primary" onClick={() => onAddToWishlist(item)}>
          Add to Build
        </button>
      )}

      {!item.isMaterial && !item.slot && item.slotGroup && (() => {
        const candidates = slotsForGroup(item.slotGroup);
        const pendingMatches = pendingSlot && pendingSlot.slotGroup === item.slotGroup;
        if (pendingMatches) {
          return (
            <button className="btn-primary" onClick={() => onAddToWishlist(item, pendingSlot.id)}>
              Add to {pendingSlot.label}
            </button>
          );
        }
        return (
          <div className="slot-choice">
            <span className="muted">This item has two possible slots — pick one:</span>
            <div className="slot-choice__row">
              {candidates.map((s, i) => (
                <button key={s.id} className="btn-secondary" onClick={() => onAddToWishlist(item, s.id)}>
                  {s.label} {i + 1}{wishlist[s.id] ? " (replace)" : ""}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {!item.isMaterial && !item.slot && !item.slotGroup && (
        <p className="muted">This item has no slot mapping yet — can't be added to a build.</p>
      )}

      {!item.isMaterial && (
        <button
          className={`btn-wishlist ${savedItems[item.id] ? "btn-wishlist--active" : ""}`}
          onClick={() => onToggleSaved(item)}
        >
          {savedItems[item.id] ? "★ Saved to Wishlist" : "☆ Save to Wishlist"}
        </button>
      )}
    </div>
  );
}

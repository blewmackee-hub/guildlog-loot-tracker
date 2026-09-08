"use client";

import { useMemo } from "react";
import { Flame } from "lucide-react";
import { STAT_GROUPS, unitFor, collapseUnifiedStats } from "@/lib/gameData";
import { computeBuildStats } from "@/lib/calculations";

function SetTracker({ setProgress }) {
  if (setProgress.length === 0) return null;
  return (
    <div className="set-tracker">
      <h3>Set Bonuses</h3>
      {setProgress.map((s) => (
        <div className="set-card" key={s.setId}>
          <div className="set-card__header">
            <span>{s.name}</span>
            <span className="muted">{s.count}/{s.poolSize} equipped</span>
          </div>
          {s.bonuses.map((b, i) => (
            <div key={i} className={`set-bonus-line ${s.count >= b.count ? "set-bonus-line--active" : ""}`}>
              ({b.count}) {b.label} {s.count >= b.count && "✓"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PassivesPanel({ passives }) {
  if (passives.length === 0) return null;
  return (
    <div className="passives-panel">
      <h3>Active Passives</h3>
      {passives.map((p, i) => (
        <div className="passive-card" key={i}>
          <Flame size={15} strokeWidth={1.5} />
          <div>
            <strong>{p.name}</strong>
            <p>{p.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatSheet({ wishlist }) {
  const { totals, setProgress, passives } = useMemo(() => computeBuildStats(wishlist), [wishlist]);
  const { replacements, consumed } = useMemo(() => collapseUnifiedStats(totals), [totals]);
  const hasAny = Object.keys(totals).length > 0;
  return (
    <div className="stat-sheet">
      <h3>Gear Stat Totals</h3>
      {!hasAny && <p className="muted">Add items to your build to see totals here.</p>}
      {STAT_GROUPS.map((group) => {
        const rows = group.keys.filter((k) => totals[k] && !consumed.has(k));
        if (rows.length === 0) return null;
        return (
          <div className="stat-group" key={group.label}>
            <span className="stat-group__label">{group.label}</span>
            {rows.map((k) => {
              const rep = replacements[k];
              return (
                <div className="stat-line" key={k}>
                  <span>{rep ? rep.label : group.labels[k]}</span>
                  <span>{rep ? rep.value : totals[k]}{unitFor(k)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      <SetTracker setProgress={setProgress} />
      <PassivesPanel passives={passives} />
    </div>
  );
}

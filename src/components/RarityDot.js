import { RARITIES } from "@/lib/gameData";

/* Legendary is the one rarity that gets a soft glow - the brief's
   "desaturate low tiers so legendary actually pops" - via
   box-shadow: currentColor, so the glow always matches the dot
   without a second color prop. */
export default function RarityDot({ rarity }) {
  const color = RARITIES[rarity]?.color || "#888";
  const isLegendary = rarity === "legendary";
  return (
    <span
      className={`rarity-dot${isLegendary ? " rarity-dot--legendary" : ""}`}
      style={{ background: color, color }}
    />
  );
}

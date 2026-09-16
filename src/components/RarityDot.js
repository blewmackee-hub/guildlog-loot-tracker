import { RARITIES } from "@/lib/gameData";

/* Heroic is the one rarity that gets a soft glow - the brief's
   "desaturate low tiers so the top rarity actually pops" - via
   box-shadow: currentColor, so the glow always matches the dot
   without a second color prop. shape="diamond" swaps to the
   45°-rotated square that reads better against the paperdoll's
   equipment-slot rows than a plain circle. */
export default function RarityDot({ rarity, shape = "circle" }) {
  const color = RARITIES[rarity]?.color || "#888";
  const isHeroic = rarity === "heroic";
  const base = shape === "diamond" ? "rarity-diamond" : "rarity-dot";
  return (
    <span
      className={`${base}${isHeroic ? " rarity-dot--heroic" : ""}`}
      style={{ background: color, color }}
    />
  );
}

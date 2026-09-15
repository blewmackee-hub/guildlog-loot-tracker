import { RARITIES } from "@/lib/gameData";

/* Heroic is the one rarity that gets a soft glow - the brief's
   "desaturate low tiers so the top rarity actually pops" - via
   box-shadow: currentColor, so the glow always matches the dot
   without a second color prop. */
export default function RarityDot({ rarity }) {
  const color = RARITIES[rarity]?.color || "#888";
  const isHeroic = rarity === "heroic";
  return (
    <span
      className={`rarity-dot${isHeroic ? " rarity-dot--heroic" : ""}`}
      style={{ background: color, color }}
    />
  );
}

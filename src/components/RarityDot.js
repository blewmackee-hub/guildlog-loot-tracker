import { RARITIES } from "@/lib/gameData";

export default function RarityDot({ rarity }) {
  return <span className="rarity-dot" style={{ background: RARITIES[rarity]?.color || "#888" }} />;
}

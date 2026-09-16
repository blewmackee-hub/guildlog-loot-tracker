"use client";

import { useState } from "react";
import { Package } from "lucide-react";

/* Small rarity-ringed thumbnail for an item's icon (item.icon, scraped
   from Questlog's CDN - see Transform-Questlog.ps1). Not every item has
   one (a handful of hand-added skill cores don't), and some scraped
   URLs 404 - both cases fall back to the same rarity-tinted placeholder
   tile instead of a broken-image box or a gap in the row. */
export default function ItemIcon({ item, size = 26, className }) {
  const [broken, setBroken] = useState(false);
  if (!item?.icon || broken) {
    return (
      <div className={`item-icon item-icon--fallback ${className || ""}`} style={{ width: size, height: size }}>
        <Package size={Math.round(size * 0.55)} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={item.icon}
      alt=""
      className={`item-icon ${className || ""}`}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

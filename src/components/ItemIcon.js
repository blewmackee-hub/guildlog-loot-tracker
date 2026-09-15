/* Small rarity-ringed thumbnail for an item's icon (item.icon, scraped
   from Questlog's CDN - see Transform-Questlog.ps1). Not every item has
   one (a handful of hand-added skill cores don't), so this renders
   nothing rather than a broken-image box when it's missing. */
export default function ItemIcon({ item, size = 26, className }) {
  if (!item?.icon) return null;
  return (
    <img
      src={item.icon}
      alt=""
      className={`item-icon ${className || ""}`}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

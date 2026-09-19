import { SLOTS, ORES } from "./gameData";
import data from "@/data/loot-data.json";

export const ITEMS = data.ITEMS;
export const SOURCES = data.SOURCES;
export const SETS = data.SETS;
export const RECIPES = data.RECIPES;
// Potential Ability pools - a handful of catalogs shared verbatim across
// hundreds of items (see Transform-Questlog.ps1's Get-PotentialCatalogId),
// looked up by item.potentialCatalogId rather than inlined per item.
export const POTENTIAL_CATALOGS = data.POTENTIAL_CATALOGS || {};

/* Slots sharing an item's slotGroup, in a stable order, for the
   "which instance?" chooser. */
export function slotsForGroup(slotGroup) {
  return SLOTS.filter((s) => s.slotGroup === slotGroup);
}

/* An item's coarse category (weapon/armor/accessory) works the same
   whether it has a concrete slot or only a slotGroup. */
export function coarseGroupFor(item) {
  if (item.isSkillCore) return "skillcore";
  if (item.slot) return SLOTS.find((s) => s.id === item.slot)?.group;
  if (item.slotGroup) return SLOTS.find((s) => s.slotGroup === item.slotGroup)?.group;
  return undefined;
}

export function resolveStatValue(entry, level, levelRange) {
  if (typeof entry === "number") return Math.round(entry);
  if (!levelRange) return Math.round(entry.base);
  const lvl = level ?? levelRange.max;
  const raw = entry.base + entry.perLevel * (lvl - levelRange.min);
  return Math.round(raw);
}

/* Fitted from six real (from, to, cost) examples across weapon, armor,
   and accessory slots (levels 45-81), taken after the Sep 2026 patch:
   the ore to step up from L-1 to L is close to 0.155 * L - 3.27,
   rounded to a whole ore per level and summed over the range. Matches
   3 examples exactly and the other 3 within 2 ore; one curve fits all
   three ore types. The earlier formula (L/4 - 6.125) overshot these by
   ~40%, so costs appear to have dropped in the patch. Above level 81
   (caps are now 90, and 93 for archboss weapons) this is extrapolation. */
export function estimateInheritCost(fromLevel, toLevel) {
  if (toLevel <= fromLevel) return 0;
  let total = 0;
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    total += Math.max(0, Math.round(0.155 * lvl - 3.27));
  }
  return total;
}

export function resolveFarmPlan(itemIds) {
  const farmBySource = {};
  const craftChain = [];
  const unresolved = [];
  const seenMaterials = new Set();
  const seenItems = new Set();

  function addFarmTarget(item) {
    if (!item || !item.sources || item.sources.length === 0) return false;
    item.sources.forEach(({ sourceId, rate }) => {
      if (!farmBySource[sourceId]) farmBySource[sourceId] = [];
      farmBySource[sourceId].push({ itemId: item.id, name: item.name, rate });
    });
    return true;
  }

  function resolveItem(itemId) {
    if (seenItems.has(itemId)) return;
    seenItems.add(itemId);
    const item = ITEMS[itemId];
    if (!item) return;
    const recipe = RECIPES[itemId];
    if (recipe) {
      // recipe = slots, each slot a list of interchangeable
      // {materialId, qty} choices (almost always 1; a few real
      // recipes let you substitute among 2-3 for one slot).
      const resolved = recipe.map((slot) => slot.map((r) => ({ ...r, material: ITEMS[r.materialId] })));
      craftChain.push({ item, recipe: resolved });
      recipe.forEach((slot) => {
        slot.forEach((r) => {
          if (!seenMaterials.has(r.materialId)) {
            seenMaterials.add(r.materialId);
            addFarmTarget(ITEMS[r.materialId]);
          }
        });
      });
    } else if (!addFarmTarget(item)) {
      // Neither a known drop source nor a craft recipe - surfaced
      // explicitly rather than silently vanishing from the plan, since
      // Questlog's scrape doesn't yet cover every item (see
      // project-brief.md's open question #3).
      unresolved.push({ itemId: item.id, name: item.name });
    }
  }

  itemIds.forEach(resolveItem);
  return { farmBySource, craftChain, unresolved };
}

/* Every equipped slot is assumed to be aiming at that item's max
   level eventually. If its current (slider) level is below that
   cap, this figures out the ore cost to inherit up to it. */
export function resolveInheritancePlan(wishlist) {
  const lines = [];
  const totalsByOre = {};

  Object.entries(wishlist).forEach(([slotId, entry]) => {
    if (!entry) return;
    const item = ITEMS[entry.itemId];
    if (!item || !item.levelRange) return;
    const target = item.levelRange.max;
    const current = entry.level ?? target;
    if (target <= current) return;
    const slotMeta = SLOTS.find((s) => s.id === slotId);
    const ore = ORES[slotMeta?.group];
    const cost = estimateInheritCost(current, target);
    lines.push({ slotId, item, fromLevel: current, toLevel: target, ore, cost });
    if (ore) totalsByOre[ore.name] = (totalsByOre[ore.name] || 0) + cost;
  });

  return { lines, totalsByOre };
}

/* Sums level-resolved gear stats, then layers in set bonuses (flat
   + scaling) and collects passive abilities from gear and active
   sets. wishlist[slotId] is { itemId, level } | null. */
export function computeBuildStats(wishlist) {
  const equipped = Object.values(wishlist)
    .filter(Boolean)
    .map((entry) => ({ item: ITEMS[entry.itemId], level: entry.level }))
    .filter((e) => e.item);

  const totals = {};
  equipped.forEach(({ item, level }) => {
    Object.entries(item.stats || {}).forEach(([k, v]) => {
      totals[k] = (totals[k] || 0) + resolveStatValue(v, level, item.levelRange);
    });
  });

  const setCounts = {};
  equipped.forEach(({ item }) => {
    if (item.setId) setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
  });

  const activeBonuses = [];
  Object.entries(setCounts).forEach(([setId, count]) => {
    const set = SETS[setId];
    if (!set) return;
    set.bonuses.forEach((b) => {
      if (count >= b.count) {
        activeBonuses.push({ setId, setName: set.name, equipped: count, ...b });
        Object.entries(b.flatStats || {}).forEach(([k, v]) => {
          totals[k] = (totals[k] || 0) + v;
        });
      }
    });
  });

  activeBonuses.forEach((b) => {
    (b.scaling || []).forEach((s) => {
      const base = totals[s.of] || 0;
      let bonus = Math.floor(base / s.per) * s.amount;
      if (s.cap != null) bonus = Math.min(bonus, s.cap);
      totals[s.statKey] = (totals[s.statKey] || 0) + bonus;
    });
    (b.conditional || []).forEach((c) => {
      if ((totals[c.of] || 0) >= c.threshold) {
        totals[c.statKey] = (totals[c.statKey] || 0) + c.amount;
      }
    });
  });

  const setProgress = Object.keys(SETS)
    .filter((setId) => setCounts[setId])
    .map((setId) => ({
      setId, name: SETS[setId].name, count: setCounts[setId],
      poolSize: SETS[setId].pieces.length, bonuses: SETS[setId].bonuses,
    }));

  const passives = [];
  equipped.forEach(({ item }) => {
    if (item.passive) passives.push({ source: item.name, name: item.passive.name, description: item.passive.description });
  });
  activeBonuses.forEach((b) => {
    passives.push({ source: b.setName, name: `${b.setName} (${b.count}pc)`, description: b.label });
  });

  return { totals, activeBonuses, setProgress, passives };
}

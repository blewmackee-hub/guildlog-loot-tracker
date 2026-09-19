// Adds/refreshes items in src/data/loot-data.json from Questlog's tRPC API.
//   node scripts/add-questlog-items.js --discover        list new S1-series item ids
//   node scripts/add-questlog-items.js <id> [<id> ...]   convert + merge those items
//   node scripts/add-questlog-items.js --sources <boss name>...  append a new boss's drops to old items
//   node scripts/add-questlog-items.js --levels          apply raised level caps (levelRange/stats/weaponDamage) to old items
//   node scripts/add-questlog-items.js --verify          re-convert existing S1 items, diff vs stored
// Questlog's item LIST is stale after patches; direct getItem by id works, so we probe
// the next index of every existing series (see --discover).
const fs = require("fs");
const path = require("path");

const BASE = "https://questlog.gg/throne-and-liberty/api/trpc";
const DATA = path.join(__dirname, "..", "src", "data", "loot-data.json");

const trpc = async (proc, input) => {
  const r = await (await fetch(`${BASE}/${proc}?input=${encodeURIComponent(JSON.stringify(input))}`)).json();
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result.data.json || r.result.data;
};
const getItem = (id) => trpc("database.getItem", { id, language: "en" });

const SLOT = { feet: "boots", hands: "gloves", head: "helmet", legs: "pants", chest: "chest", belt: "belt", bracelet: "bracelet", necklace: "necklace", cloak: "cloak", brooch: "brooch" };
const SLOT_GROUP = ["ring", "earring"];
const WEAPONS = ["bow", "crossbow", "dagger", "gauntlet", "orb", "spear", "staff", "sword2h", "sword", "wand"];
const RARITY = { 11: "common", 21: "uncommon", 31: "rare", 41: "epic", 51: "heroic" };

// Questlog raw stat id -> our stat key(s). "all_*" feed melee/ranged/magic equally. Unknown -> raw_<id>.
const tri = (a, b, c) => [a, b, c];
const STAT = {
  str: "str", dex: "dex", int: "wis", per: "per", con: "fort",
  hp_max: "maxHealth", cost_max: "maxMana", cost_regen: "manaRegen", hp_regen: "healthRegen", stamina_max: "maxStamina", stamina_regen: "staminaRegen",
  melee_armor: "meleeDefense", range_armor: "rangedDefense", magic_armor: "magicDefense", damage_reduction: "damageReduction", value: "damageReduction",
  all_accuracy: tri("meleeHit", "rangedHit", "magicHit"), melee_accuracy: "meleeHit",
  all_critical_attack: tri("meleeCrit", "rangedCrit", "magicCrit"), melee_critical_attack: "meleeCrit", range_critical_attack: "rangedCrit", magic_critical_attack: "magicCrit",
  all_double_attack: tri("meleeHeavyAtk", "rangedHeavyAtk", "magicHeavyAtk"), melee_double_attack: "meleeHeavyAtk", range_double_attack: "rangedHeavyAtk", magic_double_attack: "magicHeavyAtk",
  all_evasion: tri("meleeEvasion", "rangedEvasion", "magicEvasion"),
  all_critical_defense: tri("meleeEndurance", "rangedEndurance", "magicEndurance"),
  all_double_defense: tri("meleeHeavyAtkEvasion", "rangedHeavyAtkEvasion", "magicHeavyAtkEvasion"),
  pvp_all_accuracy: tri("pvpMeleeHit", "pvpRangedHit", "pvpMagicHit"), pvp_melee_critical_attack: "pvpMeleeCrit", pvp_range_critical_attack: "pvpRangedCrit",
  pvp_all_evasion: tri("pvpMeleeEvasion", "pvpRangedEvasion", "pvpMagicEvasion"),
  pvp_all_critical_defense: tri("pvpMeleeEndurance", "pvpRangedEndurance", "pvpMagicEndurance"),
  pvp_all_double_defense: tri("pvpMeleeHeavyAtkEvasion", "pvpRangedHeavyAtkEvasion", "pvpMagicHeavyAtkEvasion"),
  pvp_melee_double_attack: "pvpMeleeHeavyAtk", pvp_magic_double_attack: "pvpMagicHeavyAtkChance",
  move_speed_modifier: "movementSpeedPct", double_damage_dealt_modifier: "heavyAtkDamagePct", critical_damage_dealt_modifier: "criticalDamagePct",
  double_damage_taken_modifier: "heavyAtkDamageResistPct", critical_damage_taken_modifier: "criticalDamageResistPct",
  skill_cooldown_modifier: "cooldownSpeedPct", attack_speed_modifier: "atkSpeedPct", attack_speed_main_hand: "attackSpeed", attack_range_main_hand: "rangeFlat", attack_range_modifier: "rangePct",
  cost_consumption_modifier: "manaCostEfficiencyPct", buff_given_duration_modifier: "buffDurationPct", debuff_taken_duration_modifier: "debuffDurationPct",
  skill_power_amplification: "skillDamageBoost", skill_power_resistance: "skillDamageResistPct", heal_modifier: "healingPct",
  collide_amplification: "collisionChance", collide_resistance: "collisionResist", weaken_tolerance: "weakenResist", weaken_accuracy: "weakenChance", stun_accuracy: "stunChance",
  off_hand_attack_chance: "offHandAtkChance", side_all_accuracy: "sideHitChance",
};

const round = (n, p = 100) => { const r = Math.round(n * p) / p; return Object.is(r, -0) ? 0 : r; };

function fit(pts, lo) { // least-squares line, base anchored at the first level
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const perLevel = sxx ? sxy / sxx : 0;
  return { base: round(my - perLevel * (mx - lo)), perLevel: round(perLevel, 1000) };
}

// sources: one row per distinct (npc name, rate) in Questlog order; npc ids differ per map, reuse our entry by name
function sourcesFor(raw, H, newSources) {
  const seen = new Set(), out = [];
  for (const n of raw.itemDroppedFromNpcs || []) {
    if (n.dropCondition !== "normalDrop") continue;
    const rate = (n.probability * 100).toFixed(2) + "%";
    if (seen.has(n.name + "|" + rate)) continue;
    seen.add(n.name + "|" + rate);
    let id = Object.values({ ...H.SOURCES, ...newSources }).find((x) => x.name === n.name)?.id;
    if (!id) {
      id = "npc_" + n.id;
      newSources[id] = { id, type: /^boss/.test(n.mainCategory) ? "boss" : "dungeon", name: n.name, note: `Lv ${n.level} ${n.mainCategory} - normalDrop` };
    }
    out.push({ sourceId: id, rate });
  }
  return out;
}

// levelRange, linear stats and (weapons) weaponDamage from Questlog's per-level tables.
// Questlog's cap moves with patches (80 -> 90, arch weapons 85 -> 93): always use the levels it lists.
function statsFor(raw, sf) {
  const S = raw.itemStats || {}, M = S.main || {};
  const lv = Object.keys(M).map(Number);
  if (!lv.length) throw new Error(`${raw.id}: no per-level stats`);
  const lo = Math.min(...lv), hi = Math.max(...lv), mult = (k) => sf[k]?.multiplier ?? 1;
  const series = {};
  for (let l = lo; l <= hi; l++) {
    for (const grp of ["armor", "extra", "shield"]) for (const [k, v] of Object.entries(M[l]?.[grp] || {})) if (typeof v === "number") (series[k] = series[k] || []).push([l, v]);
    for (const [k, v] of Object.entries(S.extra?.[l] || {})) if (typeof v === "number") (series[k] = series[k] || []).push([l, v]);
  }
  const stats = {};
  for (const [k, pts] of Object.entries(series)) {
    const f = fit(pts.map(([l, v]) => [l, v * mult(k)]), lo);
    for (const key of [].concat(STAT[k] || "raw_" + k)) stats[key] = f;
  }
  const out = { levelRange: { min: lo, max: hi }, stats };
  const top = M[hi] || {};
  if (top.mainhand) { // weapon damage is stored at max level, not per level
    out.weaponDamage = { main: { min: top.mainhand.min, max: top.mainhand.max } };
    if (top.offhand) out.weaponDamage.off = { min: top.offhand.min, max: top.offhand.max };
  }
  return out;
}

// After a patch raises level caps: refresh levelRange/stats/weaponDamage on items whose cap moved.
async function refreshLevels(data) {
  const sf = await trpc("statFormat.getStatFormat", { language: "en" });
  let n = 0;
  for (const it of Object.values(data.ITEMS)) {
    if (!it.levelRange || it.isMaterial || it.isSkillCore) continue;
    let raw; try { raw = await getItem(it.id); } catch (e) { console.log("skip", it.id, e.message); continue; }
    if (!Object.keys(raw.itemStats?.main || {}).length) continue;
    const f = statsFor(raw, sf);
    if (f.levelRange.max === it.levelRange.max && f.levelRange.min === it.levelRange.min) continue;
    console.log(it.id, JSON.stringify(it.levelRange), "->", JSON.stringify(f.levelRange));
    Object.assign(it, f); n++;
  }
  fs.writeFileSync(DATA, JSON.stringify(data));
  console.log(n, "items updated");
}

async function convert(raw, ctx) {
  const { sf, H, newSources, newSets, catalogs } = ctx;
  const mult = (k) => sf[k]?.multiplier ?? 1;
  const fmt = (k) => ({ label: sf[k]?.name ?? k, isPercent: (sf[k]?.valueFormat || "").includes("%") });
  const S = raw.itemStats || {};
  const item = { id: raw.id, name: raw.name };
  const sub = raw.subCategory;
  if (SLOT[sub]) item.slot = SLOT[sub]; else if (SLOT_GROUP.includes(sub) || WEAPONS.includes(sub)) { item.slot = null; } else throw new Error(`${raw.id}: unknown subCategory ${sub}`);
  if (!RARITY[raw.grade]) throw new Error(`${raw.id}: unknown grade ${raw.grade}`);
  item.rarity = RARITY[raw.grade];
  item.icon = "https://cdn.questlog.gg/throne-and-liberty" + raw.icon.replace(/\.[^./]+$/, "") + ".webp";

  item.sources = sourcesFor(raw, H, newSources);
  if (SLOT_GROUP.includes(sub)) item.slotGroup = sub;
  if (WEAPONS.includes(sub)) {
    item.slotGroup = "weapon";
    const ps = [].concat(raw.passives || [])[0];
    if (ps) item.passive = { name: ps.name, description: ps.text };
  }

  Object.assign(item, statsFor(raw, sf));

  const set = (raw.itemIsPartOfItemSets || [])[0];
  if (set) {
    if (!H.SETS[set.id] && !newSets[set.id]) {
      newSets[set.id] = {
        name: set.name, pieces: set.itemSetMadeOfItems.map((p) => p.id),
        bonuses: set.itemSetBonus.map((b) => ({ count: b.setCount, label: b.bonusPassive.map((x) => x.text).join("\n"), flatStats: {} })),
      };
    }
    item.setId = set.id;
  }

  item.traitOptions = Object.entries(S.traits || {}).map(([id, t]) => ({ id, ...fmt(id), tiers: t.map((v) => round(v * mult(id))) }));
  const heroic = Object.entries(S.uniqueTraits || {}).map(([id, t]) => ({ id, ...fmt(id), tiers: t.map((v) => round(v * mult(id))) }));
  if (heroic.length) item.heroicTraitOptions = heroic;
  item.resonanceOptions = Object.entries(S.resonance || {}).map(([id, e]) => ({ id, ...fmt(id), tiers: (e.tiers || []).map((v) => round(v * mult(id))), probability: e.probability }));

  const P = raw.itemPotential;
  if (P) {
    const opts = [
      ...(P.stats || []).map((s) => ({ id: s.statId, type: "stat", ...fmt(s.statId), value: round(s.value * mult(s.statId)), probability: round(s.probability * 100) })),
      ...(P.skills || []).map((s) => ({ id: s.id, type: "skill", label: s.name, probability: round(s.probability * 100) })),
    ];
    if (opts.length) {
      const sig = (o) => JSON.stringify(o.slice().sort((a, b) => a.id.localeCompare(b.id)).map((x) => [x.id, x.type, x.value ?? null, x.probability]));
      const key = sig(opts);
      let cid = Object.keys(catalogs).find((c) => sig(catalogs[c]) === key);
      if (!cid) { cid = "potential_" + (Object.keys(catalogs).length + 1); catalogs[cid] = opts; }
      item.potentialCatalogId = cid;
    }
  }
  return item;
}

async function ctxFor(data) {
  const sf = await trpc("statFormat.getStatFormat", { language: "en" });
  return { sf, H: data, newSources: {}, newSets: {}, catalogs: data.POTENTIAL_CATALOGS };
}

async function discover(data) {
  const series = {};
  for (const k of Object.keys(data.ITEMS)) {
    const m = k.match(/^(.*_S1_.*?)(\d+)$/);
    if (m && !k.startsWith("Perk")) series[m[1]] = Math.max(series[m[1]] || 0, +m[2]);
  }
  const found = [];
  for (const [p, max] of Object.entries(series)) {
    for (let n = max + 1; n <= max + 3; n++) {
      const id = p + String(n).padStart(3, "0");
      try { const d = await getItem(id); if (!d?.name) break; found.push(id); } catch { break; }
    }
  }
  console.log(found.join("\n"));
}

// deep compare with numeric tolerance; returns list of differing paths
function diff(a, b, p = "", out = []) {
  if (typeof a === "number" && typeof b === "number") { if (Math.abs(a - b) > 0.02 + 0.03 * Math.abs(b)) out.push(`${p}: ${a} vs ${b}`); }
  else if (a && b && typeof a === "object" && typeof b === "object") for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${p}.${k}`, out);
  else if (a !== b) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}

async function verify(data) {
  const ids = Object.keys(data.ITEMS).filter((k) => /_S1_/.test(k) && !k.startsWith("Perk") && data.ITEMS[k].stats && !data.ITEMS[k].isMaterial).filter((_, i) => i % 4 === 0);
  const ctx = await ctxFor(data);
  ctx.catalogs = { ...data.POTENTIAL_CATALOGS }; // don't mutate
  const tally = {};
  for (const id of ids) {
    let got; try { got = await convert(await getItem(id), ctx); } catch (e) { console.log("ERR", id, e.message); continue; }
    const want = data.ITEMS[id];
    for (const f of ["slot", "rarity", "icon", "levelRange", "stats", "sources", "setId", "traitOptions", "resonanceOptions", "potentialCatalogId", "slotGroup", "weaponDamage", "passive"]) {
      const d = diff(got[f], want[f], f);
      if (d.length) { tally[f] = (tally[f] || 0) + 1; if (tally[f] <= 3) console.log(id, d.slice(0, 3).join(" | ")); }
    }
  }
  console.log(`checked ${ids.length}; items with diffs per field:`, tally);
}

// New bosses show up in the drop tables of OLD items too. Append only rows for the named bosses;
// existing rows are left alone (Questlog re-rounds old rates, which would just be churn).
async function refreshSources(data, names) {
  const newSources = {};
  const gear = Object.values(data.ITEMS).filter((i) => (i.slot || i.slotGroup) && !i.isMaterial && !i.isSkillCore);
  let changed = 0;
  for (const it of gear) {
    let raw; try { raw = await getItem(it.id); } catch (e) { console.log("skip", it.id, e.message); continue; }
    const added = sourcesFor(raw, data, newSources).filter((s) => names.includes((data.SOURCES[s.sourceId] || newSources[s.sourceId]).name) && !(it.sources || []).some((o) => o.sourceId === s.sourceId && o.rate === s.rate));
    if (added.length) { it.sources = [...(it.sources || []), ...added]; changed++; }
  }
  Object.assign(data.SOURCES, newSources);
  fs.writeFileSync(DATA, JSON.stringify(data));
  console.log(`${gear.length} gear items, ${changed} gained new-boss drops; new sources: ${Object.values(newSources).map((s) => s.name).join(", ") || "none"}`);
}

async function main() {
  const args = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  if (args[0] === "--discover") return discover(data);
  if (args[0] === "--verify") return verify(data);
  if (args[0] === "--levels") return refreshLevels(data);
  if (args[0] === "--sources") return refreshSources(data, args.slice(1));
  if (!args.length) throw new Error("pass item ids, --discover or --verify");
  const ctx = await ctxFor(data);
  for (const id of args) { data.ITEMS[id] = await convert(await getItem(id), ctx); console.log("added", id, data.ITEMS[id].name); }
  Object.assign(data.SOURCES, ctx.newSources); Object.assign(data.SETS, ctx.newSets);
  fs.writeFileSync(DATA, JSON.stringify(data));
  console.log(`new sources: ${Object.values(ctx.newSources).map((s) => s.name).join(", ") || "none"}; new sets: ${Object.values(ctx.newSets).map((s) => s.name).join(", ") || "none"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

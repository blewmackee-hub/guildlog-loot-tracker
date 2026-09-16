import { Skull, Shield, Sparkles, Package, Hammer } from "lucide-react";

/* `group` is the coarse category used for the database filter chips
   (all/weapon/armor/accessory) and ore lookups. `slotGroup` is finer:
   it's what ties together slots that are interchangeable copies of
   each other (two Weapon slots, two Ring slots, two Earring slots).
   An item whose real slot instance isn't inherent to the item itself
   (any Questlog weapon/ring/earring - the game doesn't say "this ring
   goes in Ring 2") carries `slotGroup` instead of a concrete `slot`,
   and the UI lets the player pick which instance to fill. */
export const SLOTS = [
  { id: "weapon1", label: "Weapon", group: "weapon", slotGroup: "weapon" },
  { id: "weapon2", label: "Weapon", group: "weapon", slotGroup: "weapon" },
  { id: "helmet", label: "Helmet", group: "armor", slotGroup: "helmet" },
  { id: "cloak", label: "Cloak", group: "armor", slotGroup: "cloak" },
  { id: "chest", label: "Chest", group: "armor", slotGroup: "chest" },
  { id: "gloves", label: "Gloves", group: "armor", slotGroup: "gloves" },
  { id: "pants", label: "Pants", group: "armor", slotGroup: "pants" },
  { id: "boots", label: "Boots", group: "armor", slotGroup: "boots" },
  { id: "belt", label: "Belt", group: "accessory", slotGroup: "belt" },
  { id: "necklace", label: "Necklace", group: "accessory", slotGroup: "necklace" },
  { id: "earring1", label: "Earring", group: "accessory", slotGroup: "earring" },
  { id: "earring2", label: "Earring", group: "accessory", slotGroup: "earring" },
  { id: "ring1", label: "Ring", group: "accessory", slotGroup: "ring" },
  { id: "ring2", label: "Ring", group: "accessory", slotGroup: "ring" },
  { id: "bracelet", label: "Bracelet", group: "accessory", slotGroup: "bracelet" },
  { id: "brooch", label: "Brooch", group: "accessory", slotGroup: "brooch" },
];

// Grade 51 items were scraped as "legendary" before any grade-61+ item
// existed to reveal that T&L's real order is .../Epic/Heroic/Legendary -
// grade 51 is Heroic. Renamed here and in the underlying item data;
// true Legendary isn't in the dataset yet.
export const RARITIES = {
  common: { label: "Common", color: "#8A8F98" },
  uncommon: { label: "Uncommon", color: "#5FB77E" },
  rare: { label: "Rare", color: "#5b8fae" },
  epic: { label: "Epic", color: "#8f6fbd" },
  heroic: { label: "Heroic", color: "#cf9a4e" },
};

// Descending - heroic first, common last - for sorting the Database
// list. Not object key order (RARITIES above is ascending) since
// that's used for display elsewhere and shouldn't change.
export const RARITY_ORDER = ["heroic", "epic", "rare", "uncommon", "common"];

/* Inheritance: lets a player move a higher item level onto a piece
   they've already sunk trait investment into, instead of re-trait-
   ing a fresh drop from scratch. Paid in one of three ores, chosen
   by gear category. */
export const ORES = {
  weapon: { name: "Precious Rubrix Ore", color: "#c0524a" },
  armor: { name: "Precious Stalon Ore", color: "#c9a227" },
  accessory: { name: "Precious Emeret Ore", color: "#5a9c5f" },
};

/* Full stat taxonomy, grouped and ordered to match the in-game
   character sheet tabs. */
export const STAT_GROUPS = [
  {
    label: "Attributes",
    keys: ["str", "dex", "wis", "per", "fort"],
    labels: { str: "Strength", dex: "Dexterity", wis: "Wisdom", per: "Perception", fort: "Fortitude" },
  },
  {
    label: "Attack",
    keys: [
      "attackSpeed", "atkSpeedPct", "rangeFlat", "rangePct", "bonusDamage", "offHandAtkChance", "blockChancePenetration", "speciesDamageBoost",
      "animalDamageBonus", "constructDamageBonus", "humanoidDamageBonus", "undeadDamageBonus", "damageReductionPenetration",
      // raw_* are the same stats under Questlog's un-normalized field
      // names - a handful of items were scraped before the camelCase
      // pass below ran, so both forms need a real label.
      "raw_damage_reduction_penetration", "raw_bonus_creation_attack_power", "raw_bonus_undead_attack_power",
      "raw_bonus_animal_attack_power", "raw_bonus_grankus_attack_power",
    ],
    labels: {
      attackSpeed: "Attack Speed", atkSpeedPct: "Attack Speed", rangeFlat: "Range", rangePct: "Range",
      bonusDamage: "Bonus Damage", offHandAtkChance: "Off-Hand Weapon Attack Chance",
      blockChancePenetration: "Block Chance Penetration", speciesDamageBoost: "Species Damage Boost",
      animalDamageBonus: "Wildkin Bonus Damage", constructDamageBonus: "Construct Bonus Damage",
      humanoidDamageBonus: "Humanoid Bonus Damage", undeadDamageBonus: "Undead Bonus Damage",
      damageReductionPenetration: "Damage Reduction Penetration",
      raw_damage_reduction_penetration: "Damage Reduction Penetration",
      raw_bonus_creation_attack_power: "Construct Bonus Damage",
      raw_bonus_undead_attack_power: "Undead Bonus Damage",
      raw_bonus_animal_attack_power: "Wildkin Bonus Damage",
      raw_bonus_grankus_attack_power: "Grankus Bonus Damage",
    },
    units: { attackSpeed: "s", rangeFlat: "m" },
  },
  {
    label: "Damage",
    keys: ["meleeCrit", "magicCrit", "rangedCrit", "meleeHeavyAtk", "rangedHeavyAtk", "magicHeavyAtk", "criticalDamagePct"],
    labels: {
      meleeCrit: "Melee Critical Hit Chance", magicCrit: "Magic Critical Hit Chance", rangedCrit: "Ranged Critical Hit Chance",
      meleeHeavyAtk: "Melee Heavy Attack Chance", rangedHeavyAtk: "Ranged Heavy Attack Chance", magicHeavyAtk: "Magic Heavy Attack Chance",
      criticalDamagePct: "Critical Damage",
    },
  },
  {
    label: "Hit",
    keys: ["meleeHit", "rangedHit", "magicHit"],
    labels: { meleeHit: "Melee Hit Chance", rangedHit: "Ranged Hit Chance", magicHit: "Magic Hit Chance" },
  },
  {
    label: "Protection",
    keys: [
      "damageReduction", "meleeDefense", "rangedDefense", "magicDefense", "meleeEvasion", "rangedEvasion", "magicEvasion", "meleeEndurance", "rangedEndurance", "magicEndurance", "meleeHeavyAtkEvasion", "rangedHeavyAtkEvasion", "magicHeavyAtkEvasion", "criticalDamageResistPct", "heavyAtkDamageResistPct",
      "speciesDamageResist", "shieldBlockChancePct",
      "raw_shield_block_chance", "raw_all_species_damage_resistance",
    ],
    labels: {
      damageReduction: "Damage Reduction", meleeDefense: "Melee Defense", rangedDefense: "Ranged Defense", magicDefense: "Magic Defense",
      meleeEvasion: "Melee Evasion", rangedEvasion: "Ranged Evasion", magicEvasion: "Magic Evasion",
      meleeEndurance: "Melee Endurance", rangedEndurance: "Ranged Endurance", magicEndurance: "Magic Endurance",
      meleeHeavyAtkEvasion: "Melee Heavy Attack Evasion", rangedHeavyAtkEvasion: "Ranged Heavy Attack Evasion", magicHeavyAtkEvasion: "Magic Heavy Attack Evasion",
      criticalDamageResistPct: "Critical Damage Resistance", heavyAtkDamageResistPct: "Heavy Attack Damage Resistance",
      speciesDamageResist: "Species Damage Resistance", shieldBlockChancePct: "Block Chance",
      raw_shield_block_chance: "Block Chance", raw_all_species_damage_resistance: "All Species Damage Resistance",
    },
    units: { shieldBlockChancePct: "%", raw_shield_block_chance: "%" },
  },
  {
    label: "Resources",
    keys: ["maxHealth", "healthRegen", "maxMana", "manaRegen", "manaCostEfficiencyPct", "raw_shield_modifier"],
    labels: {
      maxHealth: "Max Health", healthRegen: "Health Regen", maxMana: "Max Mana", manaRegen: "Mana Regen",
      manaCostEfficiencyPct: "Mana Cost Efficiency", raw_shield_modifier: "Shield Health",
    },
    units: { raw_shield_modifier: "%" },
  },
  {
    label: "Movement",
    keys: ["movementSpeedPct", "maxStamina", "staminaRegen"],
    labels: { movementSpeedPct: "Movement Speed", maxStamina: "Max Stamina", staminaRegen: "Stamina Regen" },
  },
  {
    label: "Skills",
    keys: [
      "skillDamageBoost", "cooldownSpeedPct", "healingPct", "buffDurationPct", "debuffDurationPct", "amitoiHealingPct", "healOverTimePct",
      "raw_continuous_heal_modifier",
    ],
    labels: {
      skillDamageBoost: "Skill Damage Boost", cooldownSpeedPct: "Cooldown Speed", healingPct: "Healing",
      buffDurationPct: "Buff Duration", debuffDurationPct: "Debuff Duration", amitoiHealingPct: "Amitoi Healing",
      healOverTimePct: "Skill Healing over Time", raw_continuous_heal_modifier: "Skill Healing over Time",
    },
    units: { raw_continuous_heal_modifier: "%" },
  },
  {
    label: "Resistance",
    keys: ["weakenResist", "stunResist", "petrificationResist", "sleepResist", "silenceResist", "fearResist", "bindResist", "collisionResist", "skillDamageResistPct", "raw_all_state_tolerance"],
    labels: {
      weakenResist: "Weaken Resistance", stunResist: "Stun Resistance", petrificationResist: "Petrification Resistance",
      sleepResist: "Sleep Resistance", silenceResist: "Silence Resistance", fearResist: "Fear Resistance",
      bindResist: "Bind Resistance", collisionResist: "Collision Resistance", skillDamageResistPct: "Skill Damage Resistance",
      raw_all_state_tolerance: "CC Resistance",
    },
    // despite the Pct-suffixed key (matching the game's raw field name),
    // this is a flat number, not a percentage - override unitFor's default.
    units: { skillDamageResistPct: "" },
  },
  {
    label: "Crowd Control",
    keys: ["stunChance", "fearChance", "bindChance", "petrificationChance", "sleepChance", "collisionChance", "silenceChance", "weakenChance"],
    labels: {
      stunChance: "Stun Chance", fearChance: "Fear Chance", bindChance: "Bind Chance", petrificationChance: "Petrification Chance",
      sleepChance: "Sleep Chance", collisionChance: "Collision Chance", silenceChance: "Silence Chance", weakenChance: "Weaken Chance",
    },
  },
  {
    label: "PvP",
    keys: ["pvpMeleeCrit", "pvpRangedCrit", "pvpMagicCrit", "pvpMeleeEndurance", "pvpRangedEndurance", "pvpMagicEndurance", "pvpMeleeHit", "pvpRangedHit", "pvpMagicHit", "pvpMeleeEvasion", "pvpRangedEvasion", "pvpMagicEvasion", "pvpMeleeHeavyAtk", "pvpRangedHeavyAtk", "pvpMagicHeavyAtkChance", "pvpMeleeHeavyAtkEvasion", "pvpRangedHeavyAtkEvasion", "pvpMagicHeavyAtkEvasion"],
    labels: {
      pvpMeleeCrit: "PvP Melee Critical Hit Chance", pvpRangedCrit: "PvP Ranged Critical Hit Chance", pvpMagicCrit: "PvP Magic Critical Hit Chance",
      pvpMeleeEndurance: "PvP Melee Endurance", pvpRangedEndurance: "PvP Ranged Endurance", pvpMagicEndurance: "PvP Magic Endurance",
      pvpMeleeHit: "PvP Melee Hit Chance", pvpRangedHit: "PvP Ranged Hit Chance", pvpMagicHit: "PvP Magic Hit Chance",
      pvpMeleeEvasion: "PvP Melee Evasion", pvpRangedEvasion: "PvP Ranged Evasion", pvpMagicEvasion: "PvP Magic Evasion",
      pvpMeleeHeavyAtk: "PvP Melee Heavy Attack Chance", pvpRangedHeavyAtk: "PvP Ranged Heavy Attack Chance", pvpMagicHeavyAtkChance: "PvP Magic Heavy Attack Chance",
      pvpMeleeHeavyAtkEvasion: "PvP Melee Heavy Attack Evasion", pvpRangedHeavyAtkEvasion: "PvP Ranged Heavy Attack Evasion", pvpMagicHeavyAtkEvasion: "PvP Magic Heavy Attack Evasion",
    },
  },
  {
    label: "Boss",
    keys: ["bossDamageReduction", "bossMeleeCrit", "bossRangedCrit", "bossMagicCrit", "bossMeleeEndurance", "bossRangedEndurance", "bossMagicEndurance", "bossMeleeHit", "bossRangedHit", "bossMagicHit", "bossMeleeEvasion", "bossRangedEvasion", "bossMagicEvasion", "bossMeleeHeavyAtk", "bossRangedHeavyAtk", "bossMagicHeavyAtk"],
    labels: {
      bossDamageReduction: "Boss Damage Reduction", bossMeleeCrit: "Boss Melee Critical Hit Chance", bossRangedCrit: "Boss Ranged Critical Hit Chance",
      bossMagicCrit: "Boss Magic Critical Hit Chance", bossMeleeEndurance: "Boss Melee Endurance", bossRangedEndurance: "Boss Ranged Endurance",
      bossMagicEndurance: "Boss Magic Endurance", bossMeleeHit: "Boss Melee Hit Chance", bossRangedHit: "Boss Ranged Hit Chance",
      bossMagicHit: "Boss Magic Hit Chance", bossMeleeEvasion: "Boss Melee Evasion", bossRangedEvasion: "Boss Ranged Evasion",
      bossMagicEvasion: "Boss Magic Evasion", bossMeleeHeavyAtk: "Boss Melee Heavy Attack Chance", bossRangedHeavyAtk: "Boss Ranged Heavy Attack Chance",
      bossMagicHeavyAtk: "Boss Magic Heavy Attack Chance",
    },
  },
  {
    label: "Directional",
    keys: [
      "sideHitChance", "backCriticalHit", "backHeavyAtkChance", "backHitChance",
      "frontEndurance", "frontHeavyAtkEvasion", "frontEvasion", "frontDamageReduction",
      "sideEndurance", "sideHeavyAtk", "sideHeavyAtkEvasion", "sideEvasion", "sideDamageReduction",
      "raw_front_all_evasion", "raw_side_all_evasion", "raw_front_damage_reduction", "raw_side_damage_reduction",
      "raw_side_all_double_attack", "raw_front_all_critical_defense", "raw_side_all_critical_defense",
      "raw_front_all_double_defense", "raw_side_all_double_defense",
    ],
    labels: {
      sideHitChance: "Side Hit Chance", backCriticalHit: "Back Critical Hit", backHeavyAtkChance: "Back Heavy Attack Chance", backHitChance: "Back Hit Chance",
      frontEndurance: "Front Endurance", frontHeavyAtkEvasion: "Front Heavy Attack Evasion", frontEvasion: "Front Evasion", frontDamageReduction: "Front Damage Reduction",
      sideEndurance: "Side Endurance", sideHeavyAtk: "Side Heavy Attack Chance", sideHeavyAtkEvasion: "Side Heavy Attack Evasion", sideEvasion: "Side Evasion", sideDamageReduction: "Side Damage Reduction",
      raw_front_all_evasion: "Front Evasion", raw_side_all_evasion: "Side Evasion",
      raw_front_damage_reduction: "Front Damage Reduction", raw_side_damage_reduction: "Side Damage Reduction",
      raw_side_all_double_attack: "Side Heavy Attack Chance",
      raw_front_all_critical_defense: "Front Critical Hit Defense", raw_side_all_critical_defense: "Side Critical Hit Defense",
      raw_front_all_double_defense: "Front Heavy Attack Defense", raw_side_all_double_defense: "Side Heavy Attack Defense",
    },
  },
  {
    label: "Misc",
    keys: ["ccChance", "humanoidDamageResist", "heavyAtkDamagePct", "potionHealingPct", "pvpDamagePct", "weaponDamagePct"],
    labels: {
      ccChance: "CC Chance", humanoidDamageResist: "Humanoid Damage Resistance", heavyAtkDamagePct: "Heavy Attack Damage",
      potionHealingPct: "Potion Healing", pvpDamagePct: "PvP Damage", weaponDamagePct: "Weapon Damage",
    },
  },
];

export const STAT_LABELS = STAT_GROUPS.reduce((acc, g) => ({ ...acc, ...g.labels }), {});
export const STAT_UNITS = STAT_GROUPS.reduce((acc, g) => ({ ...acc, ...(g.units || {}) }), {});
export function unitFor(key) {
  if (key in STAT_UNITS) return STAT_UNITS[key];
  if (key.endsWith("Pct")) return "%";
  return "";
}

export const SOURCE_ICON = { boss: Skull, dungeon: Shield, worlddrop: Sparkles, vendor: Package, craft: Hammer };

// Every class in the game, for the Party Planner's per-slot role
// dropdown (PartyPlannerTab.js) - alphabetical, no in-game grouping
// (tank/dps/healer) since T&L classes are weapon-pair combos rather
// than fixed archetypes.
export const CLASS_ROLES = [
  "Archon", "Battleweaver", "Berserker", "Cavalier", "Crucifix", "Crusader", "Darkblighter", "Destroyer",
  "Disciple", "Enigma", "Eradicator", "Fury", "Gladiator", "Guardian", "Impaler", "Infiltrator", "Invocator",
  "Juggernaught", "Justicar", "Liberator", "Lunarch", "Mauler", "Mobilist", "Oracle", "Outrider", "Paladin",
  "Polaris", "Predator", "Raider", "Ranger", "Ravager", "Scorpion", "Scout", "Scryer", "Seeker", "Sentinel",
  "Shadowdancer", "Shrike", "Soulcrusher", "Spellblade", "Steelheart", "Templar", "Tormentor", "Voidlance", "Warden",
];

export const PARTY_GROUP_COUNT = 10;
export const PARTY_SLOT_COUNT = 6;

/* The three melee/ranged/magic (and their PvP-parallel) keys that a
   "plain" unified stat (e.g. Questlog's raw all_critical_attack)
   feeds equally - see calculations.js, where that raw value is
   SUMMED into all three so build-stat math stays correct even when
   an item also has a type-specific bonus on top. This table is only
   for DISPLAY: when a piece has nothing but the plain/unified
   version, all three end up numerically identical, and showing three
   redundant "Melee/Ranged/Magic X" lines is worse than showing the
   one plain stat name the game itself would show. If a type-specific
   bonus makes one of the three differ, all three stay split. */
export const UNIFIED_STAT_GROUPS = [
  { keys: ["meleeDefense", "rangedDefense", "magicDefense"], label: "Defense" },
  { keys: ["meleeHit", "rangedHit", "magicHit"], label: "Hit Chance" },
  { keys: ["meleeCrit", "rangedCrit", "magicCrit"], label: "Critical Hit Chance" },
  { keys: ["meleeEndurance", "rangedEndurance", "magicEndurance"], label: "Endurance" },
  { keys: ["meleeHeavyAtk", "rangedHeavyAtk", "magicHeavyAtk"], label: "Heavy Attack Chance" },
  { keys: ["meleeHeavyAtkEvasion", "rangedHeavyAtkEvasion", "magicHeavyAtkEvasion"], label: "Heavy Attack Evasion" },
  { keys: ["meleeEvasion", "rangedEvasion", "magicEvasion"], label: "Evasion" },
  { keys: ["pvpMeleeHit", "pvpRangedHit", "pvpMagicHit"], label: "PvP Hit Chance" },
  { keys: ["pvpMeleeCrit", "pvpRangedCrit", "pvpMagicCrit"], label: "PvP Critical Hit Chance" },
  { keys: ["pvpMeleeEndurance", "pvpRangedEndurance", "pvpMagicEndurance"], label: "PvP Endurance" },
  { keys: ["pvpMeleeHeavyAtk", "pvpRangedHeavyAtk", "pvpMagicHeavyAtkChance"], label: "PvP Heavy Attack Chance" },
  { keys: ["pvpMeleeHeavyAtkEvasion", "pvpRangedHeavyAtkEvasion", "pvpMagicHeavyAtkEvasion"], label: "PvP Heavy Attack Evasion" },
  { keys: ["pvpMeleeEvasion", "pvpRangedEvasion", "pvpMagicEvasion"], label: "PvP Evasion" },
];

/* Given a flat map of statKey -> already-resolved numeric value,
   finds every UNIFIED_STAT_GROUPS triple that's fully present and
   numerically equal. Returns:
   - replacements: representativeKey (the melee one) -> {label, value}
     to render in place of that key
   - consumed: the OTHER two keys in each collapsed triple, to skip
     entirely so the stat isn't shown three times */
export function collapseUnifiedStats(resolvedValues) {
  const replacements = {};
  const consumed = new Set();
  for (const group of UNIFIED_STAT_GROUPS) {
    const [a, b, c] = group.keys.map((k) => resolvedValues[k]);
    if (a != null && b != null && c != null && a === b && b === c) {
      replacements[group.keys[0]] = { label: group.label, value: a };
      consumed.add(group.keys[1]);
      consumed.add(group.keys[2]);
    }
  }
  return { replacements, consumed };
}

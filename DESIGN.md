---
name: GuildLog
description: A brass-and-stone guild ledger for Throne & Liberty loot, DKP, and party management.
colors:
  worn-brass: "#cf9a4e"
  worn-brass-hi: "#e0ad5f"
  worn-brass-lo: "#c08f45"
  worn-brass-lit: "#f2d296"
  worn-brass-edge: "#8a6428"
  worn-brass-under: "#7d5a24"
  ink-bright: "#f0e4cd"
  ink: "#e3d8c4"
  ink-body: "#b3a591"
  ink-muted: "#ab9d8a"
  ink-faint: "#8a7b68"
  surface-card: "#241f1b"
  surface: "#2b2521"
  surface-control: "#342d27"
  surface-well: "#171310"
  surface-empty: "#211c19"
  border-hairline: "#453b33"
  border-mid: "#5a4c40"
  border-active: "#7a6136"
  danger: "#c96f6f"
  danger-ink: "#d98b7f"
  good: "#8a9b7c"
  rarity-rare: "#5b8fae"
  rarity-epic: "#8f6fbd"
  rarity-heroic: "#cf9a4e"
  bg-void: "#15110e"
typography:
  display:
    fontFamily: "Newsreader, serif"
    fontWeight: 500
    lineHeight: 1.2
  ui:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.06em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  control: "2px"
  panel: "3px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "9px"
  md: "16px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.worn-brass}"
    textColor: "#231d17"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
  button-secondary:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.worn-brass}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
  tab-active:
    backgroundColor: "{colors.worn-brass-lit}"
    textColor: "#2c2013"
    rounded: "{rounded.pill}"
---

# Design System: GuildLog

## Overview

**Creative North Star: "The Guildhall Ledger"**

GuildLog reads as a brass-bound account book kept open on a stone lectern in a guild keep, not a flat SaaS dashboard rendered in a browser. Every surface sits on a masonry stone texture; panels are cut from a single recurring "glass" recipe — a diagonal glare streak, a hotspot catching the top-left, and a bright lip along the top edge — so the whole app reads as one pane of glass laid over old stone, not a stack of unrelated cards. The brass accent (Worn Brass) is reserved for the things a member is meant to act on: primary buttons, the active tab, DKP totals, live-status. It is deliberately not spread everywhere — its rarity is what makes it read as valuable rather than decorative.

The system is weighty and tactile, a little worn — pill-shaped buttons with a real offset drop-shadow that reads as pressed rather than flat, engraved rule-dividers, visible stone grain. It explicitly rejects two directions: the light, flat-card look of generic SaaS admin tools, and a cartoonish, saturated "mobile gacha game" fantasy skin. This is closer to a serious, lived-in ledger than either.

**Key Characteristics:**
- Dark stone-masonry ground with a brass/gold glass sheen over every panel
- Brass accent used sparingly — reserved for primary action, active state, and value (DKP, live status)
- Pill-shaped buttons and tabs; small, sharp radii (2–3px) on panels, cards, and form controls
- Rarity-coded gem colors (rare blue, epic purple, heroic/brass gold) borrowed from the game itself
- Serif display face (Newsreader) for headings and brand type; sans (Archivo) for everything functional; mono (JetBrains Mono) for numeric/DKP values

## Colors

The palette is a single ink/brass/stone system: warm parchment ink on near-black stone, one brass accent, and desaturated status colors that don't compete with brass for attention.

### Primary
- **Worn Brass** (`#cf9a4e`): The one accent. Primary buttons (with a slow animated sheen), the active tab/pill, DKP totals, the live-status dot's glow ring, focus/hover accents. Used on a small fraction of any given screen — its rarity is the point.

### Neutral
- **Ink Bright** (`#f0e4cd`): Headings, brand wordmark, highest-emphasis text.
- **Ink** (`#e3d8c4`): Default body/UI text.
- **Ink Body** (`#b3a591`): Secondary reading text.
- **Ink Muted** (`#ab9d8a`): Labels, placeholders, muted UI text.
- **Ink Faint** (`#8a7b68`): Table headers, least-emphasis text.
- **Surface Card** (`#241f1b`) / **Surface** (`#2b2521`) / **Surface Control** (`#342d27`): Layered panel and control backgrounds, each a step lighter than the void behind it.
- **Surface Well** (`#171310`): Recessed surfaces — search inputs, empty item slots — anything that should read as a carved-in hollow rather than a raised panel.
- **Void** (`#15110e`): The page background beneath the stone texture.

### Status
- **Danger** (`#c96f6f`): Destructive actions, errors, leave-guild confirmation.
- **Good** (`#8a9b7c`): The live/online status dot.

### Rarity (game-derived)
- **Rare** (`#5b8fae`), **Epic** (`#8f6fbd`), **Heroic** (`#cf9a4e`, same value as Worn Brass): Item-rarity dots and diamonds in the database, wishlist, and paperdoll. Heroic intentionally shares the brass accent value — the game's top rarity and the app's one accent are the same color.

### Named Rules
**The One Accent Rule.** Worn Brass is the only saturated hue against the ink/stone palette outside of status and rarity colors. If a new element wants a highlight color, it reaches for brass or it stays neutral — it does not introduce a second accent hue.

## Typography

**Display Font:** Newsreader (serif), with a system-serif fallback.
**Body/UI Font:** Archivo (sans), with `system-ui, sans-serif` fallback.
**Label/Mono Font:** JetBrains Mono, for DKP totals and other numeric/tabular values.

**Character:** A ledger pairing — Newsreader gives headings and the brand wordmark a written, slightly formal weight; Archivo carries everything functional in a clean grotesque; JetBrains Mono marks anything that is literally a number being tallied.

### Hierarchy
- **Display** (weight 600, ~17px/1, Newsreader, `.11em` tracking): Brand wordmark and top-level identity.
- **Title** (weight 500, ~17px/1.2, Newsreader): Panel titles (`.panel-title`).
- **Body** (weight 500, 12–12.5px/1.3, Archivo): Default UI text — item rows, table cells, buttons.
- **Label** (weight 600, 10px/1, Archivo, `.06em` tracking, uppercase): Table headers, tab labels, small structural labels.
- **Numeric** (weight 600, 13px/1, JetBrains Mono): DKP totals and other tallied values, right-aligned.

### Named Rules
**The Serif-Is-Ceremony Rule.** Newsreader appears only on brand type and panel titles — never on body copy, buttons, or table cells. If it's something the user reads to operate the app, it's Archivo; if it's something that announces a section, it can be Newsreader.

## Layout

A centered 1240px column (`.app > *`) over the full-bleed stone background. The header and tab bar are sticky glass strips (`--panel-glass-chrome`) with a hairline bottom edge. Panels use small, consistent gaps (9–16px) rather than generous whitespace — the density fits a "ledger of many small entries" read (item rows, DKP rows, party slots) more than an airy marketing layout.

Responsive behavior (mobile web, not a native platform): the two-column Database/Build split collapses to one column at 860px; below 700px the tab tray becomes a hamburger dropdown portaled to `document.body`, the DKP table narrows via fixed pixel column widths with icon-only apply buttons, and the item-list panel caps its visible height; below 480px side padding tightens and the "Playing as" label hides. Desktop layout above these breakpoints is treated as the reference state — mobile adapts it, it does not get a separate design.

## Elevation & Depth

Layered glass plus lifted controls, not flat-with-glow. Panels use a five-layer `--panel-glass` gradient recipe (diagonal glare streak, top-left hotspot, top-edge lip, and a base tint) over `backdrop-filter: blur(5px) saturate(1.2)`, so every panel reads as a distinct pane of glass over the stone ground rather than a flat-colored card. Interactive controls (buttons, tabs) additionally carry a solid offset shadow (`0 3px 0 <edge color>`) that reads as a physically raised, pressable object, not just a bordered rectangle.

### Shadow Vocabulary
- **Panel lip** (`--panel-lip`: inset top/side highlights + `0 16px 34px -22px #000`): The glass-edge highlight and soft cast shadow on every glass panel.
- **Button press** (`0 3px 0 <accent-under|surface-well>`): The solid "raised object" shadow under primary/secondary buttons, tabs, and the Discord sign-in button.
- **Modal cast** (`0 24px 60px -30px rgba(0,0,0,.9)` / similar on `.auth-card`): A deep, soft shadow for elements that float above the whole page.

### Named Rules
**The Pressed-Not-Flat Rule.** Anything clickable (buttons, active tabs, pills) gets a solid offset shadow that implies it can be pressed. Anything that only contains content (panels, cards) gets the glass treatment instead — glass communicates "surface," the offset shadow communicates "control."

## Shapes

Two radius languages by role: **999px pills** for anything actionable (buttons, tabs, chips-as-actions), and **small, sharp radii (2–3px)** for anything that contains content (panels, inputs, item rows, table cells, paperdoll slots). Nothing uses a large "soft card" radius — the sharper radius on containers is part of what keeps the stone/ledger read instead of a rounded consumer-app read. Empty/unfilled states (empty paperdoll slots) use a dashed hairline border instead of a solid one to read as "not yet filled" rather than broken.

## Components

### Buttons
- **Shape:** Pill (`border-radius: 999px`).
- **Primary:** Animated brass gradient sheen (`linear-gradient` across `accent-lo → accent → accent-lit → accent → accent-lo`, slow `sheen` background-position animation), dark ink text (`#231d17`), offset brass-under shadow.
- **Secondary:** Dark control-surface gradient, brass text, offset well-colored shadow.
- **Discord (auth):** Discord brand blue (`#5865f2`), white text, same pill/offset-shadow shape as the rest of the system — the one place an off-palette color is allowed, because it names a third-party identity, not a GuildLog accent.
- **Hover / Focus:** Subtle lightening of the gradient stops; transitions are fast (`.14s ease`).

### Tabs
- **Shape:** Pill, same family as buttons.
- **Default:** Muted ink text on a near-transparent hairline-bordered pill.
- **Active:** Full brass gradient fill, dark ink text, no border — the same visual weight as a primary button, since the active tab is effectively "the current committed action."

### Panels / Cards
- **Corner Style:** 2–3px, sharp.
- **Background:** `--panel-glass` / `--panel-glass-deep` / `--panel-glass-chrome` depending on role (content panel, detail panel, header/tabbar chrome).
- **Shadow Strategy:** See Elevation & Depth — panel lip, not a button-style offset shadow.
- **Border:** 1px hairline, brightens slightly on hover.

### Inputs / Search
- **Style:** Recessed well background (`--surface-well`), hairline border, inset shadow — reads as carved-in rather than raised.
- **Focus:** Border brightens toward the brass/ink-edge family.

### Item Rows / Table Rows
- **Style:** Transparent at rest, `--surface` fill on hover; dense padding (9px); body-weight Archivo type.
- **Numeric cells** (DKP totals): right-aligned, JetBrains Mono, bold, bright ink.

### Rarity Indicators
- **Style:** An 8px dot (heroic gets a glow ring via `box-shadow: 0 0 8px currentColor`) or, on the paperdoll, a 7px diamond (45°-rotated square) — colored by the rarity palette above.

### Navigation (mobile)
- **Style:** Hamburger toggle (pill icon button) opens a portaled dropdown of full-width menu items using the tab color family; the active item gets the same brass gradient treatment as the desktop active tab, so identity carries across breakpoints even though the layout changes.

## Do's and Don'ts

### Do:
- **Do** keep Worn Brass rare — primary action, active state, and tallied values only.
- **Do** use pills for anything clickable and sharp 2–3px radii for anything that contains content.
- **Do** give clickable controls an offset "pressed" shadow; give containers the glass treatment instead.
- **Do** keep mobile layouts a rearrangement of the desktop reference state (hamburger nav, narrower columns, capped list heights) rather than a separately designed mobile skin.

### Don't:
- **Don't** introduce a second saturated accent hue alongside Worn Brass — status and rarity colors are deliberately desaturated so brass stays the one thing that pops.
- **Don't** flatten panels into plain solid-color cards — the multi-layer glass gradient is the system's signature surface treatment.
- **Don't** drift toward a light flat-SaaS look or a cartoonish saturated fantasy-game skin — both were explicitly rejected as anti-references.
- **Don't** use a large "soft card" border-radius; the sharp small radius on containers is intentional.

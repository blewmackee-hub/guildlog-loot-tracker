"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Search, Menu } from "lucide-react";
import ItemRow from "./ItemRow";
import ItemDetail from "./ItemDetail";
import Paperdoll from "./Paperdoll";
import StatSheet from "./StatSheet";
import WishlistTab from "./WishlistTab";
import FarmPlan from "./FarmPlan";
import ProfileBar from "./ProfileBar";
import GuildMembers from "./GuildMembers";
import DkpTab from "./DkpTab";
import PartyPlannerTab from "./PartyPlannerTab";
import { ITEMS, coarseGroupFor } from "@/lib/calculations";
import { SLOTS, RARITY_ORDER } from "@/lib/gameData";

// Database ordering: coarse paperdoll group (weapon, armor, accessory)
// top-to-bottom, then rarity descending within each group - so every
// heroic accessory comes before every epic accessory, rather than
// grouping by exact slot (all belts, then all necklaces...) first.
// Slot order is only a tiebreak within the same group+rarity, to keep
// same-rarity items loosely clustered by slot. Skill cores/unassigned
// items (no slot or slotGroup) sort after everything.
const GROUP_ORDER = ["weapon", "armor", "accessory"];
function groupRankFor(item) {
  const idx = GROUP_ORDER.indexOf(coarseGroupFor(item));
  return idx === -1 ? GROUP_ORDER.length : idx;
}
function slotRankFor(item) {
  if (item.slot) {
    const idx = SLOTS.findIndex((s) => s.id === item.slot);
    if (idx !== -1) return idx;
  }
  if (item.slotGroup) {
    const idx = SLOTS.findIndex((s) => s.slotGroup === item.slotGroup);
    if (idx !== -1) return idx;
  }
  return SLOTS.length;
}
function rarityRankFor(item) {
  const idx = RARITY_ORDER.indexOf(item.rarity);
  return idx === -1 ? RARITY_ORDER.length : idx;
}
// Final tiebreak within the same group+rarity+slot: item level
// (descending - highest level first), not alphabetical - name only
// breaks a level tie. Items with no level (materials, some skill
// cores) sort after leveled ones.
function levelRankFor(item) {
  return -(item.levelRange?.max ?? -Infinity);
}

export default function App() {
  const router = useRouter();
  const [tab, setTab] = useState("database");
  const [selectedItem, setSelectedItem] = useState(null);
  const [wishlist, setWishlist] = useState({});
  const [savedItems, setSavedItems] = useState({});
  const [filterGroup, setFilterGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [more, setMore] = useState({ key: "", n: 60 }); // rows in the DOM; more load as the list end scrolls into view
  const [pendingSlot, setPendingSlot] = useState(null);
  const [buildError, setBuildError] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavTop, setMobileNavTop] = useState(0);
  const headerRef = useRef(null);
  const detailPanelRef = useRef(null);

  // Database/Build's list+detail panels sit side by side on desktop -
  // both always in view, nothing to scroll to. Below the 860px
  // breakpoint where .layout--split collapses to one column (see
  // globals.css), the detail panel ends up stacked below a scrollable
  // item list instead, easy to miss after tapping an item. Only jump
  // to it there - desktop shouldn't hijack the user's scroll position.
  useEffect(() => {
    if (!selectedItem || !detailPanelRef.current) return;
    if (window.innerWidth > 860) return;
    detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedItem]);

  // Portaled to document.body (see Modal.js for the same trick, same
  // reason): .app__header sets backdrop-filter, which makes it a
  // containing block for position:fixed descendants same as it would
  // for position:absolute - so a plain fixed-position dropdown/backdrop
  // nested inside the header doesn't actually reach the viewport, it's
  // clipped to the header's own (much shorter) box. Escaping to body
  // sidesteps that, but then the dropdown needs its own top offset
  // instead of `top: 100%` off its old header parent - measured here
  // since the header's height isn't a fixed constant (it wraps to a
  // second row on narrow screens).
  useEffect(() => {
    if (!mobileNavOpen || !headerRef.current) return;
    const update = () => setMobileNavTop(headerRef.current.getBoundingClientRect().bottom);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mobileNavOpen]);

  const [character, setCharacter] = useState(null);
  const [guildName, setGuildName] = useState(null);
  const [isGuildOwner, setIsGuildOwner] = useState(false);
  const [isGuildOfficer, setIsGuildOfficer] = useState(false);
  const [canClaimLeadership, setCanClaimLeadership] = useState(false);
  const [claimingLeadership, setClaimingLeadership] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);

  // characters.build (paperdoll slot->item map) and characters.wishlist
  // (saved-for-later items) are the DB column names from db/schema.sql -
  // they map onto this component's `wishlist`/`savedItems` state below.
  function applyContext(ctx) {
    setCharacter(ctx.character);
    setGuildName(ctx.guild?.name ?? null);
    setIsGuildOwner(ctx.guild?.isOwner ?? false);
    setIsGuildOfficer(ctx.guild?.isOfficer ?? false);
    setCanClaimLeadership(ctx.guild?.canClaimLeadership ?? false);
    setCharacters(ctx.characters ?? []);
    setWishlist(ctx.character.build ?? {});
    setSavedItems(ctx.character.wishlist ?? {});
    setIsSiteAdmin(ctx.isSiteAdmin ?? false);
  }

  // Load the active character once on mount. page.js already redirects
  // to /login or /guild server-side when there's no session/character,
  // so a null character here only happens if that state changed after
  // the page loaded (e.g. session expired) - fall back to /guild.
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/character");
      const data = await res.json();
      if (!data.character) {
        router.push("/guild");
        return;
      }
      applyContext(data);
      setDataLoaded(true);
    })();
  }, [router]);

  // Debounced autosave - a level slider drag fires many updates in a
  // row, so wait for a pause rather than PUTing on every change.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!dataLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/character", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ build: wishlist, wishlist: savedItems }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [wishlist, savedItems, dataLoaded]);

  async function switchCharacter(characterId) {
    if (!characterId || characterId === character?.id) return;
    setDataLoaded(false);
    const res = await fetch("/api/character/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDataLoaded(true);
      return;
    }
    applyContext(data);
    setDataLoaded(true);
  }

  async function createCharacter(name) {
    setDataLoaded(false);
    const res = await fetch("/api/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDataLoaded(true);
      return;
    }
    applyContext(data);
    setDataLoaded(true);
  }

  async function deleteCharacter(characterId) {
    setDataLoaded(false);
    const res = await fetch("/api/character", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
    const data = await res.json();
    if (res.ok) applyContext(data);
    setDataLoaded(true);
  }

  async function leaveGuild() {
    setDataLoaded(false);
    await fetch("/api/character/leave", { method: "POST" });
    router.push("/guild");
  }

  async function deleteGuild() {
    setDataLoaded(false);
    await fetch("/api/guild/delete", { method: "POST" });
    router.push("/guild");
  }

  // After GuildMembers changes something about THIS account - ownership
  // handed off, or one of its own characters removed - refetch so the
  // owner flag and the "Playing as" list catch up, and bail out of the
  // (now inaccessible) Members tab if that's where they were standing.
  async function refreshContext() {
    const res = await fetch("/api/character");
    const data = await res.json();
    if (!data.character) return;
    applyContext(data);
    if (!data.guild?.isOwner && !data.guild?.isOfficer) setTab((t) => (t === "members" ? "database" : t));
  }

  // The old leader stays owner_discord_id right up until this call
  // succeeds - claimLeadership (src/lib/guilds.js) re-verifies the
  // inactivity window server-side, so a stale client-side
  // canClaimLeadership flag can't itself grant anything.
  async function claimLeadership() {
    setClaimingLeadership(true);
    try {
      const res = await fetch("/api/guild/claim-leadership", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBuildError(data.error || "Something went wrong.");
        return;
      }
      await refreshContext();
    } finally {
      setClaimingLeadership(false);
    }
  }

  const itemList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return Object.values(ITEMS)
      .filter((i) => !i.isMaterial)
      .filter((i) => filterGroup === "all" || coarseGroupFor(i) === filterGroup)
      .filter((i) => !query || i.name.toLowerCase().includes(query))
      .sort((a, b) => groupRankFor(a) - groupRankFor(b) || rarityRankFor(a) - rarityRankFor(b) || slotRankFor(a) - slotRankFor(b) || levelRankFor(a) - levelRankFor(b) || a.name.localeCompare(b.name));
  }, [filterGroup, searchQuery]);

  const listKey = `${filterGroup}|${searchQuery}`;
  const shown = more.key === listKey ? more.n : 60; // a new filter/search starts over at 60
  // Callback ref: (re)observes whenever the tripwire element mounts or shown/listKey change, so a remounted list can't leave a stale observer.
  const ioRef = useRef(null);
  const setMoreRef = useCallback((el) => {
    ioRef.current?.disconnect();
    if (!el) return;
    ioRef.current = new IntersectionObserver(([e]) => e.isIntersecting && setMore({ key: listKey, n: shown + 60 }), { rootMargin: "300px" });
    ioRef.current.observe(el);
  }, [shown, listKey]);

  // Only one Heroic-rarity item may be equipped per broad equipment type
  // (weapon/armor/accessory) at once - a real in-game restriction, not a
  // UI nicety, so it's enforced here rather than left to the player to
  // notice. `slot.group` (gameData.js) is exactly that weapon/armor/
  // accessory bucket already used for the database filter chips.
  function findHeroicConflict(item, targetSlotId) {
    if (item.rarity !== "heroic") return null;
    const targetGroup = SLOTS.find((s) => s.id === targetSlotId)?.group;
    if (!targetGroup) return null;
    const conflictSlotId = Object.keys(wishlist).find((sid) => {
      if (sid === targetSlotId) return false;
      const entry = wishlist[sid];
      if (!entry) return false;
      if (SLOTS.find((s) => s.id === sid)?.group !== targetGroup) return false;
      return ITEMS[entry.itemId]?.rarity === "heroic";
    });
    if (!conflictSlotId) return null;
    return SLOTS.find((s) => s.id === conflictSlotId)?.label || conflictSlotId;
  }

  function addToWishlist(item, explicitSlotId) {
    const targetSlotId = explicitSlotId || item.slot;
    if (!targetSlotId) return;
    const conflictLabel = findHeroicConflict(item, targetSlotId);
    if (conflictLabel) {
      setBuildError(`Only one Heroic item per equipment type at a time — remove the Heroic ${conflictLabel} first.`);
      return;
    }
    setBuildError(null);
    setWishlist((w) => ({ ...w, [targetSlotId]: { itemId: item.id, level: item.levelRange?.max ?? null } }));
    setPendingSlot(null);
    setTab("build");
  }

  function removeFromSlot(slotId) {
    setWishlist((w) => ({ ...w, [slotId]: null }));
  }

  function updateLevel(slotId, level) {
    setWishlist((w) => ({ ...w, [slotId]: { ...w[slotId], level } }));
  }

  // Traits/Heroic Trait/Potential Ability are all picked from the
  // item's own real pool (item.traitOptions/heroicTraitOptions/
  // potentialCatalogId - see Transform-Questlog.ps1); Resonance is the
  // one exception, still manual since there's no scraped catalog for
  // it. `patch` merges straight into the slot's entry, e.g.
  // { selectedTraits: [...] } or { selectedPotential: {...} }.
  function updateSlotMeta(slotId, patch) {
    setWishlist((w) => ({ ...w, [slotId]: { ...w[slotId], ...patch } }));
  }

  function handleSlotClick(slot) {
    setPendingSlot(slot);
    setFilterGroup(slot.group);
    setTab("database");
  }

  function toggleSaved(item) {
    setSavedItems((s) => {
      if (s[item.id]) {
        const next = { ...s };
        delete next[item.id];
        return next;
      }
      return { ...s, [item.id]: { level: item.levelRange?.max ?? null } };
    });
  }

  function removeFromWishlist(itemId) {
    setSavedItems((s) => {
      const next = { ...s };
      delete next[itemId];
      return next;
    });
  }

  function updateWishlistLevel(itemId, level) {
    setSavedItems((s) => ({ ...s, [itemId]: { ...s[itemId], level } }));
  }

  if (!character) {
    return (
      <div className="app">
        <div className="auth-screen"><p className="muted">Loading your character…</p></div>
      </div>
    );
  }

  const NAV_TABS = [
    { id: "database", label: "Database" },
    { id: "build", label: "Build" },
    { id: "wishlist", label: "Wishlist" },
    { id: "plan", label: "Farm Plan" },
    { id: "dkp", label: "DKP" },
    { id: "parties", label: "Parties" },
    ...(isGuildOwner || isGuildOfficer ? [{ id: "members", label: "Members" }] : []),
  ];

  return (
    <div className="app">
      <header className="app__header" ref={headerRef}>
        <div className="app__header-top">
          <Link href="/" className="brand-lockup">
            <div className="brand-lockup__crest" />
            <div className="brand-lockup__text">
              <span className="brand-lockup__word">GUILDLOG</span>
              <span className="brand-lockup__subline">Loot Tracker</span>
            </div>
          </Link>
          <ProfileBar
            guildName={guildName}
            activeCharacterId={character.id}
            characters={characters}
            onSwitch={switchCharacter}
            onCreate={createCharacter}
            onDeleteCharacter={deleteCharacter}
            onLeaveGuild={leaveGuild}
            isSiteAdmin={isSiteAdmin}
          >
            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
          </ProfileBar>
        </div>
        <div className="app__nav-row">
          <nav className="tabs">
            {NAV_TABS.map((t) => (
              <button key={t.id} className={`tab tab--${t.id} ${tab === t.id ? "tab--active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <button className={`tab tab--help ${tab === "help" ? "tab--active" : ""}`} onClick={() => setTab("help")}>
            Help
          </button>
        </div>
      </header>
      {mobileNavOpen && typeof document !== "undefined" && createPortal(
        <>
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
          <nav className="mobile-nav-menu" style={{ top: mobileNavTop }}>
            {[...NAV_TABS, { id: "help", label: "Help" }].map((t, i) => (
              <button
                key={t.id}
                className={`mobile-nav-menu__item tab--${t.id} ${tab === t.id ? "mobile-nav-menu__item--active" : ""}`}
                style={{ animationDelay: `${Math.min(i * 25, 150)}ms` }}
                onClick={() => {
                  setTab(t.id);
                  setMobileNavOpen(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </>,
        document.body
      )}

      {pendingSlot && tab === "database" && (
        <div className="pending-banner">
          Choose a {pendingSlot.label} for your build
          <button onClick={() => setPendingSlot(null)} aria-label="Cancel"><X size={13} /></button>
        </div>
      )}

      {buildError && (
        <div className="pending-banner pending-banner--error" role="alert">
          {buildError}
          <button onClick={() => setBuildError(null)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {canClaimLeadership && !isGuildOwner && (
        <div className="pending-banner pending-banner--claim">
          {guildName}&apos;s leader hasn&apos;t signed in for {"14+"} days.
          <button className="pending-banner__claim-btn" disabled={claimingLeadership} onClick={claimLeadership}>
            {claimingLeadership ? "Claiming…" : "Claim Leadership"}
          </button>
        </div>
      )}

      {tab === "database" && (
        <div className="layout layout--split">
          <div className="panel">
            <div className="search-row">
              <Search size={14} strokeWidth={1.5} />
              <input
                className="search-row__input"
                type="text"
                placeholder="Search items…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-row__clear" onClick={() => setSearchQuery("")} title="Clear search" aria-label="Clear search">
                  <X size={13} strokeWidth={2} />
                </button>
              )}
            </div>
            <div className="filter-row">
              {[
                { id: "all", label: "All" },
                { id: "weapon", label: "Weapon" },
                { id: "armor", label: "Armor" },
                { id: "accessory", label: "Accessory" },
                { id: "skillcore", label: "Skill Core" },
              ].map((g) => (
                <button key={g.id} className={`chip ${filterGroup === g.id ? "chip--active" : ""}`} onClick={() => setFilterGroup(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="item-list">
              {itemList.length === 0 && <p className="muted">No items match &quot;{searchQuery}&quot;.</p>}
              {itemList.slice(0, shown).map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} selected={selectedItem?.id === item.id} onSelect={setSelectedItem} />
              ))}
              {/* invisible 400px tripwire overlapping the last rows, so more load before the user reaches the end */}
              {shown < itemList.length && <div ref={setMoreRef} style={{ height: 400, marginTop: -400, flex: "none", pointerEvents: "none" }} />}
            </div>
          </div>
          <div className="layout-divider" />
          <div className="panel panel--detail" ref={detailPanelRef}>
            <ItemDetail
              item={selectedItem}
              wishlist={wishlist}
              pendingSlot={pendingSlot}
              onAddToWishlist={addToWishlist}
              savedItems={savedItems}
              onToggleSaved={toggleSaved}
            />
          </div>
        </div>
      )}

      {tab === "build" && (
        <div className="layout layout--split">
          <div className="panel">
            <h3 className="panel-title">{character.name}</h3>
            <Paperdoll wishlist={wishlist} onRemove={removeFromSlot} onSlotClick={handleSlotClick} onLevelChange={updateLevel} onUpdateMeta={updateSlotMeta} />
          </div>
          <div className="layout-divider" />
          <div className="panel panel--detail">
            <StatSheet wishlist={wishlist} />
          </div>
        </div>
      )}

      {tab === "wishlist" && (
        <div className="layout">
          <WishlistTab
            savedItems={savedItems}
            wishlist={wishlist}
            onEquip={addToWishlist}
            onRemove={removeFromWishlist}
            onLevelChange={updateWishlistLevel}
          />
        </div>
      )}

      {tab === "plan" && (
        <div className="layout">
          <FarmPlan savedItems={savedItems} wishlist={wishlist} />
        </div>
      )}

      {tab === "dkp" && (
        <div className="layout">
          <DkpTab />
        </div>
      )}

      {tab === "parties" && (
        <div className="layout">
          <PartyPlannerTab />
        </div>
      )}

      {tab === "members" && (isGuildOwner || isGuildOfficer) && (
        <div className="layout">
          <GuildMembers isOwner={isGuildOwner} guildName={guildName} onDeleteGuild={deleteGuild} onChanged={refreshContext} />
        </div>
      )}

      {tab === "help" && (
        <div className="layout">
          <div className="panel help-panel">
            <h3 className="panel-title">Welcome to GuildLog</h3>
            <p>
              GuildLog is your guild&apos;s shared loot planner — a home base for figuring out what to chase next and
              getting there together.
            </p>
            <p>
              Browse the <strong>Database</strong> to see every tracked item&apos;s stats, rarity, and where it drops.
              Save pieces you don&apos;t have yet to your <strong>Wishlist</strong> to compare options side-by-side, or
              slot a piece straight into your <strong>Build</strong> to model your character&apos;s current or
              prospective gear across every slot.
            </p>
            <p>
              <strong>Farm Plan</strong> is guild-wide: it tallies everyone&apos;s Wishlist into one list of what to
              farm and where, shows the ore cost to carry your own equipped Build up to max level, and lists the
              recipes for anything craftable on your own Wishlist.
            </p>
            <p>
              The <strong>DKP</strong> tab lists every guild member&apos;s Dragon Kill Points. Officers and the guild
              leader can edit totals; the leader can promote up to three members to officer from the <strong>Members</strong> tab, giving them editing
              privileges in both the <strong>Parties</strong> and <strong>DKP</strong> tabs.
            </p>
            <p>
              <strong>Parties</strong> lays out up to ten 6-player groups for GvG content or raids. Officers and the
              guild leader can assign a class to each slot and save the layout as a named board; everyone can view
              the saved boards.
            </p>
            <p>
              If you&apos;re the guild owner, the <strong>Members</strong> tab lets you manage your roster or pass
              leadership along to someone else entirely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Search } from "lucide-react";
import ItemRow from "./ItemRow";
import ItemDetail from "./ItemDetail";
import Paperdoll from "./Paperdoll";
import StatSheet from "./StatSheet";
import WishlistTab from "./WishlistTab";
import FarmPlan from "./FarmPlan";
import InheritanceTab from "./InheritanceTab";
import ProfileBar from "./ProfileBar";
import GuildMembers from "./GuildMembers";
import { ITEMS, coarseGroupFor } from "@/lib/calculations";

export default function App() {
  const router = useRouter();
  const [tab, setTab] = useState("database");
  const [selectedItem, setSelectedItem] = useState(null);
  const [wishlist, setWishlist] = useState({});
  const [savedItems, setSavedItems] = useState({});
  const [filterGroup, setFilterGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSlot, setPendingSlot] = useState(null);

  const [character, setCharacter] = useState(null);
  const [guildName, setGuildName] = useState(null);
  const [isGuildOwner, setIsGuildOwner] = useState(false);
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

  // After GuildMembers hands ownership to someone else, this account
  // no longer owns the guild - refetch so isGuildOwner flips off, and
  // bail out of the (now inaccessible) Members tab if that's where
  // they were standing.
  async function refreshAfterOwnerChange() {
    const res = await fetch("/api/character");
    const data = await res.json();
    if (!data.character) return;
    applyContext(data);
    if (!data.guild?.isOwner) setTab((t) => (t === "members" ? "database" : t));
  }

  const itemList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return Object.values(ITEMS)
      .filter((i) => !i.isMaterial)
      .filter((i) => filterGroup === "all" || coarseGroupFor(i) === filterGroup)
      .filter((i) => !query || i.name.toLowerCase().includes(query));
  }, [filterGroup, searchQuery]);

  function addToWishlist(item, explicitSlotId) {
    const targetSlotId = explicitSlotId || item.slot;
    if (!targetSlotId) return;
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

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-top">
          <Link href="/" className="brand-lockup">
            <div className="brand-lockup__crest">
              <div className="brand-lockup__crest-gem" />
            </div>
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
            onLeaveGuild={leaveGuild}
            isSiteAdmin={isSiteAdmin}
          />
        </div>
        <nav className="tabs">
          {[
            { id: "database", label: "Database" },
            { id: "build", label: "Build" },
            { id: "wishlist", label: "Wishlist" },
            { id: "plan", label: "Farm Plan" },
            { id: "inheritance", label: "Inheritance" },
            ...(isGuildOwner ? [{ id: "members", label: "Members" }] : []),
            { id: "help", label: "Help" },
          ].map((t) => (
            <button key={t.id} className={`tab tab--${t.id} ${tab === t.id ? "tab--active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {pendingSlot && tab === "database" && (
        <div className="pending-banner">
          Choose a {pendingSlot.label} for your build
          <button onClick={() => setPendingSlot(null)}><X size={13} /></button>
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
                <button className="search-row__clear" onClick={() => setSearchQuery("")} title="Clear search">
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
              {itemList.map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} selected={selectedItem?.id === item.id} onSelect={setSelectedItem} />
              ))}
            </div>
          </div>
          <div className="layout-divider" />
          <div className="panel panel--detail">
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
            <Paperdoll wishlist={wishlist} onRemove={removeFromSlot} onSlotClick={handleSlotClick} onLevelChange={updateLevel} />
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
          <FarmPlan savedItems={savedItems} />
        </div>
      )}

      {tab === "inheritance" && (
        <div className="layout">
          <InheritanceTab wishlist={wishlist} />
        </div>
      )}

      {tab === "members" && isGuildOwner && (
        <div className="layout">
          <GuildMembers guildName={guildName} onDeleteGuild={deleteGuild} onOwnerChanged={refreshAfterOwnerChange} />
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
              Once something&apos;s equipped, drag its level slider in the Build tab — the <strong>Inheritance</strong>{" "}
              tab will show the estimated ore cost to carry that piece up to its max level.
            </p>
            <p>
              <strong>Farm Plan</strong> turns your Wishlist into an action list: which bosses, dungeons, or vendors
              to hit, and roughly how many people each fight needs.
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

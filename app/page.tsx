"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import VinylShelf, { type VinylShelfHandle } from "@/components/VinylShelf3D";
import MiniVinyl from "@/components/MiniVinyl";
import SearchOverlay from "@/components/SearchOverlay";
import CollectionsOverlay from "@/components/CollectionsOverlay";
import data from "@/data/vinilos.json";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";
import {
  type Collection,
  loadCollections,
  saveCollections,
  loadActiveId,
  saveActiveId,
  newCollection,
  DEFAULT_ID,
} from "@/lib/collections";

export default function Home() {
  const [allVinilos, setAllVinilos] = useState<Vinyl[]>(data as Vinyl[]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>(DEFAULT_ID);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // hydrate from localStorage
  useEffect(() => {
    const allIds = (data as Vinyl[]).map((v) => v.id);
    const cols = loadCollections(allIds);
    setCollections(cols);
    const aid = loadActiveId();
    setActiveCollectionId(cols.some((c) => c.id === aid) ? aid : cols[0].id);
  }, []);

  // current collection's vinyls (filtered)
  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const vinilos = activeCollection
    ? activeCollection.vinylIds
        .map((id) => allVinilos.find((v) => v.id === id))
        .filter((v): v is Vinyl => !!v)
    : allVinilos;

  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState<Vinyl | null>(null);
  const [active, setActive] = useState<Vinyl>(allVinilos[0]);

  const updateCollections = useCallback((next: Collection[]) => {
    setCollections(next);
    saveCollections(next);
  }, []);

  const handleCreateCollection = (name: string) => {
    const c = newCollection(name);
    updateCollections([...collections, c]);
  };
  const handleRenameCollection = (id: string, name: string) => {
    updateCollections(collections.map((c) => (c.id === id ? { ...c, name } : c)));
  };
  const handleDeleteCollection = (id: string) => {
    const next = collections.filter((c) => c.id !== id);
    updateCollections(next);
    if (id === activeCollectionId) {
      const newActive = next[0]?.id ?? DEFAULT_ID;
      setActiveCollectionId(newActive);
      saveActiveId(newActive);
    }
  };
  const handleActivateCollection = (id: string) => {
    setActiveCollectionId(id);
    saveActiveId(id);
  };
  const handleToggleVinyl = (colId: string, vinylId: string) => {
    updateCollections(
      collections.map((c) => {
        if (c.id !== colId) return c;
        const has = c.vinylIds.includes(vinylId);
        return {
          ...c,
          vinylIds: has ? c.vinylIds.filter((id) => id !== vinylId) : [...c.vinylIds, vinylId],
        };
      }),
    );
  };
  const [playing, setPlaying] = useState(false);
  const shelfRef = useRef<VinylShelfHandle>(null);

  const handleVinylClick = (v: Vinyl) => {
    const idx = vinilos.findIndex((x) => x.id === v.id);
    if (idx < 0) return;
    setOpen(v);
    shelfRef.current?.open(idx);
  };

  const handleClose = useCallback(() => {
    setOpen(null);
    shelfRef.current?.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, searchOpen]);

  // audio cache: keyed by vinyl id → HTMLAudioElement (preloaded)
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeIndex = vinilos.findIndex((v) => v.id === active.id);

  // preload audio for the active item and its ±2 neighbours
  useEffect(() => {
    const window = 2;
    const cache = audioCacheRef.current;
    for (let d = -window; d <= window; d++) {
      const i = activeIndex + d;
      if (i < 0 || i >= vinilos.length) continue;
      const v = vinilos[i];
      if (!v.previewUrl || cache.has(v.id)) continue;
      const a = new Audio();
      a.preload = "auto";
      a.src = v.previewUrl;
      cache.set(v.id, a);
    }
  }, [activeIndex, vinilos]);

  const playPreview = useCallback((v: Vinyl) => {
    if (!v.previewUrl) {
      console.warn("no previewUrl for", v.id);
      return;
    }
    // stop whatever is currently playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    // create fresh inside the user gesture (cached one acts only as a network warm-up)
    const audio = new Audio(v.previewUrl);
    audio.preload = "auto";
    audio.addEventListener("ended", () => setPlaying(false));
    audio.addEventListener("error", (e) => {
      console.error("audio error", v.id, e);
      setPlaying(false);
    });
    currentAudioRef.current = audio;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch((err) => {
        console.error("play() rejected:", err);
        setPlaying(false);
      });
  }, []);

  // stop audio when active album changes (unless we triggered the change ourselves)
  const autoPlayOnSettleRef = useRef(false);
  useEffect(() => {
    if (autoPlayOnSettleRef.current) {
      autoPlayOnSettleRef.current = false;
      playPreview(active);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlaying(false);
    }
  }, [active.id, active, playPreview]);

  const togglePlay = () => {
    if (!active.previewUrl) return;
    if (playing && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setPlaying(false);
      return;
    }
    playPreview(active);
  };

  const goPrev = () => {
    autoPlayOnSettleRef.current = true;
    const N = vinilos.length;
    setActive(vinilos[(activeIndex - 1 + N) % N]);
    shelfRef.current?.prev();
  };

  const goNext = () => {
    autoPlayOnSettleRef.current = true;
    const N = vinilos.length;
    setActive(vinilos[(activeIndex + 1) % N]);
    shelfRef.current?.next();
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-paper">
      <VinylShelf ref={shelfRef} vinilos={vinilos} onOpen={handleVinylClick} onActiveChange={setActive} />

      {/* invisible backdrop while opened — click anywhere outside the vinyl closes */}
      {open && (
        <div
          onClick={handleClose}
          className="absolute inset-0 z-10"
          aria-label="close detail"
        />
      )}

      {/* side info that flanks the centred vinyl when opened — placed at the
          far edges of the viewport so it sits on the black background, never
          on top of the vinyl */}
      {open && (
        <>
          {/* containers are bounded so they NEVER cross the vinyl on screen.
              vinyl occupies the central ~42% horizontally → reserve 29% for each side. */}
          <motion.div
            key={`l-${open.id}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="pointer-events-none absolute left-[6vw] right-[71%] top-[42%] -translate-y-1/2 z-10 text-right text-paper/80"
          >
            <Field label="Artist" value={open.artist} />
            <Field label="Year" value={String(open.year)} />
            <Field label="Genre" value={open.genre} />
          </motion.div>
          <motion.div
            key={`r-${open.id}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="pointer-events-none absolute left-[71%] right-[6vw] top-[42%] -translate-y-1/2 z-10 text-left text-paper/80"
          >
            <Field label="Label" value={open.label} />
            <Field label="Country" value={open.country} />
            <Field label="Tracks" value={String(open.tracklist.length)} />
          </motion.div>
        </>
      )}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-8 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="RackrClub" className="h-5 w-auto opacity-80" />
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="text-[11px] uppercase tracking-[0.22em] text-paper/60 hover:text-paper transition flex items-center gap-2"
            aria-label="Buscar en Discogs"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" />
              <path d="M7.5 7.5 L10.5 10.5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Buscar
            <span className="text-paper/30 ml-1">/</span>
          </button>
          <div className="text-[11px] uppercase tracking-[0.22em] text-paper/60">
            {vinilos.length} discos
          </div>
        </div>
      </div>

      {/* active title — moves up + shrinks when a vinyl is opened so it never
          overlaps the centred cover */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center text-center transition-all duration-700 ease-out ${
          open ? "top-[4%]" : "top-[12%]"
        }`}
      >
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="px-6"
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-paper/50">
            {active.genre} · {active.year}
          </div>
          <h1
            className={`mt-2 font-serif italic leading-none text-paper transition-all duration-700 ease-out ${
              open ? "text-xl md:text-2xl" : "text-4xl md:text-5xl"
            }`}
          >
            {active.title}
          </h1>
          {!open && (
            <div className="mt-2 text-[13px] text-paper/60">{active.artist}</div>
          )}
        </motion.div>
      </div>

      {/* bottom-left: collection switcher */}
      <div className="absolute bottom-0 left-0 z-20 px-8 py-6">
        <button
          onClick={() => setCollectionsOpen(true)}
          className="group flex items-center gap-3 text-left hover:opacity-90 transition"
          aria-label="Cambiar colección"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-paper/30 text-paper/70 group-hover:text-paper group-hover:border-paper/60 transition">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2 L3 8 M1 4 L3 2 L5 4 M7 8 L7 2 M5 6 L7 8 L9 6" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
          <span>
            <span className="block font-serif text-[28px] italic leading-none">
              {activeCollection?.name ?? "Mi Colección"}
            </span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-paper/50">
              {vinilos.length} discos · cambiar
            </span>
          </span>
        </button>
      </div>

      {/* bottom-center: controls — always centered on viewport */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 py-7">
        <div className="pointer-events-auto flex items-center gap-6">
          <button
            onClick={goPrev}
            className="text-paper/70 hover:text-paper transition"
            aria-label="Previous"
          >
            <Skip dir="prev" />
          </button>
          <button
            onClick={togglePlay}
            disabled={!active.previewUrl}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-paper/30 text-paper hover:border-paper/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                <rect x="8" y="2" width="3" height="10" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            onClick={goNext}
            className="text-paper/70 hover:text-paper transition"
            aria-label="Next"
          >
            <Skip dir="next" />
          </button>
        </div>
      </div>

      {/* bottom-right: now viewing */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-20 px-8 py-6">
        <div className="flex items-center gap-3 text-right">
          <div className="max-w-[240px]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-paper/50">
              Ahora viendo
            </div>
            <div className="mt-1 truncate font-medium text-[15px]">{active.title}</div>
          </div>
          <MiniVinyl coverUrl={coverFor(active)} />
        </div>
      </div>

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAdded={(v) => {
          // add to master list
          setAllVinilos((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]));
          // also append to the currently active collection
          updateCollections(
            collections.map((c) =>
              c.id === activeCollectionId && !c.vinylIds.includes(v.id)
                ? { ...c, vinylIds: [...c.vinylIds, v.id] }
                : c,
            ),
          );
        }}
      />

      <CollectionsOverlay
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        collections={collections}
        activeId={activeCollectionId}
        onActivate={handleActivateCollection}
        onCreate={handleCreateCollection}
        onRename={handleRenameCollection}
        onDelete={handleDeleteCollection}
        onToggleVinyl={handleToggleVinyl}
        allVinilos={allVinilos}
      />
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[9px] uppercase tracking-[0.22em] text-paper/35">{label}</div>
      <div className="mt-1 text-[13px] tracking-tight">{value || "—"}</div>
    </div>
  );
}

function Skip({ dir }: { dir: "prev" | "next" }) {
  const flip = dir === "prev" ? "scale(-1, 1)" : undefined;
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style={{ transform: flip }}>
      <path d="M2 2 L11 7 L2 12 Z" fill="currentColor" />
      <rect x="13" y="2" width="2" height="10" fill="currentColor" />
    </svg>
  );
}

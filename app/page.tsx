"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import VinylShelf, { type VinylShelfHandle } from "@/components/VinylShelf3D";
import MiniVinyl from "@/components/MiniVinyl";
import SearchOverlay from "@/components/SearchOverlay";
import CollectionsOverlay from "@/components/CollectionsOverlay";
import VinylEditOverlay from "@/components/VinylEditOverlay";
import MarqueeText from "@/components/MarqueeText";
import data from "@/data/vinilos.json";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";
import {
  type Collection,
  type SortMode,
  loadCollections,
  saveCollections,
  loadActiveId,
  saveActiveId,
  newCollection,
  sortedVinylIds,
  DEFAULT_ID,
  WISHLIST_ID,
} from "@/lib/collections";

export default function Home() {
  const [allVinilos, setAllVinilos] = useState<Vinyl[]>(data as Vinyl[]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>(DEFAULT_ID);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate from localStorage (with a minimum 3s display of the loading screen)
  useEffect(() => {
    const allIds = (data as Vinyl[]).map((v) => v.id);
    const cols = loadCollections(allIds);
    setCollections(cols);
    const aid = loadActiveId();
    setActiveCollectionId(cols.some((c) => c.id === aid) ? aid : cols[0].id);
    const t = setTimeout(() => setHydrated(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // current collection's vinyls (filtered + sorted)
  // Wishlist and Mi Colección are mutually exclusive: a vinyl is owned (Mi
  // Colección + custom lists) OR wished (Wishlist), never both.
  const wishlist = collections.find((c) => c.id === WISHLIST_ID);
  const wishlistSet = new Set(wishlist?.vinylIds ?? []);
  const ownedVinylIds = allVinilos
    .map((v) => v.id)
    .filter((id) => !wishlistSet.has(id));

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const effectiveCollection = activeCollection
    ? activeCollection.id === DEFAULT_ID
      ? { ...activeCollection, vinylIds: ownedVinylIds }
      : activeCollection
    : null;
  const vinilos = effectiveCollection
    ? sortedVinylIds(effectiveCollection, allVinilos)
        .map((id) => allVinilos.find((v) => v.id === id))
        .filter((v): v is Vinyl => !!v)
    : allVinilos;

  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState<Vinyl | null>(null);
  const [fullyOpen, setFullyOpen] = useState(false); // true after the open animation finishes
  const [active, setActive] = useState<Vinyl | null>(allVinilos[0] ?? null);

  // delay the edit overlay until the open animation is done (~2400ms in shelf)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setFullyOpen(true), 2400);
      return () => clearTimeout(t);
    }
    setFullyOpen(false);
  }, [open]);

  // ensure active is always one from the current collection (or first if empty)
  useEffect(() => {
    if (vinilos.length === 0) {
      setActive(null);
      return;
    }
    if (!active || !vinilos.some((v) => v.id === active.id)) {
      setActive(vinilos[0]);
    }
  }, [vinilos, active]);

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
    if (id === DEFAULT_ID) return; // primary collection is permanent
    const next = collections.filter((c) => c.id !== id);
    updateCollections(next);
    if (id === activeCollectionId) {
      const newActive = next[0]?.id ?? DEFAULT_ID;
      setActiveCollectionId(newActive);
      saveActiveId(newActive);
    }
  };
  const handleActivateCollection = (id: string) => {
    // close any open vinyl when switching list so the detail view doesn't
    // linger over a vinyl that no longer exists in the new collection
    if (open) handleClose();
    setActiveCollectionId(id);
    saveActiveId(id);
  };
  const handleAddVinylTo = (colId: string, vinylId: string) => {
    const addingToWishlist = colId === WISHLIST_ID;
    updateCollections(
      collections.map((c) => {
        if (c.id === colId) {
          return c.vinylIds.includes(vinylId)
            ? c
            : { ...c, vinylIds: [...c.vinylIds, vinylId] };
        }
        // mutually exclusive with wishlist
        if (addingToWishlist && c.id !== WISHLIST_ID) {
          return c.vinylIds.includes(vinylId)
            ? { ...c, vinylIds: c.vinylIds.filter((id) => id !== vinylId) }
            : c;
        }
        if (!addingToWishlist && c.id === WISHLIST_ID) {
          return c.vinylIds.includes(vinylId)
            ? { ...c, vinylIds: c.vinylIds.filter((id) => id !== vinylId) }
            : c;
        }
        return c;
      }),
    );
  };

  const handleRemoveVinylFromActive = (vinylId: string) => {
    updateCollections(
      collections.map((c) =>
        c.id === activeCollectionId
          ? { ...c, vinylIds: c.vinylIds.filter((id) => id !== vinylId) }
          : c,
      ),
    );
  };

  const handleDeleteVinylPermanently = (vinylId: string) => {
    // remove from master list AND from every collection
    setAllVinilos((prev) => prev.filter((v) => v.id !== vinylId));
    updateCollections(
      collections.map((c) => ({
        ...c,
        vinylIds: c.vinylIds.filter((id) => id !== vinylId),
      })),
    );
    // persist deletion to the JSON via a small API call (optional for now)
    fetch("/api/vinyl/" + encodeURIComponent(vinylId), { method: "DELETE" }).catch(() => {});
  };

  const handleSetSort = (colId: string, sortBy: SortMode) => {
    updateCollections(
      collections.map((c) => (c.id === colId ? { ...c, sortBy } : c)),
    );
  };

  const handleReorderVinyl = (colId: string, fromIdx: number, toIdx: number) => {
    updateCollections(
      collections.map((c) => {
        if (c.id !== colId) return c;
        const ids = [...c.vinylIds];
        const [moved] = ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, moved);
        return { ...c, vinylIds: ids, sortBy: "custom" };
      }),
    );
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
      // arrows navigate prev/next while a vinyl is opened
      if (open && !searchOpen) {
        if (e.key === "ArrowRight") goNext();
        else if (e.key === "ArrowLeft") goPrev();
      }
      // space toggles play/pause for the active preview
      if (e.code === "Space" && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          togglePlay();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleClose, searchOpen, open]);

  // audio cache: keyed by vinyl id → HTMLAudioElement (preloaded)
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeIndex = active ? vinilos.findIndex((v) => v.id === active.id) : -1;

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
    if (active && autoPlayOnSettleRef.current) {
      autoPlayOnSettleRef.current = false;
      playPreview(active);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlaying(false);
    }
  }, [active?.id, active, playPreview]);

  const togglePlay = () => {
    if (!active?.previewUrl) return;
    if (playing && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setPlaying(false);
      return;
    }
    playPreview(active);
  };

  // while opened, keep `open` (side info) in sync with the visible centred vinyl
  useEffect(() => {
    if (open && active && open.id !== active.id) setOpen(active);
  }, [active, open]);

  const goPrev = () => {
    autoPlayOnSettleRef.current = true;
    shelfRef.current?.prev();
  };

  const goNext = () => {
    autoPlayOnSettleRef.current = true;
    shelfRef.current?.next();
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-paper">
      {/* loading card — fades out when hydrated */}
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center bg-ink transition-opacity duration-700 ${
          hydrated ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="w-[320px] border border-paper/10">
          <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
            <span>Sistema · v0.1</span>
            <span className="loading-dot">●</span>
          </div>
          <div className="px-5 pt-5 pb-3">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
              Estado
            </div>
            <div className="mt-1.5 text-[14px] text-paper/85">
              Cargando ficheros
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="h-px bg-paper/10 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-paper/40 loading-bar" />
            </div>
          </div>
        </div>
      </div>

      {/* everything else fades IN when hydrated */}
      <div
        className={`transition-opacity duration-700 ${
          hydrated ? "opacity-100" : "opacity-0"
        }`}
      >
      {vinilos.length > 0 && (
        <VinylShelf ref={shelfRef} vinilos={vinilos} onOpen={handleVinylClick} onActiveChange={setActive} />
      )}

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

          {/* edit icon over the cover — appears only once the open animation
              has finished, and on hover */}
          {fullyOpen && (
            <motion.button
              onClick={handleClose}
              initial={{ opacity: 0, x: "-50%", y: -4 }}
              animate={{ opacity: 1, x: "-50%", y: 0 }}
              transition={{ duration: 0.4 }}
              aria-label="Cerrar"
              className="absolute left-1/2 top-[78%] z-20 flex h-6 w-6 items-center justify-center text-paper/50 hover:text-paper transition"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
              </svg>
            </motion.button>
          )}
          {fullyOpen && (
            <VinylEditOverlay
              vinyl={open}
              collections={collections}
              activeCollectionId={activeCollectionId}
              isInWishlist={activeCollectionId === WISHLIST_ID}
              onAddTo={(cid) => handleAddVinylTo(cid, open.id)}
              onMoveToCollection={() => {
                handleAddVinylTo(DEFAULT_ID, open.id); // mutex handler removes it from wishlist
              }}
              onRemoveFromActive={() => {
                handleRemoveVinylFromActive(open.id);
                handleClose();
              }}
              onDeletePermanently={() => {
                handleDeleteVinylPermanently(open.id);
                handleClose();
              }}
            />
          )}
        </>
      )}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-8 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="RackrClub" className="h-5 w-auto opacity-80" />
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="group flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-paper/60 hover:text-paper transition"
            aria-label="Buscar"
          >
            <kbd className="mono inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[3px] border border-paper/25 text-[11px] text-paper/60 normal-case tracking-normal group-hover:border-paper/60 group-hover:text-paper transition">
              /
            </kbd>
            <span>Buscar</span>
          </button>
        </div>
      </div>

      {/* active title — moves up + shrinks when a vinyl is opened so it never
          overlaps the centred cover */}
      {active && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center text-center transition-all ease-out ${
            open
              ? "top-[10%] duration-500"
              : "top-[18%] duration-[1600ms] delay-[1800ms]"
          }`}
        >
          <div className="px-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-paper/50">
              {active.genre} · {active.year}
            </div>
            <h1
              className={`mt-2 font-medium leading-none text-paper transition-all ease-out ${
                open
                  ? "text-2xl md:text-3xl duration-500"
                  : "text-4xl md:text-5xl duration-[1600ms] delay-[1800ms]"
              }`}
            >
              {active.title}
            </h1>
            {!open && (
              <div className="mt-2 text-[13px] text-paper/60">{active.artist}</div>
            )}
          </div>
        </div>
      )}

      {/* subtle bottom gradient to improve readability of the bottom UI */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-ink via-ink/60 to-transparent" />

      {/* bottom-left: collection name + switcher */}
      <div className="absolute bottom-0 left-0 z-20 px-8 py-6">
        <div className="flex items-center gap-3">
          {collections.length > 1 && (
            <button
              onClick={() => {
                const idx = collections.findIndex((c) => c.id === activeCollectionId);
                const next = collections[(idx + 1) % collections.length];
                handleActivateCollection(next.id);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-paper/30 text-paper/70 hover:text-paper hover:border-paper/60 transition"
              aria-label="Siguiente colección"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2 L3 8 M1 4 L3 2 L5 4 M7 8 L7 2 M5 6 L7 8 L9 6" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
          )}
          <div className="text-left">
            <div className="text-[20px] font-medium leading-none">
              {activeCollection?.name ?? "Mi Colección"}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-paper/50">
              {vinilos.length} discos ·{" "}
              <button
                onClick={() => setCollectionsOpen(true)}
                className="text-paper/70 hover:text-paper transition underline-offset-2 hover:underline"
              >
                Listas
              </button>
            </div>
          </div>
        </div>
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
            disabled={!active?.previewUrl}
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
      {active && (
        <div className="pointer-events-none absolute bottom-0 right-0 z-20 px-8 py-6">
          <div className="flex items-center gap-3 text-right">
            <div className="max-w-[320px]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-paper/50">
                Ahora viendo
              </div>
              <MarqueeText className="mt-1 font-medium text-[15px]">{active.title}</MarqueeText>
            </div>
            <MiniVinyl coverUrl={coverFor(active)} />
          </div>
        </div>
      )}

      {/* empty state — archive card aesthetic */}
      {vinilos.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-[420px] max-w-[90vw] border border-paper/10 bg-ink/40 backdrop-blur-sm">
            {/* top stamp row */}
            <div className="flex items-center justify-between border-b border-paper/10 px-5 py-2 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
              <span>Ficha · 000</span>
              <span>Vacía</span>
            </div>
            {/* body */}
            <div className="px-7 pt-7 pb-6">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
                Estado
              </div>
              <div className="mt-1.5 text-[15px] text-paper/90">
                Tu colección no tiene vinilos
              </div>

              <div className="mt-5 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
                Siguiente paso
              </div>
              <div className="mt-1.5 text-[13px] text-paper/55 leading-relaxed">
                Añade el primer disco desde el buscador. Se descargará su portada
                y un preview de audio cuando estén disponibles.
              </div>
            </div>
            {/* footer action */}
            <div className="flex items-stretch border-t border-paper/10">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex-1 px-5 py-3 text-left text-[14px] text-paper hover:bg-paper/[0.04] transition flex items-center justify-between"
              >
                <span>Buscar vinilos</span>
                <span className="text-paper/40">→</span>
              </button>
              <div className="px-5 py-3 mono text-[10px] uppercase tracking-[0.22em] text-paper/30 border-l border-paper/10 flex items-center">
                Tecla /
              </div>
            </div>
          </div>
        </div>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        localVinilos={vinilos}
        onJumpTo={(v) => {
          const idx = vinilos.findIndex((x) => x.id === v.id);
          if (idx >= 0) shelfRef.current?.goTo(idx);
        }}
        onAdded={(v, target) => {
          // add to master list
          setAllVinilos((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]));
          // pick destination: wishlist or active collection (defaulting to
          // Mi Colección when the user is currently viewing the wishlist)
          const destId =
            target === "wishlist"
              ? WISHLIST_ID
              : activeCollectionId === WISHLIST_ID
              ? DEFAULT_ID
              : activeCollectionId;
          handleAddVinylTo(destId, v.id);
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
        onDeleteVinyl={handleDeleteVinylPermanently}
        onSetSort={handleSetSort}
        onReorder={handleReorderVinyl}
        allVinilos={allVinilos}
      />
      </div>
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

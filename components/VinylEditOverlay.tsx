"use client";

import { useState, useRef, useEffect } from "react";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";

type Props = {
  vinyl: Vinyl;
  collections: Collection[];
  activeCollectionId: string;
  onAddTo: (collectionId: string) => void;
  onRemoveFromActive: () => void;
  onDeletePermanently: () => void;
};

/**
 * Edit affordance that sits over the centred (opened) cover: a small pencil
 * icon in the top-right corner of the cover area that fades in on hover.
 * Clicking it opens a popover with the vinyl actions.
 */
export default function VinylEditOverlay({
  vinyl,
  collections,
  activeCollectionId,
  onAddTo,
  onRemoveFromActive,
  onDeletePermanently,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // close popover on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowAddMenu(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // reset state when changing vinyl
  useEffect(() => {
    setMenuOpen(false);
    setShowAddMenu(false);
    setConfirmDelete(false);
  }, [vinyl.id]);

  const otherCollections = collections.filter(
    (c) => c.id !== activeCollectionId && !c.vinylIds.includes(vinyl.id),
  );

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 group"
      // sized to roughly the visible cover when opened (aspect-aware)
      style={{ width: "min(36vw, 50vh)", height: "min(36vw, 50vh)" }}
    >
      {/* hover sensor — covers the whole cover area */}
      <div className="pointer-events-auto absolute inset-0" />

      <div ref={wrapperRef} className="pointer-events-auto absolute top-3 right-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 backdrop-blur-sm border border-paper/20 text-paper/70 hover:text-paper hover:border-paper/60 transition-opacity ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Editar vinilo"
        >
          {/* pencil icon */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 1 L11 4 L4 11 L1 11 L1 8 Z" stroke="currentColor" fill="none" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute top-9 right-0 min-w-[200px] bg-ink/95 backdrop-blur-sm border border-paper/10 rounded-sm shadow-lg p-1 text-[12px]">
            <div className="relative">
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                disabled={otherCollections.length === 0}
                className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-sm disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-between gap-2"
              >
                <span>Añadir a otra colección</span>
                <span className="text-paper/40">›</span>
              </button>
              {showAddMenu && otherCollections.length > 0 && (
                <div className="absolute right-full top-0 mr-1 min-w-[180px] bg-ink/95 backdrop-blur-sm border border-paper/10 rounded-sm shadow-lg p-1">
                  {otherCollections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onAddTo(c.id);
                        setShowAddMenu(false);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-sm"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                onRemoveFromActive();
                setMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-sm"
            >
              Quitar de esta colección
            </button>
            <div className="h-px bg-paper/10 my-1" />
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-2 text-paper/50 hover:bg-red-500/10 hover:text-red-400 rounded-sm"
              >
                Eliminar permanentemente
              </button>
            ) : (
              <div className="px-3 py-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    onDeletePermanently();
                    setMenuOpen(false);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-paper/40 hover:text-paper"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

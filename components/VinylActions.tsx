"use client";

import { useState } from "react";
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

export default function VinylActions({
  vinyl,
  collections,
  activeCollectionId,
  onAddTo,
  onRemoveFromActive,
  onDeletePermanently,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const otherCollections = collections.filter(
    (c) => c.id !== activeCollectionId && !c.vinylIds.includes(vinyl.id),
  );

  return (
    <div className="pointer-events-auto flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-paper/50">
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="hover:text-paper transition"
          disabled={otherCollections.length === 0}
        >
          {otherCollections.length === 0 ? "En todas las colecciones" : "Añadir a…"}
        </button>
        {showAddMenu && otherCollections.length > 0 && (
          <div className="absolute left-0 top-5 z-30 min-w-[160px] bg-ink/95 border border-paper/10 rounded-sm shadow-lg p-1">
            {otherCollections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onAddTo(c.id);
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-[12px] text-paper/80 hover:bg-paper/5 hover:text-paper rounded-sm normal-case tracking-normal"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onRemoveFromActive}
        className="text-left hover:text-paper transition"
      >
        Quitar de esta colección
      </button>
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-left text-paper/35 hover:text-red-400 transition"
        >
          Eliminar permanentemente
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={onDeletePermanently}
            className="text-red-400 hover:text-red-300 transition"
          >
            Confirmar
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-paper/40 hover:text-paper transition"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

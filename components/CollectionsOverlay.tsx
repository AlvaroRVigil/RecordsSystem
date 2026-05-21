"use client";

import { useState } from "react";
import type { Collection } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  activeId: string;
  onActivate: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleVinyl: (collectionId: string, vinylId: string) => void;
  allVinilos: Vinyl[];
};

export default function CollectionsOverlay({
  open,
  onClose,
  collections,
  activeId,
  onActivate,
  onCreate,
  onRename,
  onDelete,
  onToggleVinyl,
  allVinilos,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  if (!open) return null;

  const editing = editId ? collections.find((c) => c.id === editId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-[10vh]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-[680px] mx-6 bg-ink/95 border border-paper/10 rounded-md p-6 max-h-[80vh] overflow-y-auto">
        {!editing ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif italic text-2xl">Colecciones</h2>
              <button
                onClick={onClose}
                className="text-paper/40 hover:text-paper text-xs uppercase tracking-[0.2em]"
              >
                Cerrar
              </button>
            </div>

            <ul className="divide-y divide-paper/10">
              {collections.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <button
                      onClick={() => {
                        onActivate(c.id);
                        onClose();
                      }}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isActive ? "bg-paper" : "bg-paper/20"
                        }`}
                      />
                      <span className={`text-[15px] ${isActive ? "text-paper" : "text-paper/70"}`}>
                        {c.name}
                      </span>
                      <span className="text-[11px] text-paper/40">
                        · {c.vinylIds.length} discos
                      </span>
                    </button>
                    <button
                      onClick={() => setEditId(c.id)}
                      className="text-[11px] uppercase tracking-[0.18em] text-paper/50 hover:text-paper transition"
                    >
                      Editar
                    </button>
                    {collections.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Eliminar "${c.name}"?`)) onDelete(c.id);
                        }}
                        className="text-[11px] uppercase tracking-[0.18em] text-paper/30 hover:text-red-400 transition"
                      >
                        Borrar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex items-center gap-2 border-t border-paper/10 pt-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    onCreate(newName.trim());
                    setNewName("");
                  }
                }}
                placeholder="Nombre de la nueva colección"
                className="flex-1 bg-transparent border-b border-paper/20 py-2 text-sm outline-none placeholder:text-paper/30"
              />
              <button
                onClick={() => {
                  if (newName.trim()) {
                    onCreate(newName.trim());
                    setNewName("");
                  }
                }}
                disabled={!newName.trim()}
                className="text-[11px] uppercase tracking-[0.18em] text-paper/70 hover:text-paper transition disabled:opacity-30"
              >
                Crear
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5 gap-3">
              <button
                onClick={() => setEditId(null)}
                className="text-[11px] uppercase tracking-[0.2em] text-paper/50 hover:text-paper transition"
              >
                ← Volver
              </button>
              <input
                defaultValue={editing.name}
                onBlur={(e) => onRename(editing.id, e.target.value.trim() || editing.name)}
                className="flex-1 bg-transparent border-b border-paper/20 py-1 text-lg outline-none"
              />
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-paper/40 mb-3">
              Vinilos en esta colección — {editing.vinylIds.length} / {allVinilos.length}
            </div>
            <ul className="grid grid-cols-2 gap-1 max-h-[50vh] overflow-y-auto pr-2">
              {allVinilos.map((v) => {
                const inCol = editing.vinylIds.includes(v.id);
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => onToggleVinyl(editing.id, v.id)}
                      className={`w-full flex items-center gap-2 py-1.5 px-2 text-left rounded text-[12px] transition ${
                        inCol
                          ? "bg-paper/10 text-paper"
                          : "text-paper/50 hover:bg-paper/5"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          inCol ? "bg-paper" : "border border-paper/30"
                        }`}
                      />
                      <span className="truncate">
                        {v.artist} — {v.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

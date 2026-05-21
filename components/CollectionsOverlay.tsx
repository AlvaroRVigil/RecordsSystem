"use client";

import { useEffect, useMemo, useState } from "react";
import { type Collection, type SortMode, SORT_LABELS, sortedVinylIds, DEFAULT_ID, WISHLIST_ID } from "@/lib/collections";

const isPrimaryId = (id: string) => id === DEFAULT_ID || id === WISHLIST_ID;
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
  onDeleteVinyl: (vinylId: string) => void;
  onSetSort: (collectionId: string, sortBy: SortMode) => void;
  onReorder: (collectionId: string, fromIdx: number, toIdx: number) => void;
  allVinilos: Vinyl[];
};

function vinylsOf(c: Collection, all: Vinyl[]) {
  return c.vinylIds
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
}

function statsFor(c: Collection, all: Vinyl[]) {
  const vs = vinylsOf(c, all);
  if (vs.length === 0) {
    return { count: 0, last: null as Vinyl | null, topGenre: null, decades: null, artists: 0 };
  }
  const last = vs[vs.length - 1];
  const genreCount = new Map<string, number>();
  vs.forEach((v) => {
    if (v.genre) genreCount.set(v.genre, (genreCount.get(v.genre) ?? 0) + 1);
  });
  const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const years = vs.map((v) => v.year).filter((y) => y && y > 1900);
  const minY = years.length ? Math.min(...years) : null;
  const maxY = years.length ? Math.max(...years) : null;
  const decades =
    minY && maxY
      ? minY === maxY
        ? `${minY}`
        : `${Math.floor(minY / 10) * 10}s – ${Math.floor(maxY / 10) * 10}s`
      : null;
  const artists = new Set(vs.map((v) => v.artist)).size;
  return { count: vs.length, last, topGenre, decades, artists };
}

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
  onDeleteVinyl,
  onSetSort,
  onReorder,
  allVinilos,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setNewName("");
      setRenaming(false);
    }
  }, [open]);

  const editing = editId ? collections.find((c) => c.id === editId) : null;
  const active = collections.find((c) => c.id === activeId);
  const others = collections.filter((c) => c.id !== activeId);
  const activeStats = useMemo(
    () => (active ? statsFor(active, allVinilos) : null),
    [active, allVinilos],
  );

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-500 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-full max-w-[380px] bg-[#0a0a0a] text-paper border-r border-paper/[0.04] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <header className="flex items-center justify-between px-6 pt-6 pb-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
              {editing ? "Editar lista" : "Listas"}
            </span>
            <button
              onClick={editing ? () => setEditId(null) : onClose}
              className="text-[11px] uppercase tracking-[0.2em] text-paper/40 hover:text-paper transition"
            >
              {editing ? "← Atrás" : "Cerrar"}
            </button>
          </header>

          {editing ? (
            <EditPanel
              editing={
                isPrimaryId(editing.id)
                  ? { ...editing, vinylIds: allVinilos.map((v) => v.id) }
                  : editing
              }
              allVinilos={allVinilos}
              isPrimary={isPrimaryId(editing.id)}
              onRename={onRename}
              onToggleVinyl={onToggleVinyl}
              onDeleteVinyl={onDeleteVinyl}
              onSetSort={onSetSort}
              onReorder={onReorder}
            />
          ) : (
            <div data-scrollable className="flex-1 overflow-y-auto">
              {active && (
                <section className="px-6">
                  {/* title */}
                  {renaming ? (
                    <input
                      autoFocus
                      defaultValue={active.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== active.name) onRename(active.id, v);
                        setRenaming(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenaming(false);
                      }}
                      className="w-full bg-transparent border-b border-paper/20 py-1 text-[22px] font-medium text-paper outline-none focus:border-paper/60"
                    />
                  ) : (
                    <h2 className="text-[22px] font-medium leading-tight tracking-tight flex items-center gap-2">
                      {active.name}
                      {isPrimaryId(active.id) && (
                        <span className="text-paper/30 mt-1" title="Lista predefinida">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" stroke="currentColor" />
                            <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
                          </svg>
                        </span>
                      )}
                    </h2>
                  )}

                  {activeStats && activeStats.count > 0 && (
                    <p className="mt-2 text-[12px] text-paper/45">
                      {activeStats.count} discos · {activeStats.artists} artistas
                    </p>
                  )}

                  {/* metadata table (Are.na style) */}
                  {activeStats && activeStats.count > 0 && (
                    <dl className="mt-5 text-[13px]">
                      <Row label="Discos" value={String(activeStats.count)} />
                      {activeStats.last && (
                        <Row label="Última inc." value={activeStats.last.title} />
                      )}
                      {activeStats.topGenre && (
                        <Row
                          label="Top género"
                          value={`${activeStats.topGenre[0]} · ${activeStats.topGenre[1]}`}
                        />
                      )}
                      {activeStats.decades && (
                        <Row label="Décadas" value={activeStats.decades} />
                      )}
                    </dl>
                  )}

                  {/* action row */}
                  <div className="mt-5 flex items-center gap-2 rounded-md border border-paper/[0.06] p-2">
                    <button
                      onClick={() => setEditId(active.id)}
                      className="flex-1 text-[12px] py-1.5 px-3 rounded-sm bg-paper/5 hover:bg-paper/10 text-paper transition"
                    >
                      Editar discos →
                    </button>
                    {!isPrimaryId(active.id) && (
                      <button
                        onClick={() => setRenaming(true)}
                        className="text-[12px] py-1.5 px-3 rounded-sm hover:bg-paper/5 text-paper/70 hover:text-paper transition"
                      >
                        Renombrar
                      </button>
                    )}
                    {collections.length > 1 && !isPrimaryId(active.id) && (
                      <button
                        onClick={() => {
                          if (confirm(`Eliminar "${active.name}"?`)) onDelete(active.id);
                        }}
                        className="text-[12px] py-1.5 px-3 rounded-sm hover:bg-red-500/10 text-paper/35 hover:text-red-400 transition"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* divider section */}
              <div className="mt-7 px-6 pb-3 border-b border-paper/[0.04]">
                <span className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
                  Otras listas {others.length > 0 && `· ${others.length}`}
                </span>
              </div>

              {/* other lists — primary lists first, then a hairline, then custom */}
              {(() => {
                const renderRow = (c: Collection) => {
                  const s = statsFor(c, allVinilos);
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        onClick={() => onActivate(c.id)}
                        className="w-full flex items-center px-4 py-3 rounded-md bg-paper/[0.04] hover:bg-paper/8 transition text-left"
                      >
                        <span className="flex-1 text-[14px] text-paper truncate pr-12">
                          {c.name}
                        </span>
                        <span className="text-[12px] text-paper/40 ml-3">
                          {s.count} discos
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivate(c.id);
                          setEditId(c.id);
                        }}
                        aria-label="Editar lista"
                        className="absolute right-[88px] top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-paper/30 hover:text-paper transition opacity-0 group-hover:opacity-100"
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M8 1 L11 4 L4 11 L1 11 L1 8 Z" stroke="currentColor" fill="none" />
                        </svg>
                      </button>
                    </li>
                  );
                };
                const primaries = others.filter((c) => isPrimaryId(c.id));
                const customs = others.filter((c) => !isPrimaryId(c.id));
                return (
                  <>
                    {primaries.length > 0 && (
                      <ul className="px-3 pt-3 space-y-2">{primaries.map(renderRow)}</ul>
                    )}
                    {primaries.length > 0 && customs.length > 0 && (
                      <div className="mx-7 my-3 h-px bg-paper/[0.06]" />
                    )}
                    {customs.length > 0 && (
                      <ul className="px-3 pb-3 space-y-2">{customs.map(renderRow)}</ul>
                    )}
                    {others.length === 0 && (
                      <ul className="px-3 py-3">
                        <li className="px-4 py-3 text-[12px] text-paper/35">
                          No tienes otras listas aún
                        </li>
                      </ul>
                    )}
                  </>
                );
              })()}

              {/* create new — sticky footer-ish */}
              <div className="px-6 py-4 mt-2 border-t border-paper/[0.04]">
                <div className="flex items-center gap-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newName.trim()) {
                        onCreate(newName.trim());
                        setNewName("");
                      }
                    }}
                    placeholder="Nueva lista"
                    className="flex-1 bg-transparent border-b border-paper/[0.07] py-1.5 text-[13px] text-paper outline-none placeholder:text-paper/30 focus:border-paper/60 transition"
                  />
                  <button
                    onClick={() => {
                      if (newName.trim()) {
                        onCreate(newName.trim());
                        setNewName("");
                      }
                    }}
                    disabled={!newName.trim()}
                    className="text-[11px] uppercase tracking-[0.18em] text-paper/60 hover:text-paper transition disabled:opacity-25"
                  >
                    Crear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-paper/[0.04] last:border-b-0">
      <dt className="text-paper/40 w-[32%]">{label}</dt>
      <dd className="flex-1 text-right text-paper/85 truncate">{value}</dd>
    </div>
  );
}

function EditPanel({
  editing,
  allVinilos,
  isPrimary,
  onRename,
  onToggleVinyl,
  onDeleteVinyl,
  onSetSort,
  onReorder,
}: {
  editing: Collection;
  allVinilos: Vinyl[];
  isPrimary: boolean;
  onRename: (id: string, name: string) => void;
  onToggleVinyl: (collectionId: string, vinylId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  onSetSort: (collectionId: string, sortBy: SortMode) => void;
  onReorder: (collectionId: string, fromIdx: number, toIdx: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const sortBy = editing.sortBy ?? "custom";

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const matches = (v: Vinyl) =>
    !filter.trim() ||
    norm(`${v.title} ${v.artist}`).includes(norm(filter.trim()));
  const orderedIds = sortedVinylIds(editing, allVinilos);
  const orderedVinilos = orderedIds
    .map((id) => allVinilos.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
  const notInCol = allVinilos.filter((v) => !editing.vinylIds.includes(v.id));

  return (
    <>
      <div className="px-6 pb-3">
        {isPrimary ? (
          <div className="py-1.5 text-[18px] text-paper">{editing.name}</div>
        ) : (
          <input
            defaultValue={editing.name}
            onBlur={(e) => onRename(editing.id, e.target.value.trim() || editing.name)}
            className="w-full bg-transparent border-b border-paper/[0.07] py-1.5 text-[18px] text-paper outline-none focus:border-paper/60 transition"
          />
        )}
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-paper/40">
          {editing.vinylIds.length} discos
        </p>
      </div>

      {/* sort selector */}
      <div className="px-6 pt-1 pb-2 flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-[0.2em] text-paper/40 shrink-0">
          Orden
        </label>
        <select
          value={sortBy}
          onChange={(e) => onSetSort(editing.id, e.target.value as SortMode)}
          className="flex-1 bg-transparent border-b border-paper/[0.07] py-1 text-[13px] text-paper outline-none focus:border-paper/60 transition appearance-none cursor-pointer"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <option key={m} value={m} className="bg-[#0a0a0a]">
              {SORT_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* filter */}
      <div className="px-6 pb-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por artista o álbum…"
          className="w-full bg-transparent border-b border-paper/[0.07] py-1 text-[13px] text-paper outline-none placeholder:text-paper/30 focus:border-paper/60 transition"
        />
      </div>

      <div data-scrollable className="flex-1 overflow-y-auto pb-6">
        {/* items in collection */}
        <div className="px-6 pt-2 pb-2 text-[11px] uppercase tracking-[0.2em] text-paper/40">
          En la lista · {orderedVinilos.length}
        </div>
        <ul className="px-3">
          {orderedVinilos.map((v, idx) => {
            const customIdx = editing.vinylIds.indexOf(v.id);
            const draggable = sortBy === "custom";
            const isDragging = dragIdx === customIdx;
            const isOver = overIdx === customIdx && dragIdx !== null && dragIdx !== customIdx;
            return (
              <li
                key={v.id}
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable) return;
                  setDragIdx(customIdx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragOver={(e) => {
                  if (!draggable || dragIdx === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overIdx !== customIdx) setOverIdx(customIdx);
                }}
                onDrop={(e) => {
                  if (!draggable || dragIdx === null) return;
                  e.preventDefault();
                  if (dragIdx !== customIdx) onReorder(editing.id, dragIdx, customIdx);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-sm transition ${
                  isDragging ? "opacity-30" : "hover:bg-paper/[0.04]"
                } ${isOver ? "bg-paper/[0.08] outline outline-1 outline-paper/20" : ""} ${
                  draggable ? "cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                {sortBy === "custom" && (
                  <span
                    className="text-paper/25 group-hover:text-paper/60 transition leading-none text-[10px] select-none"
                    aria-hidden
                  >
                    ⋮⋮
                  </span>
                )}
                <span className="flex-1 min-w-0 text-[12px] truncate">
                  <span className="text-paper">{v.title}</span>
                  <span className="ml-2 text-paper/40">{v.artist}</span>
                  {v.year ? <span className="ml-2 text-paper/25">{v.year}</span> : null}
                </span>
                <button
                  onClick={() => {
                    if (isPrimary) {
                      // Mi Colección: removing means deleting the vinyl entirely
                      if (confirm(`Eliminar permanentemente "${v.title}"?`)) {
                        onDeleteVinyl(v.id);
                      }
                    } else {
                      // any other list: just take it out of this list
                      onToggleVinyl(editing.id, v.id);
                    }
                  }}
                  className="text-[11px] uppercase tracking-[0.16em] text-paper/30 hover:text-red-400 transition px-2 opacity-0 group-hover:opacity-100"
                  aria-label={isPrimary ? "Eliminar permanentemente" : "Quitar"}
                >
                  {isPrimary ? "Eliminar" : "Quitar"}
                </button>
              </li>
            );
          })}
          {orderedVinilos.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-paper/35">Lista vacía</li>
          )}
        </ul>

        {/* add more */}
        {notInCol.length > 0 && (
          <>
            <div className="mt-6 px-6 pt-2 pb-2 text-[11px] uppercase tracking-[0.2em] text-paper/40 border-t border-paper/[0.04]">
              Añadir discos · {notInCol.length}
            </div>
            <ul className="px-3">
              {notInCol.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => onToggleVinyl(editing.id, v.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] rounded-sm text-paper/55 hover:bg-paper/[0.04] transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full border border-paper/25" />
                    <span className="truncate flex-1">
                      <span className="text-paper">{v.title}</span>
                      <span className="ml-2 text-paper/40">{v.artist}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

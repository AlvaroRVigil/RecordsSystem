export type SortMode =
  | "custom"
  | "added"
  | "year"
  | "artistAZ"
  | "artistZA"
  | "titleAZ"
  | "titleZA";

export const SORT_LABELS: Record<SortMode, string> = {
  custom: "Personalizado",
  added: "Fecha de incorporación",
  year: "Año del álbum",
  artistAZ: "Artista A–Z",
  artistZA: "Artista Z–A",
  titleAZ: "Álbum A–Z",
  titleZA: "Álbum Z–A",
};

export type Collection = {
  id: string;
  name: string;
  vinylIds: string[];
  sortBy?: SortMode;
};

const KEY = "vinilos.collections.v1";
const ACTIVE_KEY = "vinilos.activeCollection";

export const DEFAULT_ID = "default";
export const WISHLIST_ID = "wishlist";
export const PRIMARY_IDS = [DEFAULT_ID, WISHLIST_ID] as const;

const seedCollections = (allIds: string[]): Collection[] => [
  { id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds, sortBy: "custom" },
  { id: WISHLIST_ID, name: "Lista de deseos", vinylIds: [], sortBy: "custom" },
];

export function loadCollections(allIds: string[]): Collection[] {
  if (typeof window === "undefined") return seedCollections(allIds);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Collection[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // ensure the two primary lists always exist
        const out = [...parsed];
        if (!out.some((c) => c.id === DEFAULT_ID)) {
          out.unshift({ id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds, sortBy: "custom" });
        }
        if (!out.some((c) => c.id === WISHLIST_ID)) {
          out.push({ id: WISHLIST_ID, name: "Lista de deseos", vinylIds: [], sortBy: "custom" });
        }
        return out;
      }
    }
  } catch {}
  return seedCollections(allIds);
}

export function saveCollections(cols: Collection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cols));
}

export function loadActiveId(): string {
  if (typeof window === "undefined") return DEFAULT_ID;
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_ID;
}

export function saveActiveId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function newCollection(name: string): Collection {
  return { id: `col-${Date.now()}`, name, vinylIds: [], sortBy: "custom" };
}

import type { Vinyl } from "./types";

export function sortedVinylIds(c: Collection, all: Vinyl[]): string[] {
  const items = c.vinylIds
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
  const sortBy = c.sortBy ?? "custom";
  let out = items;
  if (sortBy === "added") {
    // most recently added first; vinylIds is the insertion order, so reverse it
    out = [...items].reverse();
  } else if (sortBy === "year") {
    out = [...items].sort((a, b) => (a.year || 0) - (b.year || 0));
  } else if (sortBy === "artistAZ") {
    out = [...items].sort((a, b) => a.artist.localeCompare(b.artist));
  } else if (sortBy === "artistZA") {
    out = [...items].sort((a, b) => b.artist.localeCompare(a.artist));
  } else if (sortBy === "titleAZ") {
    out = [...items].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "titleZA") {
    out = [...items].sort((a, b) => b.title.localeCompare(a.title));
  }
  return out.map((v) => v.id);
}

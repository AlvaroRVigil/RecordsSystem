export type Collection = {
  id: string;
  name: string;
  vinylIds: string[];
};

const KEY = "vinilos.collections.v1";
const ACTIVE_KEY = "vinilos.activeCollection";

export const DEFAULT_ID = "default";

export function loadCollections(allIds: string[]): Collection[] {
  if (typeof window === "undefined") {
    return [{ id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds }];
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Collection[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [{ id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds }];
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
  return { id: `col-${Date.now()}`, name, vinylIds: [] };
}

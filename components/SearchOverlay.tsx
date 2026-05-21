"use client";

import { useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";

type SearchResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  genre?: string;
  cover_image?: string;
  thumb?: string;
  format?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (v: Vinyl, target: "collection" | "wishlist") => void;
  localVinilos: Vinyl[];
  onJumpTo: (v: Vinyl) => void;
};

export default function SearchOverlay({ open, onClose, onAdded, localVinilos, onJumpTo }: Props) {
  const [mode, setMode] = useState<"local" | "discogs">("local");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setResults([]);
      setMode("local");
    }
  }, [open]);

  // discogs search only when in "discogs" mode
  useEffect(() => {
    if (mode !== "discogs" || !q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        if (cancelled) return;
        setResults(data.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, mode]);

  // local filter — instant, no network
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const localResults =
    mode === "local" && q.trim()
      ? localVinilos.filter((v) => {
          const t = norm(`${v.title} ${v.artist}`);
          return t.includes(norm(q.trim()));
        })
      : [];

  const add = async (r: SearchResult, target: "collection" | "wishlist") => {
    setAdding(r.id);
    try {
      const res = await fetch(`/api/discogs/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: r.id }),
      });
      const data = await res.json();
      if (data.vinyl) {
        onAdded(data.vinyl, target);
        onClose();
      }
    } finally {
      setAdding(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-[12vh]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-label="close search"
      />
      <div className="relative w-full max-w-[640px] mx-6">
        {/* mode tabs */}
        <div className="flex items-center gap-5 mb-1">
          {(["local", "discogs"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] uppercase tracking-[0.22em] py-2 transition relative ${
                mode === m ? "text-paper" : "text-paper/35 hover:text-paper/70"
              }`}
            >
              {m === "local" ? "Mi biblioteca" : "Añadir vinilos"}
              {mode === m && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-paper" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-b border-paper/20">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === "local" ? "Buscar en tu colección…" : "Buscar vinilos para añadir…"}
            className="flex-1 bg-transparent py-4 text-[18px] text-paper outline-none placeholder:text-paper/30"
          />
          <kbd className="mono inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[3px] border border-paper/20 text-[10px] text-paper/45">
            Esc
          </kbd>
        </div>
        <div data-scrollable className="mt-4 max-h-[60vh] overflow-y-auto">
          {mode === "discogs" && loading && (
            <div className="text-paper/50 text-sm py-3">Buscando…</div>
          )}
          {mode === "discogs" && !loading && results.length === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">Sin resultados</div>
          )}
          {mode === "local" && localResults.length === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">
              Sin coincidencias en tu colección
            </div>
          )}

          {/* local mode list */}
          {mode === "local" && (
            <ul className="divide-y divide-paper/10">
              {localResults.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      onJumpTo(v);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-paper/5 transition px-2"
                  >
                    {v.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.cover} alt="" className="w-12 h-12 object-cover rounded-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-paper/10 rounded-sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-paper/90">{v.title}</div>
                      <div className="mt-0.5 text-[11px] text-paper/50 truncate">
                        {[v.artist, v.year, v.genre].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="text-paper/30 text-lg pr-2">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* discogs add list */}
          <ul className={mode === "discogs" ? "divide-y divide-paper/10" : "hidden"}>
            {results.map((r) => (
              <li key={r.id} className="group flex items-center gap-2">
                <button
                  onClick={() => add(r, "collection")}
                  disabled={adding === r.id}
                  className="flex-1 flex items-center gap-3 py-3 text-left hover:bg-paper/5 transition disabled:opacity-40 px-2"
                  aria-label="Añadir a colección"
                >
                  {r.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumb} alt="" className="w-12 h-12 object-cover rounded-sm" />
                  ) : (
                    <div className="w-12 h-12 bg-paper/10 rounded-sm" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-paper/90">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-paper/50 truncate">
                      {[r.year, r.country, r.label, r.format?.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {adding === r.id && <span className="text-[11px] text-paper/60">añadiendo…</span>}
                </button>
                {/* add to wishlist — visible on hover */}
                <button
                  onClick={() => add(r, "wishlist")}
                  disabled={adding === r.id}
                  aria-label="Añadir a lista de deseos"
                  title="Añadir a lista de deseos"
                  className="shrink-0 h-9 w-9 flex items-center justify-center text-paper/30 hover:text-paper transition opacity-0 group-hover:opacity-100 disabled:opacity-20"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 13.5s-5-3.2-5-7.2A2.8 2.8 0 0 1 8 4.5a2.8 2.8 0 0 1 5 1.8c0 4-5 7.2-5 7.2z"
                      stroke="currentColor"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

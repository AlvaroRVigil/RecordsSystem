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
  onAdded: (v: Vinyl) => void;
};

export default function SearchOverlay({ open, onClose, onAdded }: Props) {
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
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        if (cancelled) return; // a newer search supersedes us
        setResults(data.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  const add = async (r: SearchResult) => {
    setAdding(r.id);
    try {
      const res = await fetch(`/api/discogs/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: r.id }),
      });
      const data = await res.json();
      if (data.vinyl) {
        onAdded(data.vinyl);
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
        <div className="flex items-center gap-3 border-b border-paper/20">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en Discogs…"
            className="flex-1 bg-transparent py-4 text-[18px] text-paper outline-none placeholder:text-paper/30"
          />
          <kbd className="mono inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[3px] border border-paper/20 text-[10px] text-paper/45">
            Esc
          </kbd>
        </div>
        <div data-scrollable className="mt-4 max-h-[60vh] overflow-y-auto">
          {loading && <div className="text-paper/50 text-sm py-3">Buscando…</div>}
          {!loading && results.length === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">Sin resultados</div>
          )}
          <ul className="divide-y divide-paper/10">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => add(r)}
                  disabled={adding === r.id}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-paper/5 transition disabled:opacity-40 px-2"
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
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

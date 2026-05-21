"use client";

import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";
import { useEffect } from "react";

const VinylRecord3D = dynamic(() => import("./VinylRecord3D"), { ssr: false });

type Props = {
  vinyl: Vinyl | null;
  onClose: () => void;
};

export default function VinylDetail({ vinyl, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {vinyl && (
        <motion.div
          className="fixed inset-0 z-[300] bg-ink/95 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-xs uppercase tracking-[0.18em] text-paper/70 hover:text-paper"
          >
            Cerrar [esc]
          </button>

          <div className="grid h-full grid-cols-1 gap-8 px-6 py-16 md:grid-cols-[1fr_1fr] md:px-16">
            {/* 3D disc, big */}
            <motion.div
              layoutId={`disc-${vinyl.id}`}
              className="relative flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="aspect-square w-full max-w-[560px]">
                <VinylRecord3D
                  coverUrl={coverFor(vinyl)}
                  spinning
                  rpm={33}
                  protrude={0.4}
                />
              </div>
            </motion.div>

            {/* info */}
            <motion.div
              className="flex flex-col justify-center"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-paper/50">
                {vinyl.genre} · {vinyl.year} · {vinyl.country}
              </div>
              <h2 className="mt-3 font-serif text-5xl italic leading-[1.05] md:text-6xl">
                {vinyl.title}
              </h2>
              <div className="mt-2 text-paper/70">{vinyl.artist}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-paper/40">
                {vinyl.label}
              </div>

              <div className="mt-10 max-h-[40vh] overflow-y-auto pr-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-paper/40">
                  Tracklist
                </div>
                <ul className="mt-3 divide-y divide-paper/10">
                  {vinyl.tracklist.map((t, i) => (
                    <motion.li
                      key={`${t.position}-${t.title}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.025 }}
                      className="flex items-baseline gap-4 py-2 text-sm"
                    >
                      <span className="w-8 text-paper/40 tabular-nums">
                        {t.position}
                      </span>
                      <span className="flex-1">{t.title}</span>
                      <span className="text-paper/40 tabular-nums">
                        {t.duration}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

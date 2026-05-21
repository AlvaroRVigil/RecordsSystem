"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";

const VinylRecord3D = dynamic(() => import("./VinylRecord3D"), { ssr: false });

type Props = {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
};

/**
 * LE MA-inspired stacked layout: sleeves overlap vertically, the hovered one
 * lifts and shows a 3D vinyl sliding out of its right edge.
 */
export default function VinylStack({ vinilos, onOpen }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = vinilos.length;

  const focused = hovered != null ? vinilos[hovered] : null;

  return (
    <div className="relative w-full">
      {/* meta columns */}
      <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 hidden md:block">
        <div className="text-xs uppercase tracking-[0.18em] text-paper/50">
          {focused ? focused.genre : "Géneros"}
        </div>
        <div className="mt-2 font-serif text-3xl italic text-paper/90">
          {focused ? focused.artist : "Various"}
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 hidden md:block text-right">
        <div className="text-xs uppercase tracking-[0.18em] text-paper/50">
          {focused ? focused.year : "Catálogo"}
        </div>
        <div className="mt-2 font-serif text-3xl italic text-paper/90">
          {focused ? focused.label : `${total} discos`}
        </div>
      </div>

      {/* the stack */}
      <div
        className="relative mx-auto"
        style={{ width: "min(420px, 80vw)", height: "min(620px, 80vh)" }}
        onMouseLeave={() => setHovered(null)}
      >
        {vinilos.map((v, i) => {
          const isHovered = hovered === i;
          const isAfterHovered = hovered != null && i > hovered;
          const baseOffset = i * 38; // tight stack
          const expandedShift = isHovered ? -8 : isAfterHovered ? 220 : 0;
          const z = isHovered ? 100 : i;

          return (
            <motion.button
              key={v.id}
              onHoverStart={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onClick={() => onOpen(v)}
              className="absolute left-1/2 top-0 -translate-x-1/2 outline-none"
              style={{ zIndex: z }}
              initial={false}
              animate={{
                y: baseOffset + expandedShift,
                scale: isHovered ? 1.04 : 1,
                rotate: isHovered ? 0 : (i % 2 === 0 ? -0.4 : 0.4),
              }}
              transition={{ type: "spring", stiffness: 240, damping: 28, mass: 0.6 }}
              aria-label={`${v.artist} — ${v.title}`}
            >
              <Sleeve vinyl={v} active={isHovered} />
            </motion.button>
          );
        })}
      </div>

      {/* 3D disc that slides out of the active sleeve */}
      <AnimatePresence>
        {focused && (
          <motion.div
            key={focused.id}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              width: "min(360px, 70vw)",
              height: "min(360px, 70vw)",
              transform: "translate(0, -45%)",
              marginLeft: "min(60px, 8vw)",
              zIndex: 200,
            }}
          >
            <VinylRecord3D
              coverUrl={coverFor(focused)}
              spinning
              rpm={28}
              protrude={1}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sleeve({ vinyl, active }: { vinyl: Vinyl; active: boolean }) {
  const cover = coverFor(vinyl);
  return (
    <div
      className="relative overflow-hidden bg-neutral-900 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]"
      style={{
        width: "min(360px, 75vw)",
        height: "min(360px, 75vw)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={`${vinyl.artist} — ${vinyl.title}`}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4"
        initial={false}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 12 }}
        transition={{ duration: 0.25 }}
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))",
        }}
      >
        <div className="text-paper">
          <div className="text-[11px] uppercase tracking-[0.16em] opacity-70">
            {vinyl.artist}
          </div>
          <div className="font-serif text-2xl italic leading-tight">
            {vinyl.title}
          </div>
        </div>
        <div className="text-paper/70 text-xs">{vinyl.year}</div>
      </motion.div>
    </div>
  );
}

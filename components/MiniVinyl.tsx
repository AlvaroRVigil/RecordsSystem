"use client";

import { motion } from "framer-motion";

/** Tiny spinning vinyl used as a now-viewing indicator. */
export default function MiniVinyl({ coverUrl, size = 56 }: { coverUrl: string; size?: number }) {
  return (
    <motion.div
      className="relative shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    >
      {/* disc */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "repeating-radial-gradient(circle at center, #0a0a0a 0px, #383131 1px, #1a1a1a 2px, #272626 3px)",
        }}
      />
      {/* label */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
        style={{ width: size * 0.42, height: size * 0.42 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      </div>
      {/* spindle */}
      <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
    </motion.div>
  );
}

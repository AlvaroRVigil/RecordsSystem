"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  children: string;
  className?: string;
  /** ms per pixel of scroll travel */
  speed?: number;
};

/**
 * Spotify-style marquee: scrolls horizontally only when the text overflows
 * its container. Soft gradient fade on both edges via mask-image so the
 * scrolling text dissolves cleanly into the background.
 */
export default function MarqueeText({ children, className, speed = 60 }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const overflow = inner.scrollWidth > outer.clientWidth + 1;
      setOverflows(overflow);
      if (overflow) {
        // total travel is the inner width + a gap; tweak via speed
        setDuration((inner.scrollWidth + 40) / 1000 * speed);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children, speed]);

  return (
    <div
      ref={outerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={
        overflows
          ? {
              maskImage:
                "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
            }
          : undefined
      }
    >
      {overflows ? (
        <div className="flex whitespace-nowrap will-change-transform" style={{ animation: `marquee ${duration}s linear infinite` }}>
          <span ref={innerRef} className="pr-10">{children}</span>
          <span className="pr-10" aria-hidden>{children}</span>
        </div>
      ) : (
        <span ref={innerRef} className="block whitespace-nowrap">{children}</span>
      )}
    </div>
  );
}

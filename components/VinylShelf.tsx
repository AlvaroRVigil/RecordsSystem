"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import VinylBox from "./VinylBox";

type Props = {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  onActiveChange?: (v: Vinyl) => void;
};

const ITEM_W = 560;
const THICKNESS = 100;
const PERSPECTIVE = 2200;

/**
 * Horizontal ring of 3D vinyl boxes. Each box is rotated so its right side
 * face points to the ring centre. Scroll / drag rotates the ring; the box
 * closest to the camera is the active one.
 *
 * Per-item transform: rotateY(theta) translateZ(radius) rotateY(90deg)
 *   - rotateY(theta): place around the ring
 *   - translateZ(radius): push out along the ring's radial axis
 *   - rotateY(90deg): re-orient so the box's local +X (right side) ends up
 *     pointing back toward the ring centre.
 */
export default function VinylShelf({ vinilos, onOpen, onActiveChange }: Props) {
  const N = vinilos.length;
  const anglePerItem = 360 / N;
  // ring radius so adjacent items leave breathing room.
  // chord between neighbours = 2 R sin(angle/2). We want chord ≥ THICKNESS * 6
  // (each item has thickness THICKNESS poking radially inward+outward).
  // pack items tightly: chord between centres ≈ 0.55 * ITEM_W → covers
  // overlap heavily on the visible arc (accordion fold look from the refe)
  const radius = Math.round(
    (ITEM_W * 0.55) / (2 * Math.sin((Math.PI * anglePerItem) / 360)),
  );

  // unbounded rotation angle (degrees); snaps to multiples of anglePerItem
  const target = useMotionValue(0);
  const rotation = useSpring(target, { stiffness: 110, damping: 22, mass: 0.7 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // wheel rotates the ring
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target.set(target.get() + delta * 0.25);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [target]);

  // drag to spin
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0;
    let startRot = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = false;
      startX = e.clientX;
      startRot = target.get();
      try { el.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      target.set(startRot - dx * 0.4);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      const snapped = Math.round(target.get() / anglePerItem) * anglePerItem;
      target.set(snapped);
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (moved) {
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", stop, true);
        };
        window.addEventListener("click", stop, true);
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [target, anglePerItem]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") target.set(target.get() + anglePerItem);
      else if (e.key === "ArrowLeft") target.set(target.get() - anglePerItem);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, anglePerItem]);

  // active index based on which item is at the camera-near position
  useEffect(() => {
    return rotation.on("change", (deg) => {
      const idx = ((Math.round(deg / anglePerItem) % N) + N) % N;
      setActive((prev) => (prev === idx ? prev : idx));
    });
  }, [rotation, anglePerItem, N]);

  useEffect(() => {
    onActiveChange?.(vinilos[active]);
  }, [active, vinilos, onActiveChange]);

  // outer ring transform: pull ring centre behind the screen plane and rotate
  const ringTransform = useTransform(
    rotation,
    (deg) => `translateZ(${-radius}px) rotateY(${-deg}deg)`,
  );

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden select-none touch-none"
      style={{ perspective: `${PERSPECTIVE}px`, cursor: "grab" }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{
          transformStyle: "preserve-3d",
          transform: ringTransform,
        }}
      >
        {vinilos.map((v, i) => {
          const theta = i * anglePerItem;
          return (
            <RingBox
              key={v.id}
              vinyl={v}
              theta={theta}
              radius={radius}
              rotation={rotation}
              isActive={i === active}
              onClick={() => onOpen(v)}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

function RingBox({
  vinyl,
  theta,
  radius,
  rotation,
  isActive,
  onClick,
}: {
  vinyl: Vinyl;
  theta: number;
  radius: number;
  rotation: ReturnType<typeof useSpring>;
  isActive: boolean;
  onClick: () => void;
}) {
  // angle from the camera's gaze axis, in degrees, in [-180, 180]
  const phi = useTransform(rotation, (deg) => {
    let a = (theta - deg) % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
  });

  // hide the back hemisphere; fade as items rotate behind
  const opacity = useTransform(phi, (a) => {
    const t = Math.abs(a) / 180; // 0 front, 1 back
    if (t > 0.55) return 0;
    return 1 - Math.pow(t / 0.55, 1.4) * 0.65;
  });

  // soft darkening + blur as items rotate away
  const filter = useTransform(phi, (a) => {
    const t = Math.min(1, Math.abs(a) / 90);
    return `blur(${t * 1.2}px) brightness(${1 - t * 0.35})`;
  });

  // place at theta on a ring of `radius`, then rotate so the box's right
  // side faces the ring centre. Viewers outside the ring see the LEFT spine
  // of each item, with the front cover at an angle — like flipping through
  // a circular record crate from the outside.
  const itemTransform = `rotateY(${theta}deg) translateZ(${radius}px) rotateY(90deg)`;

  return (
    <motion.div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="absolute outline-none"
      style={{
        left: -ITEM_W / 2,
        top: -ITEM_W / 2,
        width: ITEM_W,
        height: ITEM_W,
        transformStyle: "preserve-3d",
        transform: itemTransform,
        opacity,
        filter,
        cursor: "pointer",
      }}
      aria-label={`${vinyl.artist} — ${vinyl.title}`}
    >
      <VinylBox vinyl={vinyl} size={ITEM_W} thickness={THICKNESS} />
    </motion.div>
  );
}

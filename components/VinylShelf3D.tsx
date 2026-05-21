"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useControls } from "leva";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";

// ---------------- easing helpers ----------------
const EASINGS = {
  linear: (x: number) => x,
  easeInCubic: (x: number) => x * x * x,
  easeOutCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  easeInOutCubic: (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  easeOutQuart: (x: number) => 1 - Math.pow(1 - x, 4),
  easeOutQuint: (x: number) => 1 - Math.pow(1 - x, 5),
  easeInOutQuart: (x: number) =>
    x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
  easeOutBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
} as const;
type EasingName = keyof typeof EASINGS;

type Props = {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  onActiveChange?: (v: Vinyl) => void;
};

export type VinylShelfHandle = {
  goTo: (idx: number) => void;
  next: () => void;
  prev: () => void;
  open: (idx: number) => void;
  close: () => void;
};

const SLEEVE_W = 3;
const SLEEVE_H = 3;

const VinylShelf3D = forwardRef<VinylShelfHandle, Props>(function VinylShelf3D(
  { vinilos, onOpen, onActiveChange },
  ref,
) {
  // animation tuning (fixed)
  const tuning = {
    openDuration: 2400,
    moveSplit: 0.45,
    flipOverlap: 0.4, // start the flip much earlier — overlaps most of the lift
    hoverSpring: 0.09,
    hoverLift: 0.08,
  };
  const moveEasing: EasingName = "easeInOutQuart";
  const flipEasing: EasingName = "easeInOutCubic";

  // fixed visual params
  const zoom = 8;
  const camX = 0;
  const camY = 0.3;
  const lights = {
    ambient: 1.6,
    light1X: 2,
    light1Y: 0,
    light1Z: 14,
    light1Intensity: 4,
    light2X: -2,
    light2Y: 0,
    light2Z: 14,
    light2Intensity: 4,
  };
  const fov = 28;
  const stripY = -1.1;
  const spacing = 0.45;
  const visibleX = 6;
  const fanStrength = 0.08;
  const maxOpen = 1.3;
  const fogNear = 6;
  const fogFar = 11;
  // glossier than the cardboard sides so light catches highlights on the cover
  const coverRoughness = 0.35;
  const coverMetalness = 0.05;
  const cardboardRoughness = 0.9;
  const thickness = 0.03;

  // scroll target in INDEX space (floating-point). At t=0, item 0 is at x=0.
  const target = useRef(0);
  const current = useRef(0);
  const [active, setActive] = useState(0);
  // open state — 0 = closed (carousel), 1 = fully opened (cover face-on)
  const openTarget = useRef(0);
  const openProgress = useRef(0);
  const [openIdx, setOpenIdx] = useState<number | null>(null);



  const LOOP_THRESHOLD = 8;
  const goToIdx = (idx: number) => {
    const N = vinilos.length;
    if (N <= LOOP_THRESHOLD) {
      target.current = Math.max(0, Math.min(N - 1, idx));
      return;
    }
    const cur = target.current;
    const curMod = ((cur % N) + N) % N;
    const delta = ((idx - curMod + N + N / 2) % N) - N / 2;
    target.current = cur + delta;
  };

  const stepTarget = (dir: 1 | -1) => {
    const N = vinilos.length;
    const next = Math.round(target.current) + dir;
    target.current = N <= LOOP_THRESHOLD ? Math.max(0, Math.min(N - 1, next)) : next;
  };

  useImperativeHandle(
    ref,
    () => ({
      goTo: goToIdx,
      next: () => stepTarget(1),
      prev: () => stepTarget(-1),
      open: (idx: number) => {
        goToIdx(idx);
        openTarget.current = 1;
        setOpenIdx(idx);
      },
      close: () => {
        openTarget.current = 0;
        setOpenIdx(null);
      },
    }),
    [vinilos.length],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const clampToList = (v: number) => {
      const N = vinilos.length;
      if (N > LOOP_THRESHOLD) return v; // loop allowed → no clamp
      return Math.max(0, Math.min(N - 1, v));
    };

    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // let scrolling pass through inside any overlay that opts in
      if (t.closest("[data-scrollable]")) return;
      if (openTarget.current > 0) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target.current = clampToList(target.current + delta * 0.005);
    };
    // attach to window so overlays / backdrops don't block scrolling
    window.addEventListener("wheel", onWheel, { passive: false });

    // drag: listen pointerdown on el (so we only start drag inside the shelf),
    // but pointermove/up on window so we don't capture/intercept the pointer
    // and r3f can still receive its synthesized click events on the canvas.
    let startX = 0;
    let startT = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      if (openTarget.current > 0) return; // no drag while opened
      dragging = true;
      moved = false;
      startX = e.clientX;
      startT = target.current;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      target.current = clampToList(startT - dx * 0.01);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      target.current = clampToList(Math.round(target.current));
      if (moved) {
        // swallow the synthetic click that follows a drag
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", stop, true);
        };
        window.addEventListener("click", stop, true);
      }
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    const onKey = (e: KeyboardEvent) => {
      if (openTarget.current > 0) return;
      if (e.key === "ArrowRight") target.current = clampToList(target.current + 1);
      else if (e.key === "ArrowLeft") target.current = clampToList(target.current - 1);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    onActiveChange?.(vinilos[active]);
  }, [active, vinilos, onActiveChange]);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen select-none touch-none"
      style={{ cursor: "grab" }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <PerspectiveCamera makeDefault position={[camX, camY, zoom]} fov={fov} />
        <color attach="background" args={["#0a0a0a"]} />
        <FogRig openProgressRef={openProgress} near={fogNear} far={fogFar} />
        <ambientLight intensity={lights.ambient} />
        <AnimatedLight
          openProgressRef={openProgress}
          fromPos={[lights.light1X, lights.light1Y, lights.light1Z]}
          fromIntensity={lights.light1Intensity}
          toPos={[2, 0, 14]}
          toIntensity={0}
        />
        <AnimatedLight
          openProgressRef={openProgress}
          fromPos={[lights.light2X, lights.light2Y, lights.light2Z]}
          fromIntensity={lights.light2Intensity}
          toPos={[-7.5, 0.5, 14]}
          toIntensity={2}
        />
        <CameraRig openProgressRef={openProgress} baseZ={zoom} />

        <Suspense fallback={null}>
          <Strip
            vinilos={vinilos}
            targetRef={target}
            currentRef={current}
            openTargetRef={openTarget}
            openProgressRef={openProgress}
            onSettle={setActive}
            onClick={onOpen}
            stripY={stripY}
            spacing={spacing}
            visibleX={visibleX}
            fanStrength={fanStrength}
            maxOpen={maxOpen}
            thickness={thickness}
            coverRoughness={coverRoughness}
            coverMetalness={coverMetalness}
            cardboardRoughness={cardboardRoughness}
            openDuration={tuning.openDuration}
            moveSplit={tuning.moveSplit}
            flipOverlap={tuning.flipOverlap}
            moveEasing={moveEasing}
            flipEasing={flipEasing}
            hoverSpring={tuning.hoverSpring}
            hoverLift={tuning.hoverLift}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

export default VinylShelf3D;

function Strip({
  vinilos,
  targetRef,
  currentRef,
  openTargetRef,
  openProgressRef,
  onSettle,
  onClick,
  stripY,
  spacing,
  visibleX,
  fanStrength,
  maxOpen,
  thickness,
  coverRoughness,
  coverMetalness,
  cardboardRoughness,
  openDuration,
  moveSplit,
  flipOverlap,
  moveEasing,
  flipEasing,
  hoverSpring,
  hoverLift,
}: {
  vinilos: Vinyl[];
  targetRef: React.MutableRefObject<number>;
  currentRef: React.MutableRefObject<number>;
  openTargetRef: React.MutableRefObject<number>;
  openProgressRef: React.MutableRefObject<number>;
  onSettle: (idx: number) => void;
  onClick: (v: Vinyl) => void;
  stripY: number;
  spacing: number;
  visibleX: number;
  fanStrength: number;
  maxOpen: number;
  thickness: number;
  coverRoughness: number;
  coverMetalness: number;
  cardboardRoughness: number;
  openDuration: number;
  moveSplit: number;
  flipOverlap: number;
  moveEasing: EasingName;
  flipEasing: EasingName;
  hoverSpring: number;
  hoverLift: number;
}) {
  const lastIdx = useRef(-1);
  const N = vinilos.length;

  // pre-load every cover texture
  const urls = useMemo(() => vinilos.map(coverFor), [vinilos]);
  useLoader(THREE.TextureLoader, urls);

  // loop only if the collection is big enough — otherwise users would see
  // the same 5 vinyls repeated again right next to themselves
  const LOOP_THRESHOLD = 8;
  const enableLoop = N > LOOP_THRESHOLD;
  const copies = enableLoop ? Math.max(1, Math.ceil((2 * visibleX) / (N * spacing))) : 1;
  const modulus = enableLoop ? N * copies : Number.POSITIVE_INFINITY;

  const stripGroupRef = useRef<THREE.Group>(null);

  // track the cursor so we can re-fire pointermove on the canvas every time
  // the carousel moves — otherwise r3f wouldn't update hover state for the
  // sleeve passing under a stationary cursor.
  const { gl } = useThree();
  const pointerXY = useRef({ x: -10000, y: -10000, inside: false });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerXY.current.x = e.clientX;
      pointerXY.current.y = e.clientY;
      pointerXY.current.inside = true;
    };
    const onLeave = () => {
      pointerXY.current.inside = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  const lastCurrent = useRef(0);

  const tweenRef = useRef({
    from: 0,
    to: 0,
    startTime: 0,
    lastTarget: 0,
  });

  useFrame(() => {
    // slow the carousel spring while a vinyl is opened so prev/next transitions
    // through the centred view feel as cinematic as the open animation itself
    const springRate = openTargetRef.current > 0 ? 0.025 : 0.12;
    currentRef.current += (targetRef.current - currentRef.current) * springRate;

    const t = tweenRef.current;
    if (openTargetRef.current !== t.lastTarget) {
      t.from = openProgressRef.current;
      t.to = openTargetRef.current;
      t.startTime = performance.now();
      t.lastTarget = openTargetRef.current;
    }
    const elapsed = performance.now() - t.startTime;
    const p = Math.min(1, elapsed / openDuration);
    openProgressRef.current = t.from + (t.to - t.from) * p;

    // strip drop: ease the position itself within the SAME phase as the move
    // phase, so the carousel decelerates smoothly into its dropped position
    if (stripGroupRef.current) {
      const open = openProgressRef.current;
      const movePhaseRaw = Math.min(1, open / moveSplit);
      const movePhaseEased = EASINGS[moveEasing](movePhaseRaw);
      stripGroupRef.current.position.y = stripY - movePhaseEased * 3;
    }

    const idx = ((Math.round(currentRef.current) % N) + N) % N;
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      onSettle(idx);
    }

    // if the carousel is moving and the cursor is on-screen, fire a synthetic
    // pointermove so r3f re-raycasts and updates hover state for whichever
    // sleeve has just slid under the cursor.
    const movedEnough = Math.abs(currentRef.current - lastCurrent.current) > 0.0005;
    lastCurrent.current = currentRef.current;
    if (movedEnough && pointerXY.current.inside) {
      gl.domElement.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
          clientX: pointerXY.current.x,
          clientY: pointerXY.current.y,
        }),
      );
    }
  });

  return (
    <group ref={stripGroupRef} position={[0, stripY, 0]}>
      {vinilos.flatMap((v, i) =>
        Array.from({ length: copies }, (_, c) => (
          <Sleeve
            key={`${v.id}-${c}`}
            vinyl={v}
            baseIndex={i + c * N}
            modulus={modulus}
            currentRef={currentRef}
            openProgressRef={openProgressRef}
            spacing={spacing}
            visibleX={visibleX}
            fanStrength={fanStrength}
            maxOpen={maxOpen}
            thickness={thickness}
            coverRoughness={coverRoughness}
            coverMetalness={coverMetalness}
            cardboardRoughness={cardboardRoughness}
            moveSplit={moveSplit}
            flipOverlap={flipOverlap}
            moveEasing={moveEasing}
            flipEasing={flipEasing}
            hoverSpring={hoverSpring}
            hoverLift={hoverLift}
            onClick={() => onClick(v)}
          />
        )),
      )}
    </group>
  );
}

function dominantFromPalette(palette: string[]): string {
  if (!palette.length) return "#888";
  const scored = palette
    .map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 2;
      const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lum - 1));
      const score = sat * (1 - Math.abs(lum - 0.5) * 1.5);
      return { hex, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0].hex;
}

function Sleeve({
  vinyl,
  baseIndex,
  modulus,
  currentRef,
  openProgressRef,
  spacing,
  visibleX,
  fanStrength,
  maxOpen,
  thickness,
  coverRoughness,
  coverMetalness,
  cardboardRoughness,
  moveSplit,
  flipOverlap,
  moveEasing,
  flipEasing,
  hoverSpring,
  hoverLift,
  onClick,
}: {
  vinyl: Vinyl;
  baseIndex: number;
  modulus: number;
  currentRef: React.MutableRefObject<number>;
  openProgressRef: React.MutableRefObject<number>;
  spacing: number;
  visibleX: number;
  fanStrength: number;
  maxOpen: number;
  thickness: number;
  coverRoughness: number;
  coverMetalness: number;
  cardboardRoughness: number;
  moveSplit: number;
  flipOverlap: number;
  moveEasing: EasingName;
  flipEasing: EasingName;
  hoverSpring: number;
  hoverLift: number;
  onClick: () => void;
}) {
  const url = useMemo(() => coverFor(vinyl), [vinyl]);
  const texture = useLoader(THREE.TextureLoader, url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  // edge slivers: clone the cover texture and clip UVs to the appropriate
  // 1-pixel-ish strip so each side face looks like the cover wraps around.
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  const edgeStrip = 0.015; // fraction of the cover used as the edge strip
  const makeEdge = useMemo(
    () => (
      offsetU: number,
      offsetV: number,
      repeatU: number,
      repeatV: number,
    ) => {
      const t = texture.clone();
      t.needsUpdate = true;
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(repeatU, repeatV);
      t.offset.set(offsetU, offsetV);
      return t;
    },
    [texture],
  );

  const edgeRight = useMemo(() => makeEdge(1 - edgeStrip, 0, edgeStrip, 1), [makeEdge]);
  const edgeLeft = useMemo(() => makeEdge(0, 0, edgeStrip, 1), [makeEdge]);
  const edgeTop = useMemo(() => makeEdge(0, 1 - edgeStrip, 1, edgeStrip), [makeEdge]);
  const edgeBottom = useMemo(() => makeEdge(0, 0, 1, edgeStrip), [makeEdge]);

  const matRight = useMemo(
    () => new THREE.MeshStandardMaterial({ map: edgeRight, roughness: cardboardRoughness }),
    [edgeRight, cardboardRoughness],
  );
  const matLeft = useMemo(
    () => new THREE.MeshStandardMaterial({ map: edgeLeft, roughness: cardboardRoughness }),
    [edgeLeft, cardboardRoughness],
  );
  const matTop = useMemo(
    () => new THREE.MeshStandardMaterial({ map: edgeTop, roughness: cardboardRoughness }),
    [edgeTop, cardboardRoughness],
  );
  const matBottom = useMemo(
    () => new THREE.MeshStandardMaterial({ map: edgeBottom, roughness: cardboardRoughness }),
    [edgeBottom, cardboardRoughness],
  );
  // PhysicalMaterial w/ a touch of clearcoat → simulates the gloss laminate
  // of a real album sleeve so light catches highlights without washing out
  const portada = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: coverRoughness,
        metalness: coverMetalness,
        clearcoat: 0.4,
        clearcoatRoughness: 0.25,
      }),
    [texture, coverRoughness, coverMetalness],
  );
  const contra = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0, color: "#666" }),
    [texture],
  );
  const materials = useMemo(
    () => [matRight, matLeft, matTop, matBottom, portada, contra],
    [matRight, matLeft, matTop, matBottom, portada, contra],
  );

  const meshGroupRef = useRef<THREE.Group>(null);
  const hoverRef = useRef(0); // 0..1 smooth hover progress
  const hoverTargetRef = useRef(0);

  useFrame(() => {
    if (!meshGroupRef.current) return;
    hoverRef.current += (hoverTargetRef.current - hoverRef.current) * hoverSpring;
    // wrap the position to [-modulus/2, modulus/2) so the vinyl quietly loops
    let delta = (baseIndex - currentRef.current) % modulus;
    if (delta > modulus / 2) delta -= modulus;
    if (delta < -modulus / 2) delta += modulus;
    const x = delta * spacing;

    const open = openProgressRef.current;
    // staged animation, each phase eased separately. flipOverlap brings the
    // start of the flip BEFORE the lift finishes, so the rotation is already
    // underway as the sleeve settles into the centre.
    const flipStart = Math.max(0, moveSplit - flipOverlap);
    const movePhaseRaw = Math.min(1, open / moveSplit);
    const flipPhaseRaw = Math.max(0, (open - flipStart) / (1 - flipStart));
    const movePhase = EASINGS[moveEasing](movePhaseRaw);
    const flipPhase = EASINGS[flipEasing](flipPhaseRaw);

    const tilt = Math.sign(x) * Math.min(maxOpen, Math.abs(x) * fanStrength);
    const baseRot = Math.PI / 2 + tilt;

    const centerWeight = Math.max(0, 1 - Math.abs(x) / (spacing * 0.6));

    // Sharp flip: only sleeves VERY close to center (|x| < spacing * 0.15)
    // are flipped — sleeves moving in or out of the centre stay spine-forward
    // (slim profile) so they never sweep through neighbours.  Achieved with a
    // steep power curve on centerWeight: low centerWeight → ~0, only spikes
    // close to 1.
    const flipReadyness = Math.pow(centerWeight, 5);
    const flipFactor = flipPhase * flipReadyness;
    meshGroupRef.current.rotation.y = baseRot * (1 - flipFactor);

    // hover lift fades out as we open
    const hoverEased = 1 - Math.pow(1 - hoverRef.current, 3);
    const hoverLiftValue = hoverEased * hoverLift * (1 - open);
    meshGroupRef.current.position.x = x;
    // lift uses a softer curve so neighbours still rise nicely as they slide
    // toward centre — only the FLIP is sharply gated, not the lift itself
    const liftReadyness = Math.pow(centerWeight, 1.4);
    meshGroupRef.current.position.y = movePhase * liftReadyness * 4.4 + hoverLiftValue;

    // non-active sleeves fade away while opened
    const opacityFactor = open > 0.05
      ? (centerWeight > 0.5 ? 1 : 1 - open * 0.95)
      : 1;
    const visible = Math.abs(x) < visibleX && opacityFactor > 0.02;
    if (meshGroupRef.current.visible !== visible) {
      meshGroupRef.current.visible = visible;
    }
  });

  return (
    <group ref={meshGroupRef}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoverTargetRef.current = 1;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          hoverTargetRef.current = 0;
          document.body.style.cursor = "";
        }}
        material={materials}
      >
        <boxGeometry args={[SLEEVE_W, SLEEVE_H, thickness]} />
      </mesh>
    </group>
  );
}

/**
 * Pushes the fog plane back during the open animation so the active vinyl
 * doesn't sink into the background when the camera dollies out.
 */
/**
 * Directional light whose position and intensity interpolate between two
 * states based on openProgress, eased the same as the rest of the open
 * animation.
 */
function AnimatedLight({
  openProgressRef,
  fromPos,
  fromIntensity,
  toPos,
  toIntensity,
}: {
  openProgressRef: React.MutableRefObject<number>;
  fromPos: [number, number, number];
  fromIntensity: number;
  toPos: [number, number, number];
  toIntensity: number;
}) {
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);
    ref.current.position.set(
      fromPos[0] + (toPos[0] - fromPos[0]) * t,
      fromPos[1] + (toPos[1] - fromPos[1]) * t,
      fromPos[2] + (toPos[2] - fromPos[2]) * t,
    );
    ref.current.intensity = fromIntensity + (toIntensity - fromIntensity) * t;
  });
  return <directionalLight ref={ref} position={fromPos} intensity={fromIntensity} />;
}

function FogRig({
  openProgressRef,
  near,
  far,
}: {
  openProgressRef: React.MutableRefObject<number>;
  near: number;
  far: number;
}) {
  const fogRef = useRef<THREE.Fog>(null);
  useFrame(() => {
    if (!fogRef.current) return;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);
    fogRef.current.near = near + t * 10;
    fogRef.current.far = far + t * 15;
  });
  return <fog ref={fogRef} attach="fog" args={["#0a0a0a", near, far]} />;
}

/**
 * Pulls the camera back during the open animation so the opened cover doesn't
 * blow up on squarer viewports.  Uses an adaptive target distance based on
 * the viewport aspect — wider screens need less zoom-out.
 */
function CameraRig({
  openProgressRef,
  baseZ,
}: {
  openProgressRef: React.MutableRefObject<number>;
  baseZ: number;
}) {
  const { camera, size } = useThree();
  useFrame(() => {
    const aspect = size.width / size.height;
    const openZ = aspect > 1.5 ? baseZ + 1.5 : baseZ + 4;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);
    camera.position.z = baseZ * (1 - t) + openZ * t;
  });
  return null;
}


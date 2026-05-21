"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

type Props = {
  coverUrl: string;
  spinning?: boolean;
  /** rotation speed in revolutions per second */
  rpm?: number;
  className?: string;
  /** how far the disc slides out from the sleeve, 0..1 */
  protrude?: number;
};

/**
 * A vinyl record disc rendered with R3F.
 * - Grooved black disc generated as a canvas texture
 * - Center label uses the album cover
 * - Slides on the X axis based on `protrude` (0 = inside sleeve, 1 = fully out)
 */
export default function VinylRecord3D({
  coverUrl,
  spinning = true,
  rpm = 33,
  className,
  protrude = 0,
}: Props) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, -2, 2]} intensity={0.4} color="#88aaff" />
        <Suspense fallback={null}>
          <Disc coverUrl={coverUrl} spinning={spinning} rpm={rpm} protrude={protrude} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Disc({
  coverUrl,
  spinning,
  rpm,
  protrude,
}: {
  coverUrl: string;
  spinning: boolean;
  rpm: number;
  protrude: number;
}) {
  const group = useRef<THREE.Group>(null);
  const grooveTex = useMemo(() => makeGrooveTexture(), []);
  const labelTex = useLoader(TextureLoader, coverUrl);

  // smooth slide-out from the sleeve
  const targetX = useRef(protrude);
  targetX.current = protrude;

  useFrame((_, delta) => {
    if (!group.current) return;
    if (spinning) {
      group.current.rotation.z -= (rpm / 60) * delta * Math.PI * 2;
    }
    const desiredX = targetX.current * 1.1;
    group.current.position.x += (desiredX - group.current.position.x) * Math.min(1, delta * 8);

    const tiltY = -0.25 + targetX.current * 0.05;
    group.current.rotation.y += (tiltY - group.current.rotation.y) * Math.min(1, delta * 6);
  });

  return (
    <group ref={group} rotation={[Math.PI / 2.5, -0.25, 0]}>
      {/* disc body */}
      <mesh>
        <cylinderGeometry args={[1, 1, 0.018, 128, 1]} />
        <meshStandardMaterial
          map={grooveTex}
          color="#0a0a0a"
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {/* center label front */}
      <mesh position={[0, 0.011, 0]}>
        <circleGeometry args={[0.34, 64]} />
        <meshStandardMaterial map={labelTex} roughness={0.7} />
      </mesh>
      {/* center label back */}
      <mesh position={[0, -0.011, 0]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[0.34, 64]} />
        <meshStandardMaterial map={labelTex} roughness={0.7} />
      </mesh>
      {/* spindle hole */}
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 16]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}

/** Canvas-generated groove texture for the disc top/bottom. */
function makeGrooveTexture(): THREE.CanvasTexture {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  // base
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  // grooves
  for (let r = maxR * 0.36; r < maxR * 0.985; r += 1.2) {
    const alpha = 0.04 + Math.random() * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.stroke();
  }

  // subtle radial highlight
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.4, cx, cy, maxR);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

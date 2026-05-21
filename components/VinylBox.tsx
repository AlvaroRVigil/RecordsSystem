"use client";

import type { Vinyl } from "@/lib/types";

type Props = {
  vinyl: Vinyl;
  size?: number;
  thickness?: number;
};

/**
 * Debug preview: each face has a flat color + label so the 6-sided box
 * is easy to verify visually.
 *   portada (+Z)  ROJO
 *   contra  (-Z)  AZUL
 *   lomo    (-X)  AMARILLO
 *   right   (+X)  VERDE
 *   top     (-Y)  MAGENTA
 *   bottom  (+Y)  CIAN
 */
export default function VinylBox({ vinyl, size = 360, thickness = 18 }: Props) {
  void vinyl;
  const half = thickness / 2;

  const edge = "inset 0 0 0 1px rgba(0,0,0,0.35)";
  const label = (fontSize: number): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontWeight: 700,
    letterSpacing: "0.1em",
    fontSize,
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    boxShadow: edge,
  });

  const big = Math.round(size * 0.08);
  const small = Math.max(8, Math.round(thickness * 0.45));

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        transformStyle: "preserve-3d",
      }}
    >
      <Face w={size} h={size} transform={`translateZ(${half}px)`} style={{ ...label(big), background: "#e63946" }}>
        PORTADA
      </Face>

      <Face w={size} h={size} transform={`translateZ(${-half}px) rotateY(180deg)`} style={{ ...label(big), background: "#1d3557" }}>
        CONTRA
      </Face>

      <Face w={thickness} h={size} transform={`translateX(${-size / 2}px) rotateY(-90deg)`} style={{ ...label(small), background: "#f1c40f", color: "#222", textShadow: "none", overflow: "hidden" }}>
        <span style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap" }}>LOMO</span>
      </Face>

      <Face w={thickness} h={size} transform={`translateX(${size / 2}px) rotateY(90deg)`} style={{ ...label(small), background: "#2ecc71", overflow: "hidden" }}>
        <span style={{ transform: "rotate(90deg)", whiteSpace: "nowrap" }}>RIGHT</span>
      </Face>

      <Face w={size} h={thickness} transform={`translateY(${-size / 2}px) rotateX(90deg)`} style={{ ...label(small), background: "#e91e63" }}>
        TOP
      </Face>

      <Face w={size} h={thickness} transform={`translateY(${size / 2}px) rotateX(-90deg)`} style={{ ...label(small), background: "#00bcd4" }}>
        BOTTOM
      </Face>
    </div>
  );
}

function Face({
  w,
  h,
  transform,
  style,
  children,
}: {
  w: number;
  h: number;
  transform: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        backfaceVisibility: "hidden",
        transform,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

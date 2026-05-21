import type { Vinyl } from "./types";

/**
 * Builds a procedural SVG album cover as a data URI from a palette.
 * Used as fallback when no Discogs cover image is available.
 */
export function paletteCoverDataUri(vinyl: Pick<Vinyl, "id" | "title" | "artist" | "palette">): string {
  const [c0, c1, c2, c3, c4] = vinyl.palette.length >= 5
    ? vinyl.palette
    : [...vinyl.palette, ...Array(5 - vinyl.palette.length).fill("#0a0a0a")];

  const seed = vinyl.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = seed % 360;
  const cx = 30 + (seed % 40);
  const cy = 30 + ((seed * 7) % 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${c0}"/>
        <stop offset="100%" stop-color="${c1}"/>
      </linearGradient>
      <radialGradient id="r" cx="${cx}%" cy="${cy}%" r="80%">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.95"/>
        <stop offset="60%" stop-color="${c3}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${c4}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <rect width="600" height="600" fill="url(#r)"/>
    <g font-family="Georgia, serif" fill="${c0}">
      <text x="40" y="540" font-size="34" font-weight="700" letter-spacing="-1">${escapeXml(vinyl.artist)}</text>
      <text x="40" y="572" font-size="18" opacity="0.7" font-style="italic">${escapeXml(vinyl.title)}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function coverFor(vinyl: Vinyl): string {
  return vinyl.cover ?? paletteCoverDataUri(vinyl);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

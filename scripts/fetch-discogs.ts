/**
 * Enriches data/vinilos.json with Discogs metadata.
 *
 * Usage: DISCOGS_TOKEN=xxx npm run fetch:discogs
 *
 * For each vinyl with a `discogsId`, fetches release info and overwrites
 * cover, tracklist, label and year. Items without `discogsId` are skipped.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Vinyl } from "../lib/types";

const TOKEN = process.env.DISCOGS_TOKEN;
const UA = "VinilosApp/0.1 +https://example.com";
const DATA_PATH = resolve(process.cwd(), "data/vinilos.json");

async function fetchRelease(id: number) {
  const res = await fetch(`https://api.discogs.com/releases/${id}`, {
    headers: {
      "User-Agent": UA,
      ...(TOKEN ? { Authorization: `Discogs token=${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Discogs ${id} → ${res.status}`);
  return res.json();
}

function enrich(v: Vinyl, r: any): Vinyl {
  return {
    ...v,
    cover: r.images?.[0]?.uri ?? v.cover,
    year: r.year ?? v.year,
    label: r.labels?.[0]?.name ?? v.label,
    country: r.country ?? v.country,
    tracklist: (r.tracklist ?? []).map((t: any) => ({
      position: t.position || "",
      title: t.title || "",
      duration: t.duration || "",
    })),
  };
}

async function main() {
  if (!TOKEN) {
    console.warn("⚠  DISCOGS_TOKEN not set — anonymous rate limits apply.");
  }
  const raw = await readFile(DATA_PATH, "utf8");
  const vinilos: Vinyl[] = JSON.parse(raw);

  const out: Vinyl[] = [];
  for (const v of vinilos) {
    if (!v.discogsId) {
      out.push(v);
      continue;
    }
    try {
      console.log(`→ ${v.artist} — ${v.title} (#${v.discogsId})`);
      const r = await fetchRelease(v.discogsId);
      out.push(enrich(v, r));
      await new Promise((r) => setTimeout(r, 1100)); // rate limit
    } catch (e) {
      console.error(`  failed:`, (e as Error).message);
      out.push(v);
    }
  }

  await writeFile(DATA_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ updated ${DATA_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

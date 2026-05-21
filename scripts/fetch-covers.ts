/**
 * Downloads real album covers + first-track preview URLs from iTunes
 * Search API into public/covers/ and updates data/vinilos.json.
 *
 * Idempotent: re-running won't re-download existing covers.
 *
 * Usage: npx tsx scripts/fetch-covers.ts
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import type { Vinyl } from "../lib/types";

const DATA_PATH = resolve(process.cwd(), "data/vinilos.json");
const OUT_DIR = resolve(process.cwd(), "public/covers");

type Result = {
  collectionId?: number;
  collectionName?: string;
  artworkUrl100?: string;
};

async function searchAlbum(artist: string, album: string): Promise<Result | null> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const candidates: Result[] = data.results ?? [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(album);
  return (
    candidates.find((c) => norm(c.collectionName ?? "").includes(target)) ??
    candidates[0] ??
    null
  );
}

async function firstPreviewForAlbum(collectionId: number): Promise<string | null> {
  const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=20`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const songs = (data.results ?? []).filter((r: any) => r.wrapperType === "track" && r.previewUrl);
  return songs[0]?.previewUrl ?? null;
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const raw = await readFile(DATA_PATH, "utf8");
  const vinilos: Vinyl[] = JSON.parse(raw);

  const out: Vinyl[] = [];
  for (const v of vinilos) {
    try {
      const haveCover = v.cover && (await fileExists(resolve(process.cwd(), "public" + v.cover)));
      const havePreview = !!v.previewUrl;
      if (haveCover && havePreview) {
        out.push(v);
        console.log(`· ${v.artist} — ${v.title} (skip, already complete)`);
        continue;
      }

      const match = await searchAlbum(v.artist, v.title);
      if (!match) {
        console.warn(`✗ ${v.artist} — ${v.title} (no album result)`);
        out.push({ ...v, previewUrl: v.previewUrl ?? null });
        continue;
      }

      // cover
      let coverPath = v.cover;
      if (!haveCover && match.artworkUrl100) {
        const url = match.artworkUrl100.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1");
        const ext = url.match(/\.(jpg|png)$/)?.[1] ?? "jpg";
        const filename = `${v.id}.${ext}`;
        const dest = resolve(OUT_DIR, filename);
        await download(url, dest);
        coverPath = `/covers/${filename}`;
      }

      // preview
      let previewUrl = v.previewUrl ?? null;
      if (!havePreview && match.collectionId) {
        previewUrl = await firstPreviewForAlbum(match.collectionId);
      }

      out.push({ ...v, cover: coverPath, previewUrl });
      console.log(`✓ ${v.artist} — ${v.title}${previewUrl ? " (cover + preview)" : " (cover only)"}`);
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.error(`✗ ${v.artist} — ${v.title}:`, (e as Error).message);
      out.push({ ...v, previewUrl: v.previewUrl ?? null });
    }
  }

  await writeFile(DATA_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ updated ${DATA_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { NextRequest } from "next/server";
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import type { Vinyl } from "@/lib/types";

const TOKEN = process.env.DISCOGS_TOKEN;
const UA = "VinilosApp/0.1 +local";
const DATA_PATH = resolve(process.cwd(), "data/vinilos.json");
const COVERS_DIR = resolve(process.cwd(), "public/covers");

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function searchItunesPreview(artist: string, album: string): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=3`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(album);
    const match =
      (data.results ?? []).find((c: any) => norm(c.collectionName ?? "").includes(target)) ??
      data.results?.[0];
    if (!match?.collectionId) return null;
    const tracksRes = await fetch(
      `https://itunes.apple.com/lookup?id=${match.collectionId}&entity=song&limit=5`,
    );
    if (!tracksRes.ok) return null;
    const tracksData = await tracksRes.json();
    const songs = (tracksData.results ?? []).filter((r: any) => r.wrapperType === "track");
    return songs[0]?.previewUrl ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!TOKEN) {
    return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });
  }
  const { releaseId } = await req.json();
  if (!releaseId) return Response.json({ error: "releaseId required" }, { status: 400 });

  const r = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers: { "User-Agent": UA, Authorization: `Discogs token=${TOKEN}` },
  });
  if (!r.ok) return Response.json({ error: `discogs ${r.status}` }, { status: r.status });
  const release = await r.json();

  // build a Vinyl entry — strip Discogs' (N) disambiguators
  const cleanName = (s: string) => s.replace(/\s\(\d+\)/g, "").trim();
  const artist = cleanName(release.artists?.[0]?.name ?? "Unknown");
  const title = cleanName(release.title ?? "Untitled");
  const id = `${slugify(artist)}-${slugify(title)}-${releaseId}`;

  await mkdir(COVERS_DIR, { recursive: true });
  // cover
  let coverPath: string | null = null;
  const imgUrl: string | undefined =
    release.images?.find((i: any) => i.type === "primary")?.uri ?? release.images?.[0]?.uri;
  if (imgUrl) {
    try {
      const imgRes = await fetch(imgUrl, { headers: { "User-Agent": UA } });
      if (imgRes.ok) {
        const ext = imgUrl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
        const filename = `${id}.${ext === "jpeg" ? "jpg" : ext}`;
        const dest = resolve(COVERS_DIR, filename);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        await writeFile(dest, buf);
        coverPath = `/covers/${filename}`;
      }
    } catch {}
  }

  const previewUrl = await searchItunesPreview(artist, title);

  const vinyl: Vinyl = {
    id,
    title,
    artist,
    year: release.year ?? 0,
    genre: (release.genres ?? [])[0] ?? "",
    label: release.labels?.[0]?.name ?? "",
    country: release.country ?? "",
    palette: ["#888", "#666", "#444", "#222", "#000"],
    discogsId: releaseId,
    cover: coverPath,
    previewUrl,
    tracklist: (release.tracklist ?? []).map((t: any) => ({
      position: t.position || "",
      title: t.title || "",
      duration: t.duration || "",
    })),
  };

  // persist to data/vinilos.json (append if not present)
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const list: Vinyl[] = JSON.parse(raw);
    if (!list.some((v) => v.id === vinyl.id)) {
      list.push(vinyl);
      await writeFile(DATA_PATH, JSON.stringify(list, null, 2) + "\n");
    }
  } catch {}

  return Response.json({ vinyl });
}

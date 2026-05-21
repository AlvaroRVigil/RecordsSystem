import { NextRequest } from "next/server";

const TOKEN = process.env.DISCOGS_TOKEN;
const UA = "VinilosApp/0.1 +local";

type DiscogsResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string | string[];
  genre?: string | string[];
  cover_image?: string;
  thumb?: string;
  format?: string[];
  community?: { want?: number; have?: number };
  master_id?: number;
  type?: string;
};

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function norm(s: string) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function discogsSearch(params: Record<string, string>) {
  const url = new URL("https://api.discogs.com/database/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("per_page", "50");
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Authorization: `Discogs token=${TOKEN}` },
    next: { revalidate: 60 },
  });
  if (!r.ok) return [] as DiscogsResult[];
  const data = await r.json();
  return (data.results ?? []) as DiscogsResult[];
}

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });
  }
  const raw = req.nextUrl.searchParams.get("q")?.trim();
  if (!raw) return Response.json({ results: [] });

  const stripped = stripAccents(raw);
  const variants = raw === stripped ? [raw] : [raw, stripped];
  const normQ = norm(raw);

  // Run many parallel searches to maximise coverage:
  //  - artist (with AND without accents) → fans of strict artist matching
  //  - release_title (with AND without accents)
  //  - q generic (with AND without)
  //  - type=master with q (groups all editions, broadens coverage)
  const queries: Record<string, string>[] = [];
  for (const v of variants) {
    queries.push({ artist: v, type: "release" });
    queries.push({ release_title: v, type: "release" });
    queries.push({ q: v, type: "release" });
    queries.push({ q: v, type: "master" });
  }

  const all = await Promise.all(queries.map(discogsSearch));

  // dedupe: prefer master_id when present; else release id
  const seen = new Set<string>();
  const merged: DiscogsResult[] = [];
  for (const list of all) {
    for (const r of list) {
      // skip non-releases for our purposes (masters return separately but we
      // want a release id to link to)
      const key = r.master_id ? `m${r.master_id}` : `r${r.id}-${r.type ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }

  // Score: artist match > title contains > vinyl > popularity
  const scored = merged.map((r) => {
    const title = norm(r.title ?? "");
    const startsWithArtist =
      title.startsWith(`${normQ} -`) || title.startsWith(`${normQ} `);
    const containsAll = normQ.split(" ").every((t) => t && title.includes(t));
    const isVinyl = (r.format ?? []).some((f) => /vinyl|lp|7"|10"|12"/i.test(f));
    const isMaster = r.type === "master";
    let score = 0;
    if (startsWithArtist) score += 100;
    if (containsAll) score += 30;
    if (isVinyl) score += 15;
    if (isMaster) score += 10; // masters represent canonical works
    score += Math.min(60, Math.log1p(r.community?.want ?? 0) * 6);
    if (r.year && r.year > 1950) score += 1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Return up to 30 results so the user gets variety
  const results = scored.slice(0, 30).map(({ r }) => ({
    // for master entries we want the user to add a representative release
    // (Discogs masters don't have releaseId directly; we'll re-resolve in
    // /api/discogs/release by id type — for now passing the id always works
    // because /releases/{id} accepts release ids; masters need /masters/{id}/main_release)
    id: r.id,
    isMaster: r.type === "master",
    title: r.title,
    year: r.year,
    country: r.country,
    label: Array.isArray(r.label) ? r.label[0] : r.label,
    genre: Array.isArray(r.genre) ? r.genre[0] : r.genre,
    cover_image: r.cover_image,
    thumb: r.thumb,
    format: r.format,
  }));

  return Response.json({ results });
}

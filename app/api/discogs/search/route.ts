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
  url.searchParams.set("per_page", "100");
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

  // Broad queries — we rely on the soft post-filter (drops explicit CDs /
  // cassettes / digital) and on scoring to surface vinyl results, instead of
  // a strict server-side format filter that was hiding too many edge cases
  // (soundtracks, reissues, etc).
  const queries: Record<string, string>[] = [];
  for (const v of variants) {
    queries.push({ artist: v, type: "release" });
    queries.push({ release_title: v, type: "release" });
    queries.push({ query: v, type: "release" });
    queries.push({ query: v, type: "master" });
    queries.push({ artist: v, type: "master" });

    // Multi-word queries: try splitting into "artist + release" pairs at every
    // boundary. Eg. "etta james at last" → tries artist=etta + title=james at last,
    // artist=etta james + title=at last, artist=etta james at + title=last, …
    // Captures cases where Discogs's q= doesn't tokenise nicely (album titled
    // "At Last!", artist "Etta James", etc.).
    const tokens = v.split(/\s+/);
    if (tokens.length >= 2) {
      for (let i = 1; i < tokens.length; i++) {
        const artist = tokens.slice(0, i).join(" ");
        const title = tokens.slice(i).join(" ");
        queries.push({ artist, release_title: title, type: "release" });
        queries.push({ artist, release_title: title, type: "master" });
      }
    }
  }

  const all = await Promise.all(queries.map(discogsSearch));

  // dedupe by master_id, preferring RELEASES over masters (releases carry
  // format / cover / year info we need; masters are sparser).
  const flat = all.flat();
  const byKey = new Map<string, DiscogsResult>();
  for (const r of flat) {
    const key = r.master_id ? `m${r.master_id}` : `r${r.id}-${r.type ?? ""}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
    } else if (prev.type === "master" && r.type === "release") {
      // upgrade: master → release
      byKey.set(key, r);
    } else if (
      prev.type === "release" &&
      r.type === "release" &&
      (r.format ?? []).some((f) => /vinyl|lp/i.test(f)) &&
      !(prev.format ?? []).some((f) => /vinyl|lp/i.test(f))
    ) {
      // upgrade: non-vinyl release → vinyl release (same master)
      byKey.set(key, r);
    }
  }
  const merged = Array.from(byKey.values());

  // Soft post-filter: drop ONLY releases that explicitly mention a non-vinyl
  // format AND don't ALSO mention vinyl. Releases with empty/odd format
  // strings stay (Discogs has lots of these). Masters always stay.
  const isVinylFmt = (r: DiscogsResult) =>
    (r.format ?? []).some((f) => /vinyl|lp|7"|10"|12"/i.test(f));
  const isExplicitlyNonVinyl = (r: DiscogsResult) => {
    const fmts = r.format ?? [];
    if (fmts.length === 0) return false; // no info → keep
    return fmts.some((f) => /\bcd\b|cassette|file|flac|mp3|\btape\b|dvd|stream/i.test(f)) && !isVinylFmt(r);
  };
  const vinylOnly = merged.filter((r) => r.type === "master" || !isExplicitlyNonVinyl(r));

  const scored = vinylOnly.map((r) => {
    const title = norm(r.title ?? "");
    const startsWithArtist =
      title.startsWith(`${normQ} -`) || title.startsWith(`${normQ} `);
    const containsAll = normQ.split(" ").every((t) => t && title.includes(t));
    // exact phrase match → user probably wants the canonical release
    const containsPhrase = normQ.length > 3 && title.includes(normQ);
    const fmts = r.format ?? [];
    const isVinyl = isVinylFmt(r);
    const isAlbum = fmts.some((f) => /\balbum\b/i.test(f));
    const isSingle = fmts.some((f) => /single|7"/i.test(f));
    const isCompilation = fmts.some((f) => /compilation/i.test(f));
    const isMaster = r.type === "master";
    let score = 0;
    if (startsWithArtist) score += 100;
    if (containsPhrase) score += 60;
    if (containsAll) score += 30;
    if (isVinyl) score += 40;
    if (isAlbum) score += 25; // prefer full albums
    if (isSingle) score -= 30; // demote 7" singles of theme songs
    if (isCompilation) score -= 5;
    if (isMaster) score += 10;
    score += Math.min(60, Math.log1p(r.community?.want ?? 0) * 6);
    if (r.year && r.year > 1950) score += 1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Return up to 30 results so the user gets variety
  // strip Discogs' disambiguator suffixes like "Rosalía (3) - Lux" → "Rosalía - Lux"
  const cleanTitle = (s: string) => s.replace(/\s\(\d+\)/g, "");

  const results = scored.slice(0, 30).map(({ r }) => ({
    id: r.id,
    isMaster: r.type === "master",
    title: cleanTitle(r.title ?? ""),
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

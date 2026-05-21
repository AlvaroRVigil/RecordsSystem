import { NextRequest } from "next/server";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Vinyl } from "@/lib/types";

const DATA_PATH = resolve(process.cwd(), "data/vinilos.json");

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const list: Vinyl[] = JSON.parse(raw);
    const target = list.find((v) => v.id === id);
    const next = list.filter((v) => v.id !== id);
    await writeFile(DATA_PATH, JSON.stringify(next, null, 2) + "\n");
    // also delete the cover file if present
    if (target?.cover) {
      try {
        await unlink(resolve(process.cwd(), "public" + target.cover));
      } catch {}
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

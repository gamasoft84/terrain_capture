import { getDb } from "@/lib/db/schema";
import type { CachedTile } from "@/lib/db/schema";
import {
  countTilesForBounds,
  expandEsriTileUrl,
  iterateTilesForBounds,
  type LngLatBoundsLiteral,
} from "@/lib/map/esri-tiles";

export type TilePrecacheProgress = {
  done: number;
  total: number;
  phase: "counting" | "fetching" | "done" | "cancelled" | "error";
  currentZoom?: number;
};

export type PrecacheAreaOptions = {
  signal?: AbortSignal;
  onProgress?: (p: TilePrecacheProgress) => void;
  /** Evita descargas enormes por error (default 12_000). */
  maxTiles?: number;
  /** Descargas simultáneas (default 8). */
  concurrency?: number;
};

export type PrecacheAreaResult = {
  downloaded: number;
  skipped: number;
  failed: number;
  total: number;
};

async function fetchTile(
  coord: { z: number; x: number; y: number },
): Promise<{ ok: boolean; blob: Blob | null }> {
  const url = expandEsriTileUrl(coord.z, coord.y, coord.x);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, blob: null };
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const buf = await res.arrayBuffer();
    return { ok: true, blob: new Blob([buf], { type: mime }) };
  } catch {
    return { ok: false, blob: null };
  }
}

/**
 * Precarga teselas ESRI para un bounding box y rango de zoom en Dexie `tileCache`.
 */
export async function precacheArea(
  bounds: LngLatBoundsLiteral,
  minZoom: number,
  maxZoom: number,
  options: PrecacheAreaOptions = {},
): Promise<PrecacheAreaResult> {
  const maxTiles = options.maxTiles ?? 12_000;
  const concurrency = options.concurrency ?? 8;
  const signal = options.signal;
  const onProgress = options.onProgress;

  const lo = Math.min(minZoom, maxZoom);
  const hi = Math.max(minZoom, maxZoom);

  const total = countTilesForBounds(bounds, lo, hi);
  if (total > maxTiles) {
    onProgress?.({
      done: 0,
      total,
      phase: "error",
    });
    throw new Error(
      `Demasiadas teselas (${total}). Límite ${maxTiles}: reduce zoom máximo o acerca el área.`,
    );
  }

  onProgress?.({ done: 0, total, phase: "counting" });

  const db = getDb();
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;

  const coords = [...iterateTilesForBounds(bounds, lo, hi)];

  async function processOne(coord: { z: number; x: number; y: number }): Promise<void> {
    const url = expandEsriTileUrl(coord.z, coord.y, coord.x);
    const existing = await db.tileCache.get(url);
    if (existing?.blob && existing.blob.size > 0) {
      skipped++;
      return;
    }

    const { ok, blob } = await fetchTile(coord);
    if (!ok || !blob) {
      failed++;
      return;
    }

    const row: CachedTile = {
      url,
      blob,
      cachedAt: new Date(),
      zoom: coord.z,
      x: coord.x,
      y: coord.y,
    };
    try {
      await db.tileCache.put(row);
      downloaded++;
    } catch {
      failed++;
    }
  }

  onProgress?.({ done: 0, total, phase: "fetching" });

  for (let i = 0; i < coords.length; i += concurrency) {
    if (signal?.aborted) break;
    const chunk = coords.slice(i, i + concurrency);
    await Promise.all(chunk.map((c) => processOne(c)));
    done += chunk.length;
    onProgress?.({
      done,
      total,
      phase: "fetching",
      currentZoom: chunk[chunk.length - 1]?.z,
    });
  }

  if (signal?.aborted) {
    onProgress?.({
      done,
      total,
      phase: "cancelled",
    });
    return { downloaded, skipped, failed, total };
  }

  onProgress?.({
    done: total,
    total,
    phase: "done",
  });

  return { downloaded, skipped, failed, total };
}

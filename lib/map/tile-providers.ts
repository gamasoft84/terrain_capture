import maplibregl from "maplibre-gl";
import { getDb } from "@/lib/db/schema";
import type { CachedTile } from "@/lib/db/schema";
import { expandEsriTileUrl, TERRAIN_CACHE_TILE_TEMPLATE } from "@/lib/map/esri-tiles";

export const ESRI_RASTER_ATTRIBUTION =
  '<a href="https://www.esri.com/">© Esri</a> — Maxar, Earthstar, USDA, USGS, IGN, IGP';

/** Lista `tiles` para fuente raster MapLibre (dexie → red). */
export const terrainCacheRasterTiles: string[] = [TERRAIN_CACHE_TILE_TEMPLATE];

let protocolRegistered = false;

function parseTerrainCacheUrl(
  raw: string,
): { z: number; tileRow: number; tileCol: number } | null {
  let pathname: string;
  try {
    const u = new URL(raw);
    pathname = u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  const z = Number(parts[0]);
  const tileRow = Number(parts[1]);
  const tileCol = Number(parts[2]);
  if (![z, tileRow, tileCol].every((n) => Number.isFinite(n))) return null;
  return { z, tileRow, tileCol };
}

/** Registra el protocolo una sola vez (cliente). Debe llamarse antes de crear el mapa. */
export function ensureTerrainCacheProtocol(): void {
  if (typeof window === "undefined" || protocolRegistered) return;
  protocolRegistered = true;

  maplibregl.addProtocol("terrain-cache", async (params, abortController) => {
    const parsed = parseTerrainCacheUrl(params.url);
    if (!parsed) {
      throw new Error(`terrain-cache: URL no reconocida (${params.url})`);
    }
    const { z, tileRow, tileCol } = parsed;
    const canonicalUrl = expandEsriTileUrl(z, tileRow, tileCol);

    const db = getDb();
    const cached = await db.tileCache.get(canonicalUrl);
    if (cached?.blob) {
      const buf = await cached.blob.arrayBuffer();
      return { data: buf };
    }

    const res = await fetch(canonicalUrl, {
      signal: abortController.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Tile fetch ${res.status}: ${canonicalUrl}`);
    }
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const blob = new Blob([buf], { type: mime });

    const row: CachedTile = {
      url: canonicalUrl,
      blob,
      cachedAt: new Date(),
      zoom: z,
      x: tileCol,
      y: tileRow,
    };
    try {
      await db.tileCache.put(row);
    } catch {
      /* espacio lleno u otro error — la tesela ya está en memoria para esta pintada */
    }

    return { data: buf };
  });
}

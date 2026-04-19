/** ESRI World Imagery — mismo orden que MapLibre `{z}/{y}/{x}` (fila/columna TMS). */
export const ESRI_TILE_TEMPLATE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Protocolo registrado en MapLibre (ver `tile-providers.ts`). */
export const TERRAIN_CACHE_TILE_TEMPLATE =
  "terrain-cache://raster/{z}/{y}/{x}";

export type LngLatBoundsLiteral = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Coords de tesela Web Mercator: x = columna, y = fila (norte → sur). */
export type TileCoord = { z: number; x: number; y: number };

/**
 * Expande la plantilla ESRI con z, fila (y), columna (x).
 * Coincide con `ESRI_TILE_TEMPLATE` y con el request de MapLibre.
 */
export function expandEsriTileUrl(z: number, tileRow: number, tileCol: number): string {
  return ESRI_TILE_TEMPLATE.replace("{z}", String(z))
    .replace("{y}", String(tileRow))
    .replace("{x}", String(tileCol));
}

export function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
      n,
  );
  return { x, y };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function tileRangeForBounds(bounds: LngLatBoundsLiteral, z: number) {
  const corners: [number, number][] = [
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
  ];
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [lng, lat] of corners) {
    const t = lngLatToTile(lng, lat, z);
    xMin = Math.min(xMin, t.x);
    xMax = Math.max(xMax, t.x);
    yMin = Math.min(yMin, t.y);
    yMax = Math.max(yMax, t.y);
  }
  const maxIdx = 2 ** z - 1;
  return {
    xMin: clamp(xMin, 0, maxIdx),
    xMax: clamp(xMax, 0, maxIdx),
    yMin: clamp(yMin, 0, maxIdx),
    yMax: clamp(yMax, 0, maxIdx),
  };
}

export function countTilesForBounds(
  bounds: LngLatBoundsLiteral,
  minZ: number,
  maxZ: number,
): number {
  let n = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const r = tileRangeForBounds(bounds, z);
    const w = r.xMax - r.xMin + 1;
    const h = r.yMax - r.yMin + 1;
    n += w * h;
  }
  return n;
}

export function* iterateTilesForBounds(
  bounds: LngLatBoundsLiteral,
  minZ: number,
  maxZ: number,
): Generator<TileCoord> {
  for (let z = minZ; z <= maxZ; z++) {
    const r = tileRangeForBounds(bounds, z);
    for (let x = r.xMin; x <= r.xMax; x++) {
      for (let y = r.yMin; y <= r.yMax; y++) {
        yield { z, x, y };
      }
    }
  }
}

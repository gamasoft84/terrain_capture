import type { LocalVertex } from "@/lib/db/schema";

export function pointEwkt(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/** Anillo cerrado para `geography(POLYGON)` — requiere ≥3 vértices ordenados. */
export function polygonFromVerticesEwkt(vertices: LocalVertex[]): string | null {
  const sorted = [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length < 3) return null;
  const coords = sorted.map((v) => `${v.longitude} ${v.latitude}`);
  const first = coords[0]!;
  coords.push(first);
  return `SRID=4326;POLYGON((${coords.join(",")}))`;
}

export function centroidFromVerticesEwkt(
  vertices: LocalVertex[],
): string | null {
  const sorted = [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const v of sorted) {
    sx += v.longitude;
    sy += v.latitude;
  }
  const n = sorted.length;
  return pointEwkt(sx / n, sy / n);
}

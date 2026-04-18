import * as turf from "@turf/turf";
import type { LocalVertex } from "@/lib/db/schema";

function sortedCoords(vertices: LocalVertex[]): [number, number][] {
  return [...vertices]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((v) => [v.longitude, v.latitude] as [number, number]);
}

/** Área en m² (turf sobre lon/lat; estimación plana). Requiere polígono cerrado (≥3 vértices). */
export function calculatePolygonAreaM2(vertices: LocalVertex[]): number {
  const coords = sortedCoords(vertices);
  if (coords.length < 3) return 0;
  const ring = [...coords, coords[0]!];
  const poly = turf.polygon([ring]);
  return turf.area(poly);
}

/** Perímetro en metros: cadena abierta o borde cerrado. */
export function calculatePolylinePerimeterM(
  vertices: LocalVertex[],
  closed: boolean,
): number {
  const coords = sortedCoords(vertices);
  if (coords.length < 2) return 0;
  const path = closed && coords.length >= 3 ? [...coords, coords[0]!] : coords;
  const line = turf.lineString(path);
  return turf.length(line, { units: "kilometers" }) * 1000;
}

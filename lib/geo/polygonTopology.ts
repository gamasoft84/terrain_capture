import * as turf from "@turf/turf";
import type { GeoVertex } from "@/lib/geo/calculations";

function sortedRingCoords(vertices: GeoVertex[]): [number, number][] {
  return [...vertices]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((v) => [v.longitude, v.latitude]);
}

/** Compara dos vértices en el mismo punto (orden 1e-7 ~ 1 cm). */
function samePoint(a: GeoVertex, b: GeoVertex): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-7 &&
    Math.abs(a.longitude - b.longitude) < 1e-7
  );
}

/**
 * Comprueba polígono cerrado (≥3 vértices): auto-intersección, área casi nula,
 * vértices duplicados consecutivos.
 */
export function analyzeClosedPolygonIssues(vertices: GeoVertex[]): string[] {
  const sorted = [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
  const warnings: string[] = [];
  if (sorted.length < 3) return warnings;

  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    if (samePoint(sorted[i]!, next)) {
      warnings.push(
        "Hay vértices consecutivos en la misma posición (duplicados).",
      );
      break;
    }
  }

  try {
    const coords = sortedRingCoords(sorted);
    const ring = [...coords, coords[0]!];
    const poly = turf.polygon([ring]);
    const k = turf.kinks(poly);
    if (k.features.length > 0) {
      warnings.push(
        "El polígono se cruza a sí mismo (auto-intersección). Revisa el orden de los vértices.",
      );
    }
  } catch {
    warnings.push(
      "La geometría del polígono no es válida para revisión automática.",
    );
  }

  return warnings;
}

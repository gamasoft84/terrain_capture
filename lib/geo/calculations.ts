import * as turf from "@turf/turf";
import type { Feature, Point, Polygon } from "geojson";
import type { LocalVertex } from "@/lib/db/schema";

/**
 * Vértice con lat/lng y `orderIndex` (p. ej. `LocalVertex` en Dexie).
 * El spec menciona `Vertex[]`; en código usamos el modelo local.
 */
export type GeoVertex = LocalVertex;

function sortedCoords(vertices: GeoVertex[]): [number, number][] {
  return [...vertices]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((v) => [v.longitude, v.latitude] as [number, number]);
}

/**
 * Área del polígono cerrado definido por los vértices en orden (m²).
 * `turf.area` sobre lon/lat es aproximación plana; para extensiones muy grandes
 * el error respecto a geodésica puede crecer (coherente con disclaimer de producto).
 * Requiere ≥3 vértices; si no, devuelve 0.
 */
export function calculateArea(vertices: GeoVertex[]): number {
  const coords = sortedCoords(vertices);
  if (coords.length < 3) return 0;
  const ring = [...coords, coords[0]!];
  const poly = turf.polygon([ring]);
  return turf.area(poly);
}

/**
 * Perímetro en metros: polilínea abierta o borde cerrado según `isClosed`.
 * El spec lista un solo argumento; el segundo refleja el estado en Dexie (`isClosed`).
 */
export function calculatePerimeter(
  vertices: GeoVertex[],
  isClosed: boolean,
): number {
  const coords = sortedCoords(vertices);
  if (coords.length < 2) return 0;
  const path = isClosed && coords.length >= 3 ? [...coords, coords[0]!] : coords;
  const line = turf.lineString(path);
  return turf.length(line, { units: "kilometers" }) * 1000;
}

/** Centroide en EPSG:4326 como `[lng, lat]` (polígono cerrado, ≥3 vértices). */
export function calculateCentroid(vertices: GeoVertex[]): [number, number] {
  const coords = sortedCoords(vertices);
  if (coords.length < 3) {
    throw new Error("calculateCentroid: se requieren al menos 3 vértices");
  }
  const ring = [...coords, coords[0]!];
  const poly = turf.polygon([ring]);
  const c = turf.centroid(poly);
  const [lng, lat] = c.geometry.coordinates;
  return [lng, lat];
}

/** `Feature` GeoJSON del anillo exterior (≥3 vértices, anillo cerrado). */
export function verticesToGeoJSON(vertices: GeoVertex[]): Feature<Polygon> {
  const coords = sortedCoords(vertices);
  if (coords.length < 3) {
    throw new Error("verticesToGeoJSON: se requieren al menos 3 vértices");
  }
  const ring = [...coords, coords[0]!];
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

/** Si el área es menor que 10_000 m² → unidad m²; si no → valor en hectáreas. */
export function formatArea(
  areaM2: number,
): { value: number; unit: "m²" | "ha" } {
  if (!Number.isFinite(areaM2) || areaM2 < 0) {
    return { value: 0, unit: "m²" };
  }
  if (areaM2 >= 10_000) {
    return { value: areaM2 / 10_000, unit: "ha" };
  }
  return { value: areaM2, unit: "m²" };
}

/** Texto para dashboard, panel y etiqueta en mapa. */
export function formatAreaDisplay(areaM2: number | null | undefined): string {
  if (areaM2 == null || !Number.isFinite(areaM2)) return "—";
  const { value, unit } = formatArea(areaM2);
  return unit === "ha" ? `${value.toFixed(2)} ha` : `${value.toFixed(1)} m²`;
}

/** Perímetro en metros con un decimal (polilínea o polígono según datos en Dexie). */
export function formatPerimeterDisplay(
  meters: number | null | undefined,
): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return `${meters.toFixed(1)} m`;
}

/** Distancia geodésica entre dos vértices (m), vía `turf.distance`. */
function segmentDistanceMeters(a: GeoVertex, b: GeoVertex): number {
  const km = turf.distance(
    turf.point([a.longitude, a.latitude]),
    turf.point([b.longitude, b.latitude]),
    { units: "kilometers" },
  );
  return km * 1000;
}

function sortedGeoVertices(vertices: GeoVertex[]): GeoVertex[] {
  return [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
}

function consecutiveVertexPairs(
  vertices: GeoVertex[],
  isClosed: boolean,
): { a: GeoVertex; b: GeoVertex }[] {
  const sorted = sortedGeoVertices(vertices);
  const n = sorted.length;
  if (n < 2) return [];
  const pairs: { a: GeoVertex; b: GeoVertex }[] = [];
  for (let i = 0; i < n - 1; i++) {
    pairs.push({ a: sorted[i]!, b: sorted[i + 1]! });
  }
  if (isClosed && n >= 3) {
    pairs.push({ a: sorted[n - 1]!, b: sorted[0]! });
  }
  return pairs;
}

/** Punto medio geodésico de cada arista + texto de distancia (para etiquetas en mapa). */
export function edgeDistanceLabelFeatures(
  vertices: GeoVertex[],
  isClosed: boolean,
): Feature<Point>[] {
  const pairs = consecutiveVertexPairs(vertices, isClosed);
  return pairs.map(({ a, b }) => {
    const mid = turf.midpoint(
      turf.point([a.longitude, a.latitude]),
      turf.point([b.longitude, b.latitude]),
    );
    const meters = segmentDistanceMeters(a, b);
    return {
      type: "Feature",
      properties: { label: formatDistanceMeters(meters) },
      geometry: mid.geometry as Point,
    };
  });
}

export type PolygonEdgeSegment = {
  fromLabel: string;
  toLabel: string;
  meters: number;
};

/**
 * Longitud de cada arista entre vértices consecutivos (`orderIndex`) y, si el
 * polígono está cerrado con ≥3 vértices, la arista de cierre (último → primero).
 */
export function consecutiveVertexEdgeSegments(
  vertices: GeoVertex[],
  isClosed: boolean,
  labelPrefix: string,
): PolygonEdgeSegment[] {
  const sorted = sortedGeoVertices(vertices);
  const n = sorted.length;
  const pairs = consecutiveVertexPairs(vertices, isClosed);
  return pairs.map((pair, i) => {
    let fromLabel: string;
    let toLabel: string;
    if (i < n - 1) {
      fromLabel = `${labelPrefix}${i + 1}`;
      toLabel = `${labelPrefix}${i + 2}`;
    } else {
      fromLabel = `${labelPrefix}${n}`;
      toLabel = `${labelPrefix}1`;
    }
    return {
      fromLabel,
      toLabel,
      meters: segmentDistanceMeters(pair.a, pair.b),
    };
  });
}

/**
 * Zoom mínimo del mapa (nivel MapLibre) para mostrar las etiquetas de distancia
 * entre vértices sobre la imagen; por debajo se ocultan para no saturar la vista.
 */
export const EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM = 20;

/** Formato legible para tramos (metros o km si ≥ 1000 m). */
export function formatDistanceMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${m.toFixed(1)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/**
 * Cota orientativa de incertidumbre de área (m²) usando la precisión horizontal
 * declarada por vértice (`gpsAccuracyM`, o 5 m si falta). Heurística simple, no
 * sustituye estudio de propagación de errores ni levantamiento certificado.
 */
export function estimateAreaError(vertices: GeoVertex[]): number {
  if (vertices.length < 3) return 0;
  const area = calculateArea(vertices);
  if (!Number.isFinite(area) || area <= 0) return 0;
  let sumSq = 0;
  for (const v of vertices) {
    const σ = v.gpsAccuracyM ?? 5;
    sumSq += σ * σ;
  }
  const rms = Math.sqrt(sumSq / vertices.length);
  return 2 * rms * Math.sqrt(area);
}

import type {
  Feature,
  FeatureCollection,
  LineString,
  Polygon,
  Position,
} from "geojson";
import * as turf from "@turf/turf";
import type { CSSProperties } from "react";
import type { LocalPOI, LocalPolygon, LocalVertex } from "@/lib/db/schema";

export const DEFAULT_CENTER: [number, number] = [-96.13, 15.87];
export const DEFAULT_ZOOM = 14;

export const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
};

export type SubPolygonMapLayer = {
  polygon: LocalPolygon;
  vertices: LocalVertex[];
};

export interface MapCanvasProps {
  vertices: LocalVertex[];
  isClosed: boolean;
  areaM2?: number | null;
  subLayers?: SubPolygonMapLayer[];
  selectedSubPolygonLocalId?: string | null;
  onSelectSubPolygonFromMap?: (polygonLocalId: string | null) => void;
  pois?: LocalPOI[];
  selectedPoiLocalId?: string | null;
  onPoiMarkerClick?: (poi: LocalPOI) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  showUserLocation?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  allowVertexDrag?: boolean;
  resolveVertexDragTarget?: (
    vertex: LocalVertex,
  ) => { polygonLocalId: string; polygonIsClosed: boolean } | null;
  minimalChrome?: boolean;
  /** PNG para el PDF (motor WebGL: canvas; Google: captura del contenedor). */
  onCaptureReady?: (dataUrl: string) => void;
}

export function sortedVertices(vertices: LocalVertex[]): LocalVertex[] {
  return [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function buildFeatureCollection(
  vertices: LocalVertex[],
  isClosed: boolean,
): FeatureCollection {
  const sorted = sortedVertices(vertices);
  const coords: Position[] = sorted.map((v) => [v.longitude, v.latitude]);
  const features: Feature[] = [];

  if (coords.length >= 2) {
    const lineCoords: Position[] =
      isClosed && coords.length >= 3 ? [...coords, coords[0]!] : [...coords];
    features.push({
      type: "Feature",
      properties: { kind: "line" },
      geometry: { type: "LineString", coordinates: lineCoords },
    });
  }

  if (isClosed && coords.length >= 3) {
    const ring = [...coords, coords[0]!];
    features.push({
      type: "Feature",
      properties: { kind: "fill" },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  return { type: "FeatureCollection", features };
}

export function buildSubPolygonsFeatureCollection(
  layers: SubPolygonMapLayer[],
  selectedId: string | null | undefined,
): FeatureCollection {
  const features: Feature[] = [];
  for (const { polygon, vertices } of layers) {
    const sel = polygon.localId === selectedId;
    const fc = buildFeatureCollection(vertices, polygon.isClosed);
    for (const f of fc.features) {
      if (f.properties?.kind === "fill" && f.geometry.type === "Polygon") {
        features.push({
          type: "Feature",
          properties: {
            kind: "fill",
            polygonId: polygon.localId,
            fillColor: polygon.color,
            fillOpacity: sel ? 0.38 : 0.2,
          },
          geometry: f.geometry as Polygon,
        });
      } else if (
        f.properties?.kind === "line" &&
        f.geometry.type === "LineString"
      ) {
        features.push({
          type: "Feature",
          properties: {
            kind: "line",
            polygonId: polygon.localId,
            lineColor: polygon.color,
            lineWidth: sel ? 4 : 2,
            lineOpacity: sel ? 1 : 0.75,
          },
          geometry: f.geometry as LineString,
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

function verticesToTurfPolygon(vertices: LocalVertex[]) {
  const sorted = sortedVertices(vertices);
  if (sorted.length < 3) return null;
  const ring: Position[] = sorted.map((v) => [v.longitude, v.latitude]);
  ring.push([sorted[0]!.longitude, sorted[0]!.latitude]);
  return turf.polygon([ring]);
}

export function pickSubPolygonAtPoint(
  lng: number,
  lat: number,
  layers: SubPolygonMapLayer[],
): string | null {
  const pt = turf.point([lng, lat]);
  let best: { id: string; area: number } | null = null;
  for (const { polygon, vertices } of layers) {
    if (!polygon.isClosed || vertices.length < 3) continue;
    const poly = verticesToTurfPolygon(vertices);
    if (!poly) continue;
    if (!turf.booleanPointInPolygon(pt, poly)) continue;
    const area = turf.area(poly);
    if (!best || area < best.area) {
      best = { id: polygon.localId, area };
    }
  }
  return best?.id ?? null;
}

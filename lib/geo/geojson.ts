import type { LocalVertex } from "@/lib/db/schema";
import type { KmlProjectInput } from "@/lib/geo/kml";

/** Posición GeoJSON RFC 7946 (lng, lat). */
export type GeoJsonPosition = [number, number];

export type TerrainPolygonProperties = {
  entity: "polygon";
  local_id: string;
  server_id: string | null;
  project_local_id: string;
  project_name: string;
  name: string;
  polygon_type: "main" | "sub";
  is_closed: boolean;
  color: string;
  area_m2: number | null;
  perimeter_m: number | null;
  vertex_count: number;
};

export type TerrainPoiProperties = {
  entity: "poi";
  local_id: string;
  server_id: string | null;
  project_local_id: string;
  project_name: string;
  label: string;
  note: string | null;
  captured_at: string;
  gps_accuracy_m: number | null;
  photo_url: string | null;
};

export type TerrainFeatureProperties =
  | TerrainPolygonProperties
  | TerrainPoiProperties;

export type TerrainFeature = {
  type: "Feature";
  geometry:
    | {
        type: "Polygon";
        coordinates: GeoJsonPosition[][];
      }
    | {
        type: "LineString";
        coordinates: GeoJsonPosition[];
      }
    | {
        type: "Point";
        coordinates: GeoJsonPosition;
      };
  properties: TerrainFeatureProperties;
};

export type TerrainFeatureCollection = {
  type: "FeatureCollection";
  /** Metadatos de exportación (miembro foráneo válido en RFC 7946). */
  terrain_capture?: {
    schema_version: 1;
    project_local_id: string;
    project_name: string;
    exported_at: string;
  };
  features: TerrainFeature[];
};

function sortVertices(v: LocalVertex[]): LocalVertex[] {
  return [...v].sort((a, b) => a.orderIndex - b.orderIndex);
}

function ringOuter(verts: LocalVertex[]): GeoJsonPosition[] {
  const sorted = sortVertices(verts);
  if (sorted.length < 3) return [];
  const ring: GeoJsonPosition[] = sorted.map((x) => [x.longitude, x.latitude]);
  const first = sorted[0];
  ring.push([first.longitude, first.latitude]);
  return ring;
}

function lineCoords(verts: LocalVertex[]): GeoJsonPosition[] {
  return sortVertices(verts).map((x) => [x.longitude, x.latitude]);
}

/** FeatureCollection indentada (2 espacios), UTF-8 al serializar a Blob. */
export function buildProjectGeoJson(input: KmlProjectInput): string {
  const { project, polygonBundles, pois } = input;
  const exportedAt = new Date().toISOString();

  const features: TerrainFeature[] = [];

  for (const bundle of polygonBundles) {
    const { polygon, vertices } = bundle;
    const sorted = sortVertices(vertices);
    const baseProps: TerrainPolygonProperties = {
      entity: "polygon",
      local_id: polygon.localId,
      server_id: polygon.serverId ?? null,
      project_local_id: project.localId,
      project_name: project.name,
      name: polygon.name,
      polygon_type: polygon.type,
      is_closed: polygon.isClosed,
      color: polygon.color,
      area_m2: polygon.areaM2 ?? null,
      perimeter_m: polygon.perimeterM ?? null,
      vertex_count: sorted.length,
    };

    if (polygon.isClosed && sorted.length >= 3) {
      const outer = ringOuter(vertices);
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [outer],
        },
        properties: baseProps,
      });
    } else if (sorted.length >= 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: lineCoords(vertices),
        },
        properties: baseProps,
      });
    }
  }

  for (const poi of pois) {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [poi.longitude, poi.latitude],
      },
      properties: {
        entity: "poi",
        local_id: poi.localId,
        server_id: poi.serverId ?? null,
        project_local_id: project.localId,
        project_name: project.name,
        label: poi.label,
        note: poi.note ?? null,
        captured_at: poi.capturedAt.toISOString(),
        gps_accuracy_m: poi.gpsAccuracyM ?? null,
        photo_url: poi.photoUrl ?? null,
      },
    });
  }

  const collection: TerrainFeatureCollection = {
    type: "FeatureCollection",
    terrain_capture: {
      schema_version: 1,
      project_local_id: project.localId,
      project_name: project.name,
      exported_at: exportedAt,
    },
    features,
  };

  return `${JSON.stringify(collection, null, 2)}\n`;
}

export function buildGeoJsonFilename(projectName: string, date: Date): string {
  const safe = projectName
    .trim()
    .replaceAll(/[/\\?%*:|"<>]/g, "_")
    .replaceAll(/\s+/g, "_")
    .slice(0, 80);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const stamp = `${y}-${m}-${d}`;
  const base = safe.length > 0 ? safe : "proyecto";
  return `${base}_${stamp}.geojson`;
}

export async function downloadProjectGeoJson(
  input: KmlProjectInput,
): Promise<void> {
  const text = buildProjectGeoJson(input);
  const blob = new Blob([text], {
    type: "application/geo+json;charset=utf-8",
  });
  const filename = buildGeoJsonFilename(input.project.name, new Date());
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

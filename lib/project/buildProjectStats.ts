import type {
  LocalPOI,
  LocalPolygon,
  LocalProjectPhoto,
  LocalVertex,
} from "@/lib/db/schema";
import {
  calculateArea,
  calculatePerimeter,
  estimateAreaError,
} from "@/lib/geo/calculations";

export type SubPolygonStatRow = {
  polygonLocalId: string;
  name: string;
  color: string;
  vertexCount: number;
  areaM2: number | null;
  perimeterM: number | null;
  isClosed: boolean;
};

export type ProjectPhotoCounts = {
  /** Vértices (principal + sub) con imagen guardada. */
  fromVertices: number;
  /** POIs con foto. */
  fromPois: number;
  /** Fotos adicionales del proyecto. */
  fromExtras: number;
  total: number;
};

export type BuiltProjectStats = {
  mainAreaM2: number | null;
  mainPerimeterM: number | null;
  mainVertexCount: number;
  mainAreaUncertaintyM2: number;
  subRows: SubPolygonStatRow[];
  sumSubAreasM2: number;
  /** `null` si el principal no tiene área cerrada válida. */
  freeAreaM2: number | null;
  /** Suma de subáreas mayor que el área del principal (solapamiento o geometría fuera del límite). */
  subAreasExceedMain: boolean;
  totalVertices: number;
  poiCount: number;
  photoCounts: ProjectPhotoCounts;
};

function hasRenderablePhoto(row: {
  photoUrl?: string;
  photoBytes?: ArrayBuffer;
  photoBlob?: Blob;
}): boolean {
  if (row.photoUrl?.trim()) return true;
  if (row.photoBytes != null && row.photoBytes.byteLength > 0) return true;
  if (row.photoBlob != null && row.photoBlob.size > 0) return true;
  return false;
}

function polygonAreaM2(
  polygon: LocalPolygon,
  vertices: LocalVertex[],
): number | null {
  if (!polygon.isClosed || vertices.length < 3) return null;
  const stored = polygon.areaM2;
  if (stored != null && Number.isFinite(stored) && stored >= 0) return stored;
  const computed = calculateArea(vertices);
  return Number.isFinite(computed) && computed >= 0 ? computed : null;
}

function polygonPerimeterM(
  polygon: LocalPolygon,
  vertices: LocalVertex[],
): number | null {
  if (vertices.length < 2) return null;
  const stored = polygon.perimeterM;
  if (stored != null && Number.isFinite(stored) && stored >= 0) return stored;
  const computed = calculatePerimeter(vertices, polygon.isClosed);
  return Number.isFinite(computed) && computed >= 0 ? computed : null;
}

export function buildProjectStats(input: {
  main: LocalPolygon;
  mainVertices: LocalVertex[];
  subLayers: { polygon: LocalPolygon; vertices: LocalVertex[] }[];
  pois: LocalPOI[];
  projectPhotos: LocalProjectPhoto[];
}): BuiltProjectStats {
  const { main, mainVertices, subLayers, pois, projectPhotos } = input;

  const mainAreaM2 = polygonAreaM2(main, mainVertices);
  const mainPerimeterM = polygonPerimeterM(main, mainVertices);
  const mainVertexCount = mainVertices.length;
  const mainAreaUncertaintyM2 =
    main.isClosed && mainVertices.length >= 3
      ? estimateAreaError(mainVertices)
      : 0;

  const subRows: SubPolygonStatRow[] = subLayers.map(
    ({ polygon, vertices }) => ({
      polygonLocalId: polygon.localId,
      name: polygon.name,
      color: polygon.color,
      vertexCount: vertices.length,
      areaM2: polygonAreaM2(polygon, vertices),
      perimeterM: polygonPerimeterM(polygon, vertices),
      isClosed: polygon.isClosed,
    }),
  );

  let sumSubAreasM2 = 0;
  for (const row of subRows) {
    if (row.areaM2 != null && Number.isFinite(row.areaM2)) {
      sumSubAreasM2 += row.areaM2;
    }
  }

  let freeAreaM2: number | null = null;
  let subAreasExceedMain = false;
  if (mainAreaM2 != null && Number.isFinite(mainAreaM2)) {
    const raw = mainAreaM2 - sumSubAreasM2;
    subAreasExceedMain = raw < 0;
    freeAreaM2 = Math.max(0, raw);
  }

  const totalVertices =
    mainVertexCount + subRows.reduce((a, r) => a + r.vertexCount, 0);

  let fromVertices = 0;
  for (const v of mainVertices) {
    if (hasRenderablePhoto(v)) fromVertices += 1;
  }
  for (const layer of subLayers) {
    for (const v of layer.vertices) {
      if (hasRenderablePhoto(v)) fromVertices += 1;
    }
  }

  let fromPois = 0;
  for (const p of pois) {
    if (hasRenderablePhoto(p)) fromPois += 1;
  }

  let fromExtras = 0;
  for (const ph of projectPhotos) {
    if (hasRenderablePhoto(ph)) fromExtras += 1;
  }

  const photoCounts: ProjectPhotoCounts = {
    fromVertices,
    fromPois,
    fromExtras,
    total: fromVertices + fromPois + fromExtras,
  };

  return {
    mainAreaM2,
    mainPerimeterM,
    mainVertexCount,
    mainAreaUncertaintyM2,
    subRows,
    sumSubAreasM2,
    freeAreaM2,
    subAreasExceedMain,
    totalVertices,
    poiCount: pois.length,
    photoCounts,
  };
}

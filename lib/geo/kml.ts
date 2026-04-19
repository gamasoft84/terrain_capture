import { blobFromStored } from "@/lib/db/blobFromStored";
import { listPoisByProject } from "@/lib/db/pois";
import { listPolygonsByProject } from "@/lib/db/polygons";
import { getProject } from "@/lib/db/projects";
import { listVerticesByPolygon } from "@/lib/db/vertices";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalVertex,
} from "@/lib/db/schema";

const KML_NS = "http://www.opengis.net/kml/2.2";

export type KmlPolygonBundle = {
  polygon: LocalPolygon;
  vertices: LocalVertex[];
};

export type KmlProjectInput = {
  project: LocalProject;
  polygonBundles: KmlPolygonBundle[];
  pois: LocalPOI[];
};

/** Estilo verde corporativo para polígono principal (relleno semitransparente). */
const MAIN_POLY_STYLE_ID = "terraincapture_main_polygon";
/** Prefijo ids de estilo por color en sub-polígonos */
const SUB_POLY_STYLE_PREFIX = "terraincapture_sub_";

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** KML usa `aabbggrr` (opacidad en el primer byte). */
function cssHexToKmlColor(hex: string, opacity = 1): string {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "8000ff00";
  const r = Number.parseInt(m[1].slice(0, 2), 16);
  const g = Number.parseInt(m[1].slice(2, 4), 16);
  const b = Number.parseInt(m[1].slice(4, 6), 16);
  const a = Math.round(Math.min(255, Math.max(0, opacity * 255)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `${toHex(a)}${toHex(b)}${toHex(g)}${toHex(r)}`;
}

function sortVertices(v: LocalVertex[]): LocalVertex[] {
  return [...v].sort((a, b) => a.orderIndex - b.orderIndex);
}

function ringCoordinates(verts: LocalVertex[]): string {
  const sorted = sortVertices(verts);
  if (sorted.length === 0) return "";
  const pts = sorted.map((v) => `${v.longitude},${v.latitude},0`);
  const closed = [...pts];
  const first = sorted[0];
  closed.push(`${first.longitude},${first.latitude},0`);
  return closed.join(" ");
}

function lineCoordinates(verts: LocalVertex[]): string {
  return sortVertices(verts)
    .map((v) => `${v.longitude},${v.latitude},0`)
    .join(" ");
}

async function photoSrcForEmbedded(row: {
  photoUrl?: string;
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
}): Promise<string | undefined> {
  if (row.photoUrl?.startsWith("http")) return row.photoUrl;
  const blob = blobFromStored(row);
  if (!blob || blob.size === 0) return undefined;
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const mime =
    row.photoMime?.trim() ||
    (blob.type && blob.type.length > 0 ? blob.type : "image/jpeg");
  return `data:${mime};base64,${b64}`;
}

function vertexPlacemarkName(polygon: LocalPolygon, vi: number): string {
  const n = vi + 1;
  return polygon.type === "main"
    ? `Vértice principal P${n}`
    : `${polygon.name} · P${n}`;
}

async function vertexDescriptionHtml(
  vertex: LocalVertex,
  polygon: LocalPolygon,
): Promise<string> {
  const parts: string[] = [];
  parts.push(
    `<p><b>${polygon.type === "main" ? "Polígono principal" : escapeXml(polygon.name)}</b> · orden ${vertex.orderIndex + 1}</p>`,
  );
  parts.push(
    `<p>Lat ${vertex.latitude.toFixed(6)}, Lng ${vertex.longitude.toFixed(6)}</p>`,
  );
  if (vertex.gpsAccuracyM != null) {
    parts.push(`<p>Precisión GPS ± ${vertex.gpsAccuracyM.toFixed(1)} m</p>`);
  }
  if (vertex.altitudeM != null) {
    parts.push(`<p>Altitud ${vertex.altitudeM.toFixed(1)} m</p>`);
  }
  parts.push(`<p>Método: ${escapeXml(vertex.captureMethod.replaceAll("_", " "))}</p>`);
  const src = await photoSrcForEmbedded(vertex);
  if (src) {
    parts.push(
      `<p><img src="${src}" alt="Foto del vértice" style="max-width:480px;height:auto;" /></p>`,
    );
  }
  if (vertex.note?.trim()) {
    parts.push(`<p>Nota: ${escapeXml(vertex.note.trim())}</p>`);
  }
  return `<![CDATA[${parts.join("")}]]>`;
}

async function poiDescriptionHtml(poi: LocalPOI): Promise<string> {
  const parts: string[] = [];
  parts.push(`<p>${escapeXml(poi.label)}</p>`);
  parts.push(
    `<p>Lat ${poi.latitude.toFixed(6)}, Lng ${poi.longitude.toFixed(6)}</p>`,
  );
  if (poi.gpsAccuracyM != null) {
    parts.push(`<p>Precisión ± ${poi.gpsAccuracyM.toFixed(1)} m</p>`);
  }
  const src = await photoSrcForEmbedded(poi);
  if (src) {
    parts.push(
      `<p><img src="${src}" alt="Foto POI" style="max-width:480px;height:auto;" /></p>`,
    );
  }
  if (poi.note?.trim()) {
    parts.push(`<p>${escapeXml(poi.note.trim())}</p>`);
  }
  return `<![CDATA[${parts.join("")}]]>`;
}

function styleBlockMain(): string {
  const line = cssHexToKmlColor("#228B22", 1);
  const poly = cssHexToKmlColor("#228B22", 0.45);
  return `
  <Style id="${MAIN_POLY_STYLE_ID}">
    <LineStyle><color>${line}</color><width>3</width></LineStyle>
    <PolyStyle><color>${poly}</color></PolyStyle>
  </Style>`;
}

function styleBlockSub(localId: string, hexColor: string): string {
  const id = `${SUB_POLY_STYLE_PREFIX}${localId}`;
  const line = cssHexToKmlColor(hexColor, 1);
  const poly = cssHexToKmlColor(hexColor, 0.4);
  return `
  <Style id="${id}">
    <LineStyle><color>${line}</color><width>2.5</width></LineStyle>
    <PolyStyle><color>${poly}</color></PolyStyle>
  </Style>`;
}

/** Genera XML KML 2.2 con polígonos, vértices (foto en descripción HTML) y POIs. */
export async function buildProjectKmlXml(input: KmlProjectInput): Promise<string> {
  const { project, polygonBundles, pois } = input;
  const styles: string[] = [styleBlockMain()];
  const seenSubIds = new Set<string>();
  for (const b of polygonBundles) {
    if (b.polygon.type === "sub" && !seenSubIds.has(b.polygon.localId)) {
      seenSubIds.add(b.polygon.localId);
      styles.push(styleBlockSub(b.polygon.localId, b.polygon.color));
    }
  }

  const polygonPlacemarks: string[] = [];
  for (const bundle of polygonBundles) {
    const { polygon, vertices } = bundle;
    const sorted = sortVertices(vertices);
    if (sorted.length < 2) continue;

    const styleUrl =
      polygon.type === "main"
        ? `#${MAIN_POLY_STYLE_ID}`
        : `#${SUB_POLY_STYLE_PREFIX}${polygon.localId}`;
    const name =
      polygon.type === "main"
        ? "Polígono principal"
        : escapeXml(polygon.name);

    if (polygon.isClosed && sorted.length >= 3) {
      const polyLabel =
        polygon.type === "main" ? "Terreno principal" : polygon.name;
      const areaLine =
        polygon.areaM2 != null
          ? `<p>Área aprox.: ${polygon.areaM2.toFixed(1)} m²</p>`
          : "";
      const perLine =
        polygon.perimeterM != null
          ? `<p>Perímetro aprox.: ${polygon.perimeterM.toFixed(1)} m</p>`
          : "";
      polygonPlacemarks.push(`
    <Placemark>
      <name>${name}</name>
      <description><![CDATA[<p>${polyLabel.replaceAll("]]>", "]]]]><![CDATA[>")}</p>${areaLine}${perLine}]]></description>
      <styleUrl>${styleUrl}</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ringCoordinates(sorted)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`);
    } else {
      polygonPlacemarks.push(`
    <Placemark>
      <name>${name} (trazo abierto)</name>
      <styleUrl>${styleUrl}</styleUrl>
      <LineString>
        <coordinates>${lineCoordinates(sorted)}</coordinates>
      </LineString>
    </Placemark>`);
    }
  }

  const vertexPlacemarks: string[] = [];
  for (const bundle of polygonBundles) {
    let vi = 0;
    for (const v of sortVertices(bundle.vertices)) {
      vertexPlacemarks.push(`
    <Placemark>
      <name>${escapeXml(vertexPlacemarkName(bundle.polygon, vi))}</name>
      <description>${await vertexDescriptionHtml(v, bundle.polygon)}</description>
      <Point>
        <coordinates>${v.longitude},${v.latitude},0</coordinates>
      </Point>
    </Placemark>`);
      vi += 1;
    }
  }

  const poiPlacemarks: string[] = [];
  for (const poi of pois) {
    poiPlacemarks.push(`
    <Placemark>
      <name>${escapeXml(poi.label)}</name>
      <description>${await poiDescriptionHtml(poi)}</description>
      <Point>
        <coordinates>${poi.longitude},${poi.latitude},0</coordinates>
      </Point>
    </Placemark>`);
  }

  const docName = escapeXml(project.name);
  const docDesc = escapeXml(
    [
      project.description,
      project.locationLabel ? `Ubicación: ${project.locationLabel}` : "",
      project.clientName ? `Cliente: ${project.clientName}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "TerrainCapture",
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="${KML_NS}">
  <Document>
    <name>${docName}</name>
    <description>${docDesc}</description>
    ${styles.join("\n")}
    <Folder>
      <name>Polígonos</name>
      ${polygonPlacemarks.join("\n")}
    </Folder>
    <Folder>
      <name>Vértices</name>
      ${vertexPlacemarks.join("\n")}
    </Folder>
    <Folder>
      <name>Puntos de interés</name>
      ${poiPlacemarks.join("\n")}
    </Folder>
  </Document>
</kml>`;
}

export function buildKmlFilename(projectName: string, date: Date): string {
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
  return `${base}_${stamp}.kml`;
}

/** Descarga el KML en el navegador con nombre `{proyecto}_{fecha}.kml`. */
export async function downloadProjectKml(input: KmlProjectInput): Promise<void> {
  const xml = await buildProjectKmlXml(input);
  const blob = new Blob([xml], {
    type: "application/vnd.google-earth.kml+xml;charset=utf-8",
  });
  const filename = buildKmlFilename(input.project.name, new Date());
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

/** Carga proyecto, polígonos (principal primero, sub luego) y POIs desde Dexie. */
export async function loadProjectForKmlExport(
  projectLocalId: string,
): Promise<KmlProjectInput | null> {
  const project = await getProject(projectLocalId);
  if (!project) return null;

  const polys = await listPolygonsByProject(projectLocalId);
  const main = polys.find((p) => p.type === "main");
  const subs = polys
    .filter((p) => p.type === "sub")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const polygonBundles: KmlPolygonBundle[] = [];
  if (main) {
    polygonBundles.push({
      polygon: main,
      vertices: await listVerticesByPolygon(main.localId),
    });
  }
  for (const s of subs) {
    polygonBundles.push({
      polygon: s,
      vertices: await listVerticesByPolygon(s.localId),
    });
  }

  const pois = await listPoisByProject(projectLocalId);
  return { project, polygonBundles, pois };
}

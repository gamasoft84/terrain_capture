import type { LocalVertex } from "@/lib/db/schema";
import type { KmlProjectInput } from "@/lib/geo/kml";

/** RFC 4180 básico: comillas si hay separador, comillas o saltos. */
export function csvEscapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function csvLine(cells: (string | number | boolean | null | undefined)[]): string {
  return `${cells.map(csvEscapeCell).join(",")}\r\n`;
}

function sortVertices(v: LocalVertex[]): LocalVertex[] {
  return [...v].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** UTF-8 con BOM opcional para Excel en Windows. */
function withUtf8Bom(content: string): string {
  return `\uFEFF${content}`;
}

/** Tabla de vértices según spec: id, polygon_name, order_index, latitude, longitude, accuracy, altitude, note, photo_url */
export function buildVerticesCsv(input: KmlProjectInput): string {
  const headers = [
    "id",
    "polygon_name",
    "order_index",
    "latitude",
    "longitude",
    "accuracy",
    "altitude",
    "note",
    "photo_url",
  ];
  const lines: string[] = [csvLine(headers)];

  for (const bundle of input.polygonBundles) {
    const polygonName =
      bundle.polygon.type === "main"
        ? "Principal"
        : bundle.polygon.name;
    for (const v of sortVertices(bundle.vertices)) {
      lines.push(
        csvLine([
          v.localId,
          polygonName,
          v.orderIndex,
          v.latitude,
          v.longitude,
          v.gpsAccuracyM ?? "",
          v.altitudeM ?? "",
          v.note ?? "",
          v.photoUrl ?? "",
        ]),
      );
    }
  }

  return lines.join("");
}

/**
 * Tabla de POIs (columnas alineadas al uso típico de Excel / GIS).
 * id, label, latitude, longitude, accuracy, note, photo_url, captured_at
 */
export function buildPoisCsv(input: KmlProjectInput): string {
  const headers = [
    "id",
    "label",
    "latitude",
    "longitude",
    "accuracy",
    "note",
    "photo_url",
    "captured_at",
  ];
  const lines: string[] = [csvLine(headers)];

  for (const p of input.pois) {
    lines.push(
      csvLine([
        p.localId,
        p.label,
        p.latitude,
        p.longitude,
        p.gpsAccuracyM ?? "",
        p.note ?? "",
        p.photoUrl ?? "",
        p.capturedAt.toISOString(),
      ]),
    );
  }

  return lines.join("");
}

function buildCsvBasename(projectName: string, date: Date): string {
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
  return `${base}_${stamp}`;
}

function triggerDownload(blob: Blob, filename: string): void {
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

/** Descarga dos CSV separados: vértices y POIs (`text/csv;charset=utf-8`). */
export async function downloadProjectCsv(input: KmlProjectInput): Promise<void> {
  const base = buildCsvBasename(input.project.name, new Date());
  const verticesBlob = new Blob([withUtf8Bom(buildVerticesCsv(input))], {
    type: "text/csv;charset=utf-8",
  });
  const poisBlob = new Blob([withUtf8Bom(buildPoisCsv(input))], {
    type: "text/csv;charset=utf-8",
  });

  triggerDownload(verticesBlob, `${base}_vertices.csv`);
  await new Promise((r) => setTimeout(r, 120));
  triggerDownload(poisBlob, `${base}_pois.csv`);
}

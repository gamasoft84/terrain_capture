import JSZip from "jszip";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { buildProjectGeoJson } from "@/lib/geo/geojson";
import { buildVerticesCsv, buildPoisCsv } from "@/lib/geo/csv";
import {
  buildKmlFilename,
  buildProjectKmlXml,
  type KmlProjectInput,
} from "@/lib/geo/kml";

function safeName(input: string): string {
  const s = input.trim() || "proyecto";
  return s
    .normalize("NFKD")
    .replaceAll(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replaceAll(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

function isoDateStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
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

/**
 * ZIP comercial: KML + GeoJSON + CSV + fotos (si existen como bytes locales).
 * - No descarga desde internet: solo empaqueta lo que ya existe en Dexie.
 * - Si una foto solo tiene URL remota, se incluye en un .txt de referencias.
 */
export async function downloadProjectZip(input: KmlProjectInput): Promise<void> {
  const now = new Date();
  const base = `${safeName(input.project.name)}_${isoDateStamp(now)}`;

  const zip = new JSZip();
  const root = zip.folder(base) ?? zip;

  // Spatial files
  const kmlXml = await buildProjectKmlXml(input);
  root.file(`${base}.kml`, kmlXml);
  root.file(`${base}.geojson`, buildProjectGeoJson(input));
  root.file(`${base}_vertices.csv`, buildVerticesCsv(input));
  root.file(`${base}_pois.csv`, buildPoisCsv(input));

  // Photos
  const db = getDb();
  const photosFolder = root.folder("photos") ?? root;
  const refs: string[] = [];

  // Vertex photos
  for (const bundle of input.polygonBundles) {
    for (const v of bundle.vertices) {
      const blob = blobFromStored(v);
      if (blob && blob.size > 0) {
        const name = `vertex_P${v.orderIndex + 1}_${v.localId}.jpg`;
        photosFolder.file(name, blob);
      } else if (v.photoUrl?.startsWith("http")) {
        refs.push(`vertex,P${v.orderIndex + 1},${v.localId},${v.photoUrl}`);
      }
    }
  }

  // POI photos
  for (const poi of input.pois) {
    const blob = blobFromStored(poi);
    if (blob && blob.size > 0) {
      const name = `poi_${safeName(poi.label)}_${poi.localId}.jpg`;
      photosFolder.file(name, blob);
    } else if (poi.photoUrl?.startsWith("http")) {
      refs.push(`poi,${poi.label},${poi.localId},${poi.photoUrl}`);
    }
  }

  // Project gallery photos
  const gallery = await db.projectPhotos
    .where("projectLocalId")
    .equals(input.project.localId)
    .toArray();
  for (const ph of gallery) {
    const blob = blobFromStored(ph);
    if (blob && blob.size > 0) {
      const name = `gallery_${ph.localId}.jpg`;
      photosFolder.file(name, blob);
    } else if (ph.photoUrl?.startsWith("http")) {
      refs.push(`gallery,${ph.localId},${ph.photoUrl}`);
    }
  }

  if (refs.length > 0) {
    root.file(
      "photo-urls.txt",
      [
        "Algunas fotos no están en bytes locales; se listan aquí como URLs.",
        "formato: tipo, etiqueta/id, local_id, url",
        "",
        ...refs,
        "",
      ].join("\n"),
    );
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  await downloadBlob(blob, `${base}.zip`);
}


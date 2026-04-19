import { listPoisByProject } from "@/lib/db/pois";
import { listPolygonsByProject } from "@/lib/db/polygons";
import { listProjectPhotos } from "@/lib/db/projectPhotos";
import type { LocalPolygon, LocalVertex } from "@/lib/db/schema";
import { listVerticesByPolygon } from "@/lib/db/vertices";

export type GalleryOrigin = "vertex" | "poi" | "extra";

export type ProjectGalleryItem = {
  key: string;
  origin: GalleryOrigin;
  entityLocalId: string;
  originLabel: string;
  capturedAt: Date;
  latitude?: number;
  longitude?: number;
  caption?: string;
  photoUrl?: string;
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
  thumbnailBytes?: ArrayBuffer;
  thumbnailMime?: string;
  syncStatus?: "pending" | "synced" | "error";
  syncErrorReason?: "photo_upload";
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

/** Todas las fotos del proyecto: vértices (principal + sub), POIs y fotos adicionales. */
export async function collectProjectGallery(
  projectLocalId: string,
): Promise<ProjectGalleryItem[]> {
  const polygons = await listPolygonsByProject(projectLocalId);
  const main = polygons.find((p) => p.type === "main");
  const subs = polygons
    .filter((p) => p.type === "sub")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const orderedPolys: LocalPolygon[] = [];
  if (main) orderedPolys.push(main);
  orderedPolys.push(...subs);

  const items: ProjectGalleryItem[] = [];

  for (const poly of orderedPolys) {
    const verts = await listVerticesByPolygon(poly.localId);
    verts.sort((a, b) => a.orderIndex - b.orderIndex);
    verts.forEach((v: LocalVertex, idx: number) => {
      if (!hasRenderablePhoto(v)) return;
      const originLabel =
        poly.type === "main"
          ? `Vértice · Principal (P${idx + 1})`
          : `Vértice · ${poly.name} (P${idx + 1})`;
      items.push({
        key: `vertex:${v.localId}`,
        origin: "vertex",
        entityLocalId: v.localId,
        originLabel,
        capturedAt: v.capturedAt,
        latitude: v.latitude,
        longitude: v.longitude,
        caption: v.note,
        photoUrl: v.photoUrl,
        photoBlob: v.photoBlob,
        photoBytes: v.photoBytes,
        photoMime: v.photoMime,
        thumbnailBytes: v.thumbnailBytes,
        thumbnailMime: v.thumbnailMime,
        syncStatus: v.syncStatus,
        syncErrorReason: v.syncErrorReason,
      });
    });
  }

  const pois = await listPoisByProject(projectLocalId);
  for (const poi of pois) {
    if (!hasRenderablePhoto(poi)) continue;
    items.push({
      key: `poi:${poi.localId}`,
      origin: "poi",
      entityLocalId: poi.localId,
      originLabel: `POI · ${poi.label}`,
      capturedAt: poi.capturedAt,
      latitude: poi.latitude,
      longitude: poi.longitude,
      caption: poi.note,
      photoUrl: poi.photoUrl,
      photoBlob: poi.photoBlob,
      photoBytes: poi.photoBytes,
      photoMime: poi.photoMime,
      thumbnailBytes: poi.thumbnailBytes,
      thumbnailMime: poi.thumbnailMime,
      syncStatus: poi.syncStatus,
      syncErrorReason: poi.syncErrorReason,
    });
  }

  const extras = await listProjectPhotos(projectLocalId);
  for (const ph of extras) {
    if (!hasRenderablePhoto(ph)) continue;
    items.push({
      key: `extra:${ph.localId}`,
      origin: "extra",
      entityLocalId: ph.localId,
      originLabel: ph.caption?.trim()
        ? `Adicional · ${ph.caption.trim()}`
        : "Foto adicional",
      capturedAt: ph.capturedAt,
      latitude: ph.latitude,
      longitude: ph.longitude,
      caption: ph.caption,
      photoUrl: ph.photoUrl,
      photoBlob: ph.photoBlob,
      photoBytes: ph.photoBytes,
      photoMime: ph.photoMime,
      thumbnailBytes: ph.thumbnailBytes,
      thumbnailMime: ph.thumbnailMime,
      syncStatus: ph.syncStatus,
      syncErrorReason: ph.syncErrorReason,
    });
  }

  items.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return items;
}

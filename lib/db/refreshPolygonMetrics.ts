import { getDb } from "@/lib/db/schema";
import { calculateArea, calculatePerimeter } from "@/lib/geo/calculations";
import { listVerticesByPolygon } from "@/lib/db/vertices";
import { syncManager } from "@/lib/db/sync";

/** Recalcula área (solo si cerrado y ≥3 vértices) y perímetro del polígono en Dexie. */
export async function refreshPolygonMetricsFromVertices(
  polygonLocalId: string,
  isClosed: boolean,
): Promise<void> {
  const verts = await listVerticesByPolygon(polygonLocalId);
  await getDb()
    .polygons.where("localId")
    .equals(polygonLocalId)
    .modify((p) => {
      p.updatedAt = new Date();
      p.syncStatus = "pending";
      if (verts.length >= 2) {
        p.perimeterM = calculatePerimeter(verts, isClosed);
      } else {
        delete p.perimeterM;
      }
      if (isClosed && verts.length >= 3) {
        p.areaM2 = calculateArea(verts);
      } else {
        delete p.areaM2;
      }
    });
  void syncManager.enqueueUpdate("polygon", polygonLocalId, {});
}

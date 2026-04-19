import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalPolygon } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";

export async function getMainPolygon(
  projectLocalId: string,
): Promise<LocalPolygon | undefined> {
  return getDb()
    .polygons
    .where("projectLocalId")
    .equals(projectLocalId)
    .filter((p) => p.type === "main")
    .first();
}

export async function listPolygonsByProject(
  projectLocalId: string,
): Promise<LocalPolygon[]> {
  return getDb()
    .polygons.where("projectLocalId")
    .equals(projectLocalId)
    .toArray();
}

export async function listSubPolygonsByProject(
  projectLocalId: string,
): Promise<LocalPolygon[]> {
  const list = await listPolygonsByProject(projectLocalId);
  return list
    .filter((p) => p.type === "sub")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function createPolygon(
  input: Omit<
    LocalPolygon,
    "localId" | "createdAt" | "updatedAt" | "syncStatus"
  > & { localId?: string },
): Promise<string> {
  const db = getDb();
  const localId = input.localId ?? nanoid();
  const now = new Date();
  await db.polygons.add({
    ...input,
    localId,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  });
  void syncManager.enqueueCreate("polygon", localId, {});
  return localId;
}

export async function updatePolygon(
  localId: string,
  patch: Partial<
    Pick<
      LocalPolygon,
      "name" | "color" | "areaM2" | "perimeterM" | "isClosed"
    >
  >,
): Promise<void> {
  const db = getDb();
  await db.polygons.update(localId, {
    ...patch,
    updatedAt: new Date(),
    syncStatus: "pending",
  });
  void syncManager.enqueueUpdate("polygon", localId, {});
}

/** Borra el polígono y todos sus vértices (Dexie). No aplicar al polígono principal. */
export async function deletePolygonCascade(
  polygonLocalId: string,
): Promise<void> {
  const db = getDb();
  const row = await db.polygons.get(polygonLocalId);
  if (!row || row.type === "main") {
    throw new Error("Solo se pueden eliminar sub-polígonos de forma explícita.");
  }
  if (row.serverId) {
    void syncManager.enqueueDelete("polygon", polygonLocalId, {
      serverId: row.serverId,
    });
  }
  await db.transaction("rw", db.vertices, db.polygons, async () => {
    await db.vertices.where("polygonLocalId").equals(polygonLocalId).delete();
    await db.polygons.delete(polygonLocalId);
  });
}

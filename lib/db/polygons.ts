import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalPolygon } from "@/lib/db/schema";

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
}

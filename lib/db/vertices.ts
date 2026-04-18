import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalVertex } from "@/lib/db/schema";

export async function listVerticesByPolygon(
  polygonLocalId: string,
): Promise<LocalVertex[]> {
  const list = await getDb()
    .vertices.where("polygonLocalId")
    .equals(polygonLocalId)
    .toArray();
  list.sort((a, b) => a.orderIndex - b.orderIndex);
  return list;
}

export async function createVertex(
  input: Omit<
    LocalVertex,
    "localId" | "capturedAt" | "syncStatus" | "orderIndex"
  > & {
    orderIndex: number;
    localId?: string;
  },
): Promise<string> {
  const db = getDb();
  const localId = input.localId ?? nanoid();
  await db.vertices.add({
    ...input,
    localId,
    capturedAt: new Date(),
    syncStatus: "pending",
  });
  return localId;
}

export async function deleteVertex(localId: string): Promise<void> {
  await getDb().vertices.delete(localId);
}

export async function updateVertex(
  localId: string,
  patch: Partial<
    Pick<LocalVertex, "note" | "photoBlob" | "photoUrl" | "gpsAccuracyM">
  >,
): Promise<void> {
  await getDb().vertices.update(localId, patch);
}

export async function nextOrderIndexForPolygon(
  polygonLocalId: string,
): Promise<number> {
  const list = await getDb()
    .vertices.where("polygonLocalId")
    .equals(polygonLocalId)
    .toArray();
  if (list.length === 0) return 0;
  return Math.max(...list.map((v) => v.orderIndex)) + 1;
}

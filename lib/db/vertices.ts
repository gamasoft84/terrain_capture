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

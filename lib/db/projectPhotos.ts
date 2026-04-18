import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalProjectPhoto } from "@/lib/db/schema";

export async function listProjectPhotos(
  projectLocalId: string,
): Promise<LocalProjectPhoto[]> {
  return getDb()
    .projectPhotos.where("projectLocalId")
    .equals(projectLocalId)
    .sortBy("capturedAt");
}

export async function createProjectPhoto(
  input: Omit<
    LocalProjectPhoto,
    "localId" | "capturedAt" | "syncStatus"
  > & { localId?: string },
): Promise<string> {
  const db = getDb();
  const localId = input.localId ?? nanoid();
  await db.projectPhotos.add({
    ...input,
    localId,
    capturedAt: new Date(),
    syncStatus: "pending",
  });
  return localId;
}

export async function deleteProjectPhoto(localId: string): Promise<void> {
  await getDb().projectPhotos.delete(localId);
}

import { nanoid } from "nanoid";
import { preparePhotoBlobForDexie } from "@/lib/db/preparePhotoBlobForDexie";
import { getDb } from "@/lib/db/schema";
import type { LocalProjectPhoto } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";

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
  const { photoBlob: rawPhoto, ...rest } = input;

  let photoBytes: ArrayBuffer | undefined;
  let photoMime: string | undefined;
  if (rawPhoto != null) {
    const prepared = await preparePhotoBlobForDexie(rawPhoto);
    photoMime = prepared.type || "image/jpeg";
    photoBytes = await prepared.arrayBuffer();
  }

  const core: LocalProjectPhoto = {
    ...rest,
    localId,
    capturedAt: new Date(),
    syncStatus: "pending",
  };

  if (photoBytes == null) {
    await db.projectPhotos.add(core);
  } else {
    await db.transaction("rw", db.projectPhotos, async () => {
      await db.projectPhotos.add(core);
      await db.projectPhotos.update(localId, { photoBytes, photoMime });
    });
  }
  void syncManager.enqueueCreate("photo", localId, {});
  return localId;
}

export async function deleteProjectPhoto(localId: string): Promise<void> {
  const db = getDb();
  const row = await db.projectPhotos.get(localId);
  if (row?.serverId) {
    void syncManager.enqueueDelete("photo", localId, {
      serverId: row.serverId,
    });
  }
  await db.projectPhotos.delete(localId);
}

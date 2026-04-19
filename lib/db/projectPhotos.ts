import { nanoid } from "nanoid";
import { preparePhotoForDexie } from "@/lib/db/preparePhotoBlobForDexie";
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
  let thumbnailBytes: ArrayBuffer | undefined;
  let thumbnailMime: string | undefined;
  if (rawPhoto != null) {
    const prepared = await preparePhotoForDexie(rawPhoto);
    photoMime = prepared.photo.type || "image/jpeg";
    photoBytes = await prepared.photo.arrayBuffer();
    if (prepared.thumbnail != null && prepared.thumbnail.size > 0) {
      thumbnailMime = prepared.thumbnail.type || "image/webp";
      thumbnailBytes = await prepared.thumbnail.arrayBuffer();
    }
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
      await db.projectPhotos.update(localId, {
        photoBytes,
        photoMime,
        ...(thumbnailBytes != null && thumbnailBytes.byteLength > 0
          ? { thumbnailBytes, thumbnailMime }
          : {}),
      });
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

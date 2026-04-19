import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalPOI } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";
import { logDexieBlobFailure } from "@/lib/db/logDexieBlobFailure";
import { preparePhotoForDexie } from "@/lib/db/preparePhotoBlobForDexie";

export async function listPoisByProject(
  projectLocalId: string,
): Promise<LocalPOI[]> {
  const rows = await getDb()
    .pois.where("projectLocalId")
    .equals(projectLocalId)
    .toArray();
  rows.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return rows;
}

export async function createPOI(
  input: Omit<LocalPOI, "localId" | "capturedAt" | "syncStatus"> & {
    localId?: string;
    photoBlob?: Blob;
  },
): Promise<string> {
  const db = getDb();
  const localId = input.localId ?? nanoid();
  const { photoBlob: rawPhoto, ...rest } = input;

  let photoBytes: ArrayBuffer | undefined;
  let photoMime: string | undefined;
  let thumbnailBytes: ArrayBuffer | undefined;
  let thumbnailMime: string | undefined;
  if (rawPhoto != null) {
    try {
      const prepared = await preparePhotoForDexie(rawPhoto);
      photoMime = prepared.photo.type || "image/jpeg";
      photoBytes = await prepared.photo.arrayBuffer();
      if (prepared.thumbnail != null && prepared.thumbnail.size > 0) {
        thumbnailMime = prepared.thumbnail.type || "image/webp";
        thumbnailBytes = await prepared.thumbnail.arrayBuffer();
      }
    } catch (prepErr) {
      await logDexieBlobFailure(
        "preparePhotoForDexie (createPOI)",
        prepErr,
        {
          localId,
          projectLocalId: rest.projectLocalId,
          label: rest.label,
          rawSize: rawPhoto.size,
          rawType: rawPhoto.type,
        },
      );
      throw prepErr;
    }
  }

  const core: LocalPOI = {
    ...rest,
    localId,
    capturedAt: new Date(),
    syncStatus: "pending",
  };

  try {
    if (photoBytes == null) {
      await db.pois.add(core);
    } else {
      await db.transaction("rw", db.pois, async () => {
        await db.pois.add(core);
        await db.pois.update(localId, {
          photoBytes,
          photoMime,
          ...(thumbnailBytes != null && thumbnailBytes.byteLength > 0
            ? { thumbnailBytes, thumbnailMime }
            : {}),
        });
      });
    }
  } catch (err) {
    await logDexieBlobFailure(
      photoBytes == null ? "pois.add" : "pois.add+update(photoBytes)",
      err,
      {
        localId: core.localId,
        projectLocalId: core.projectLocalId,
        label: core.label,
        photoBytesLength: photoBytes?.byteLength,
        photoMime,
      },
    );
    throw err;
  }

  void syncManager.enqueueCreate("poi", localId, {});

  return localId;
}

export async function updatePOI(
  localId: string,
  patch: Partial<
    Pick<
      LocalPOI,
      | "label"
      | "note"
      | "photoBlob"
      | "photoUrl"
      | "latitude"
      | "longitude"
      | "gpsAccuracyM"
    >
  >,
): Promise<void> {
  const db = getDb();

  if (patch.photoBlob != null) {
    let photoBytes: ArrayBuffer;
    let photoMime: string;
    let thumbnailBytes: ArrayBuffer | undefined;
    let thumbnailMime: string | undefined;
    try {
      const prepared = await preparePhotoForDexie(patch.photoBlob);
      photoMime = prepared.photo.type || "image/jpeg";
      photoBytes = await prepared.photo.arrayBuffer();
      if (prepared.thumbnail != null && prepared.thumbnail.size > 0) {
        thumbnailMime = prepared.thumbnail.type || "image/webp";
        thumbnailBytes = await prepared.thumbnail.arrayBuffer();
      }
    } catch (prepErr) {
      await logDexieBlobFailure(
        "preparePhotoForDexie (updatePOI)",
        prepErr,
        {
          localId,
          rawSize: patch.photoBlob.size,
          rawType: patch.photoBlob.type,
        },
      );
      throw prepErr;
    }
    const rest = { ...patch };
    delete rest.photoBlob;
    try {
      await db.pois.where("localId").equals(localId).modify((row) => {
        Object.assign(row, rest, {
          photoBytes,
          photoMime,
          syncStatus: "pending",
        });
        delete row.photoBlob;
        if (thumbnailBytes != null && thumbnailBytes.byteLength > 0) {
          row.thumbnailBytes = thumbnailBytes;
          row.thumbnailMime = thumbnailMime;
        } else {
          delete row.thumbnailBytes;
          delete row.thumbnailMime;
        }
      });
    } catch (err) {
      await logDexieBlobFailure("pois.modify(photoBytes)", err, {
        localId,
        patchKeys: Object.keys(rest),
        photoBytesLength: photoBytes.byteLength,
        photoMime,
      });
      throw err;
    }
    void syncManager.enqueueUpdate("poi", localId, {});
    return;
  }

  try {
    await db.pois.update(localId, {
      ...patch,
      syncStatus: "pending",
    });
  } catch (err) {
    await logDexieBlobFailure("pois.update", err, {
      localId,
      patchKeys: Object.keys(patch),
    });
    throw err;
  }
  void syncManager.enqueueUpdate("poi", localId, {});
}

export async function deletePOI(localId: string): Promise<void> {
  const db = getDb();
  const row = await db.pois.get(localId);
  if (row?.serverId) {
    void syncManager.enqueueDelete("poi", localId, { serverId: row.serverId });
  }
  await db.pois.delete(localId);
}

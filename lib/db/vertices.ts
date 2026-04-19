import { nanoid } from "nanoid";
import { dexieDebugInfo } from "@/lib/db/dexieDebugLog";
import { logDexieBlobFailure } from "@/lib/db/logDexieBlobFailure";
import { preparePhotoForDexie } from "@/lib/db/preparePhotoBlobForDexie";
import { getDb } from "@/lib/db/schema";
import type { LocalVertex } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";

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
      await logDexieBlobFailure("preparePhotoForDexie (createVertex)", prepErr, {
        localId,
        polygonLocalId: rest.polygonLocalId,
        orderIndex: rest.orderIndex,
        rawSize: rawPhoto.size,
        rawType: rawPhoto.type,
        rawCtor: rawPhoto.constructor.name,
      });
      throw prepErr;
    }
  }

  const core: LocalVertex = {
    ...rest,
    localId,
    capturedAt: new Date(),
    syncStatus: "pending",
  };

  try {
    if (photoBytes == null) {
      await db.vertices.add(core);
    } else {
      dexieDebugInfo("createVertex 2 pasos (add → update photoBytes)", {
        localId,
        byteLength: photoBytes.byteLength,
        photoMime,
        thumbLength: thumbnailBytes?.byteLength,
      });
      await db.transaction("rw", db.vertices, async () => {
        await db.vertices.add(core);
        await db.vertices.update(localId, {
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
      photoBytes == null ? "vertices.add" : "vertices.add+update(photoBytes)",
      err,
      {
        localId: core.localId,
        polygonLocalId: core.polygonLocalId,
        orderIndex: core.orderIndex,
        captureMethod: core.captureMethod,
        lat: core.latitude,
        lon: core.longitude,
        photoBytesLength: photoBytes?.byteLength,
        photoMime,
      },
    );
    throw err;
  }

  void syncManager.enqueueCreate("vertex", localId, {});

  return localId;
}

export async function deleteVertex(localId: string): Promise<void> {
  const db = getDb();
  const row = await db.vertices.get(localId);
  if (row?.serverId) {
    void syncManager.enqueueDelete("vertex", localId, {
      serverId: row.serverId,
    });
  }
  await db.vertices.delete(localId);
}

export async function updateVertex(
  localId: string,
  patch: Partial<
    Pick<
      LocalVertex,
      | "note"
      | "photoBlob"
      | "photoUrl"
      | "gpsAccuracyM"
      | "latitude"
      | "longitude"
      | "captureMethod"
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
        "preparePhotoForDexie (updateVertex)",
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
      await db.vertices.where("localId").equals(localId).modify((v) => {
        Object.assign(v, rest, {
          photoBytes,
          photoMime,
          syncStatus: "pending",
        });
        delete v.photoBlob;
        if (thumbnailBytes != null && thumbnailBytes.byteLength > 0) {
          v.thumbnailBytes = thumbnailBytes;
          v.thumbnailMime = thumbnailMime;
        } else {
          delete v.thumbnailBytes;
          delete v.thumbnailMime;
        }
      });
    } catch (err) {
      await logDexieBlobFailure("vertices.modify(photoBytes)", err, {
        localId,
        patchKeys: Object.keys(rest),
        photoBytesLength: photoBytes.byteLength,
        photoMime,
      });
      throw err;
    }
    void syncManager.enqueueUpdate("vertex", localId, {});
    return;
  }

  try {
    await db.vertices.update(localId, {
      ...patch,
      syncStatus: "pending",
    });
  } catch (err) {
    await logDexieBlobFailure("vertices.update", err, {
      localId,
      patchKeys: Object.keys(patch),
      hasLegacyPhotoBlob: patch.photoBlob != null,
    });
    throw err;
  }
  void syncManager.enqueueUpdate("vertex", localId, {});
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

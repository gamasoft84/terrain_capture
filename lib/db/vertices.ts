import { nanoid } from "nanoid";
import { dexieDebugInfo } from "@/lib/db/dexieDebugLog";
import { logDexieBlobFailure } from "@/lib/db/logDexieBlobFailure";
import { preparePhotoBlobForDexie } from "@/lib/db/preparePhotoBlobForDexie";
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
  const { photoBlob: rawPhoto, ...rest } = input;

  let photoBytes: ArrayBuffer | undefined;
  let photoMime: string | undefined;
  if (rawPhoto != null) {
    try {
      const prepared = await preparePhotoBlobForDexie(rawPhoto);
      photoMime = prepared.type || "image/jpeg";
      photoBytes = await prepared.arrayBuffer();
    } catch (prepErr) {
      await logDexieBlobFailure("preparePhotoBlobForDexie (createVertex)", prepErr, {
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
      });
      await db.transaction("rw", db.vertices, async () => {
        await db.vertices.add(core);
        await db.vertices.update(localId, { photoBytes, photoMime });
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

  return localId;
}

export async function deleteVertex(localId: string): Promise<void> {
  await getDb().vertices.delete(localId);
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
    try {
      const prepared = await preparePhotoBlobForDexie(patch.photoBlob);
      photoMime = prepared.type || "image/jpeg";
      photoBytes = await prepared.arrayBuffer();
    } catch (prepErr) {
      await logDexieBlobFailure(
        "preparePhotoBlobForDexie (updateVertex)",
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
        Object.assign(v, rest, { photoBytes, photoMime });
        delete v.photoBlob;
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
    return;
  }

  try {
    await db.vertices.update(localId, patch);
  } catch (err) {
    await logDexieBlobFailure("vertices.update", err, {
      localId,
      patchKeys: Object.keys(patch),
      hasLegacyPhotoBlob: patch.photoBlob != null,
    });
    throw err;
  }
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

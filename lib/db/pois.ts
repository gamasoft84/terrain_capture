import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalPOI } from "@/lib/db/schema";
import { logDexieBlobFailure } from "@/lib/db/logDexieBlobFailure";
import { preparePhotoBlobForDexie } from "@/lib/db/preparePhotoBlobForDexie";

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
  if (rawPhoto != null) {
    try {
      const prepared = await preparePhotoBlobForDexie(rawPhoto);
      photoMime = prepared.type || "image/jpeg";
      photoBytes = await prepared.arrayBuffer();
    } catch (prepErr) {
      await logDexieBlobFailure(
        "preparePhotoBlobForDexie (createPOI)",
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
        await db.pois.update(localId, { photoBytes, photoMime });
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
    try {
      const prepared = await preparePhotoBlobForDexie(patch.photoBlob);
      photoMime = prepared.type || "image/jpeg";
      photoBytes = await prepared.arrayBuffer();
    } catch (prepErr) {
      await logDexieBlobFailure(
        "preparePhotoBlobForDexie (updatePOI)",
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
        Object.assign(row, rest, { photoBytes, photoMime });
        delete row.photoBlob;
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
    return;
  }

  try {
    await db.pois.update(localId, patch);
  } catch (err) {
    await logDexieBlobFailure("pois.update", err, {
      localId,
      patchKeys: Object.keys(patch),
    });
    throw err;
  }
}

export async function deletePOI(localId: string): Promise<void> {
  await getDb().pois.delete(localId);
}

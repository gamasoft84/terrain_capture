import type { GalleryOrigin } from "@/lib/gallery/collectProjectGallery";
import { getDb } from "@/lib/db/schema";
import { syncManager, type SyncEntityType } from "@/lib/db/sync";

export async function recreateAfterRemoteDeletion(
  entityType: SyncEntityType,
  localId: string,
): Promise<void> {
  const db = getDb();
  switch (entityType) {
    case "vertex":
      await db.vertices.update(localId, {
        syncConflict: undefined,
        syncStatus: "pending",
      });
      break;
    case "poi":
      await db.pois.update(localId, {
        syncConflict: undefined,
        syncStatus: "pending",
      });
      break;
    case "polygon":
      await db.polygons.update(localId, {
        syncConflict: undefined,
        syncStatus: "pending",
      });
      break;
    case "project":
      await db.projects.update(localId, {
        syncConflict: undefined,
        syncStatus: "pending",
      });
      break;
    case "photo":
      await db.projectPhotos.update(localId, {
        syncConflict: undefined,
        syncStatus: "pending",
      });
      break;
    default:
      return;
  }
  await syncManager.enqueueCreate(entityType, localId, {});
}

export async function retryVertexPhotoUploadSync(localId: string): Promise<void> {
  const db = getDb();
  await db.vertices.update(localId, {
    syncStatus: "pending",
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  });
  const row = await db.vertices.get(localId);
  if (!row) return;
  if (row.serverId) {
    await syncManager.enqueueUpdate("vertex", localId, {});
  } else {
    await syncManager.enqueueCreate("vertex", localId, {});
  }
}

export async function retryPoiPhotoUploadSync(localId: string): Promise<void> {
  const db = getDb();
  await db.pois.update(localId, {
    syncStatus: "pending",
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  });
  const row = await db.pois.get(localId);
  if (!row) return;
  if (row.serverId) {
    await syncManager.enqueueUpdate("poi", localId, {});
  } else {
    await syncManager.enqueueCreate("poi", localId, {});
  }
}

export async function retryProjectPhotoUploadSync(localId: string): Promise<void> {
  const db = getDb();
  await db.projectPhotos.update(localId, {
    syncStatus: "pending",
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  });
  const row = await db.projectPhotos.get(localId);
  if (!row) return;
  if (row.serverId) {
    await syncManager.enqueueUpdate("photo", localId, {});
  } else {
    await syncManager.enqueueCreate("photo", localId, {});
  }
}

export async function retryGalleryItemPhotoSync(
  origin: GalleryOrigin,
  entityLocalId: string,
): Promise<void> {
  if (origin === "vertex") return retryVertexPhotoUploadSync(entityLocalId);
  if (origin === "poi") return retryPoiPhotoUploadSync(entityLocalId);
  return retryProjectPhotoUploadSync(entityLocalId);
}

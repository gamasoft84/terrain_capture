import type { SyncQueueEntry } from "@/lib/db/schema";
import { getDb } from "@/lib/db/schema";
import {
  MAX_PHOTO_UPLOAD_ATTEMPTS,
  formatSyncError,
  isPhotoUploadExhaustedError,
  isRemoteEntityGoneError,
  type PhotoUploadExhaustedError,
  type RemoteEntityGoneError,
} from "@/lib/db/sync/errors";
import {
  remoteDelete,
  remoteInsertPolygon,
  remoteInsertPoi,
  remoteInsertProject,
  remoteInsertProjectPhoto,
  remoteInsertVertex,
  remoteUpdatePolygon,
  remoteUpdatePoi,
  remoteUpdateProject,
  remoteUpdateProjectPhoto,
  remoteUpdateVertex,
} from "@/lib/db/sync/processRemote";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MAX_ATTEMPTS = 5;
const BACKOFF_CAP_MS = 32_000;

export type SyncEntityType = SyncQueueEntry["entityType"];

export type SyncPhase = "idle" | "running";

export type SyncStatusSnapshot = {
  phase: SyncPhase;
  pendingCount: number;
  processingId: number | null;
  lastError?: string;
};

export type SyncResult = {
  processed: number;
  deferred: number;
  failedThisRun: number;
};

function typeRank(t: SyncEntityType): number {
  if (t === "project") return 0;
  if (t === "polygon" || t === "poi" || t === "photo") return 1;
  if (t === "vertex") return 2;
  return 9;
}

function backoffMs(attemptAfterFailure: number): number {
  return Math.min(BACKOFF_CAP_MS, 1000 * 2 ** Math.max(0, attemptAfterFailure - 1));
}

async function fetchPendingSorted(): Promise<SyncQueueEntry[]> {
  const rows = await getDb()
    .syncQueue.where("status")
    .equals("pending")
    .toArray();
  rows.sort((a, b) => {
    const ra = typeRank(a.entityType);
    const rb = typeRank(b.entityType);
    if (ra !== rb) return ra - rb;
    const ca = a.createdAt.getTime();
    const cb = b.createdAt.getTime();
    if (ca !== cb) return ca - cb;
    return (a.id ?? 0) - (b.id ?? 0);
  });
  return rows;
}

function readyForRetry(entry: SyncQueueEntry): boolean {
  const attempts = entry.attemptCount ?? 0;
  if (attempts <= 0 || entry.lastAttempt == null) return true;
  const need = backoffMs(attempts);
  return Date.now() - entry.lastAttempt.getTime() >= need;
}

export class SyncManager {
  private subscribers = new Set<(s: SyncStatusSnapshot) => void>();

  subscribe(callback: (status: SyncStatusSnapshot) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(partial?: Partial<SyncStatusSnapshot>): void {
    void this.pendingCount().then((pendingCount) => {
      const snapshot: SyncStatusSnapshot = {
        phase: partial?.phase ?? "idle",
        pendingCount,
        processingId: partial?.processingId ?? null,
        lastError: partial?.lastError,
      };
      for (const cb of this.subscribers) {
        try {
          cb(snapshot);
        } catch {
          /* no romper otros listeners */
        }
      }
    });
  }

  async pendingCount(): Promise<number> {
    const db = getDb();
    const pending = await db.syncQueue.where("status").equals("pending").count();
    const processing = await db.syncQueue.where("status").equals("processing").count();
    return pending + processing;
  }

  async enqueueCreate(
    entityType: SyncEntityType,
    entityLocalId: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.enqueue("create", entityType, entityLocalId, payload);
  }

  async enqueueUpdate(
    entityType: SyncEntityType,
    entityLocalId: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.enqueue("update", entityType, entityLocalId, payload);
  }

  async enqueueDelete(
    entityType: SyncEntityType,
    entityLocalId: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.enqueue("delete", entityType, entityLocalId, payload);
  }

  private async enqueue(
    action: SyncQueueEntry["action"],
    entityType: SyncEntityType,
    entityLocalId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const db = getDb();
    await db.transaction("rw", db.syncQueue, async () => {
      const dupes = await db.syncQueue
        .where("entityLocalId")
        .equals(entityLocalId)
        .filter(
          (e) =>
            e.status === "pending" &&
            e.action === action &&
            e.entityType === entityType,
        )
        .toArray();
      for (const d of dupes) {
        if (d.id != null) await db.syncQueue.delete(d.id);
      }
      await db.syncQueue.add({
        entityType,
        entityLocalId,
        action,
        payload,
        attemptCount: 0,
        status: "pending",
        createdAt: new Date(),
      });
    });
    this.notify({ phase: "idle" });
  }

  async retryFailed(): Promise<void> {
    const db = getDb();
    const failed = await db.syncQueue.where("status").equals("failed").toArray();
    await db.transaction("rw", db.syncQueue, async () => {
      for (const row of failed) {
        if (row.id == null) continue;
        await db.syncQueue.update(row.id, {
          status: "pending",
          attemptCount: 0,
          lastAttempt: undefined,
          errorMessage: undefined,
        });
      }
    });
    this.notify({ phase: "idle" });
  }

  async deleteQueueEntry(id: number): Promise<void> {
    await getDb().syncQueue.delete(id);
    this.notify({ phase: "idle" });
  }

  async clearQueue(statuses?: Array<SyncQueueEntry["status"]>): Promise<void> {
    const db = getDb();
    const toClear = statuses?.length
      ? await db.syncQueue.where("status").anyOf(statuses).toArray()
      : await db.syncQueue.toArray();

    await db.transaction("rw", db.syncQueue, async () => {
      for (const row of toClear) {
        if (row.id != null) await db.syncQueue.delete(row.id);
      }
    });
    this.notify({ phase: "idle" });
  }

  async processQueue(): Promise<SyncResult> {
    const client = createBrowserSupabaseClient();
    let processed = 0;
    let deferred = 0;
    let failedThisRun = 0;

    this.notify({ phase: "running", processingId: null });

    let stagnant = 0;
    while (stagnant < 3) {
      const sorted = await fetchPendingSorted();
      const batch = sorted.filter((e) => readyForRetry(e));
      if (batch.length === 0) break;

      let progressed = false;

      for (const entry of batch) {
        if (entry.id == null) continue;
        const can = await this.canProcess(entry);
        if (!can) {
          deferred++;
          continue;
        }

        await getDb().syncQueue.update(entry.id, { status: "processing" });
        this.notify({ phase: "running", processingId: entry.id });

        try {
          await this.applyEntryWithConflictHandling(client, entry);
          await getDb().syncQueue.delete(entry.id);
          processed++;
          progressed = true;
          stagnant = 0;
          this.notify({ phase: "running", processingId: null });
        } catch (err) {
          const msg = formatSyncError(err);
          const nextAttempts = (entry.attemptCount ?? 0) + 1;
          const lastAttempt = new Date();

          if (nextAttempts >= MAX_ATTEMPTS) {
            await getDb().syncQueue.update(entry.id, {
              status: "failed",
              attemptCount: nextAttempts,
              lastAttempt,
              errorMessage: msg,
            });
          } else {
            await getDb().syncQueue.update(entry.id, {
              status: "pending",
              attemptCount: nextAttempts,
              lastAttempt,
              errorMessage: msg,
            });
          }
          failedThisRun++;
          progressed = true;
          stagnant = 0;
          this.notify({ phase: "running", processingId: null, lastError: msg });
        }
      }

      if (!progressed) stagnant++;
    }

    this.notify({ phase: "idle", processingId: null });
    return { processed, deferred, failedThisRun };
  }

  private async canProcess(entry: SyncQueueEntry): Promise<boolean> {
    if (entry.action === "delete") {
      return typeof entry.payload.serverId === "string";
    }

    const db = getDb();
    switch (entry.entityType) {
      case "project":
        return true;
      case "polygon": {
        const poly = await db.polygons.get(entry.entityLocalId);
        if (!poly) return false;
        const proj = await db.projects.get(poly.projectLocalId);
        return !!proj?.serverId;
      }
      case "vertex": {
        const v = await db.vertices.get(entry.entityLocalId);
        if (!v) return false;
        const poly = await db.polygons.get(v.polygonLocalId);
        return !!poly?.serverId;
      }
      case "poi": {
        const poi = await db.pois.get(entry.entityLocalId);
        if (!poi) return false;
        const proj = await db.projects.get(poi.projectLocalId);
        return !!proj?.serverId;
      }
      case "photo": {
        const photo = await db.projectPhotos.get(entry.entityLocalId);
        if (!photo) return false;
        const proj = await db.projects.get(photo.projectLocalId);
        return !!proj?.serverId;
      }
      default:
        return false;
    }
  }

  private async applyEntryWithConflictHandling(
    client: ReturnType<typeof createBrowserSupabaseClient>,
    entry: SyncQueueEntry,
  ): Promise<void> {
    try {
      await this.applyEntry(client, entry);
    } catch (e) {
      if (isRemoteEntityGoneError(e)) {
        await this.handleRemoteEntityGone(e);
        return;
      }
      if (isPhotoUploadExhaustedError(e)) {
        await this.handlePhotoUploadExhausted(e);
        return;
      }
      throw e;
    }
  }

  private async handleRemoteEntityGone(err: RemoteEntityGoneError): Promise<void> {
    const db = getDb();
    switch (err.entityType) {
      case "vertex":
        await db.vertices.update(err.localId, {
          serverId: undefined,
          syncConflict: "remote_deleted",
          syncStatus: "pending",
          syncErrorReason: undefined,
        });
        return;
      case "poi":
        await db.pois.update(err.localId, {
          serverId: undefined,
          syncConflict: "remote_deleted",
          syncStatus: "pending",
          syncErrorReason: undefined,
        });
        return;
      case "polygon":
        await db.polygons.update(err.localId, {
          serverId: undefined,
          syncConflict: "remote_deleted",
          syncStatus: "pending",
        });
        return;
      case "project":
        await db.projects.update(err.localId, {
          serverId: undefined,
          syncConflict: "remote_deleted",
          syncStatus: "pending",
        });
        return;
      case "photo":
        await db.projectPhotos.update(err.localId, {
          serverId: undefined,
          syncConflict: "remote_deleted",
          syncStatus: "pending",
          syncErrorReason: undefined,
        });
        return;
      default:
        return;
    }
  }

  private async handlePhotoUploadExhausted(
    err: PhotoUploadExhaustedError,
  ): Promise<void> {
    const db = getDb();
    const payload = {
      syncStatus: "error" as const,
      syncErrorReason: "photo_upload" as const,
      photoUploadAttempts: MAX_PHOTO_UPLOAD_ATTEMPTS,
    };
    switch (err.entityType) {
      case "vertex":
        await db.vertices.update(err.localId, payload);
        return;
      case "poi":
        await db.pois.update(err.localId, payload);
        return;
      case "photo":
        await db.projectPhotos.update(err.localId, payload);
        return;
      default:
        return;
    }
  }

  private async applyEntry(
    client: ReturnType<typeof createBrowserSupabaseClient>,
    entry: SyncQueueEntry,
  ): Promise<void> {
    const db = getDb();

    if (entry.action === "delete") {
      const sid = entry.payload.serverId as string | undefined;
      if (!sid) throw new Error("delete sin serverId en payload");
      const table =
        entry.entityType === "project"
          ? "projects"
          : entry.entityType === "polygon"
            ? "polygons"
            : entry.entityType === "vertex"
              ? "vertices"
              : entry.entityType === "poi"
                ? "points_of_interest"
                : "project_photos";
      await remoteDelete(client, table, sid);
      return;
    }

    if (entry.entityType === "project") {
      const row = await db.projects.get(entry.entityLocalId);
      if (!row) throw new Error("Proyecto local no encontrado");
      if (entry.action === "create") {
        if (row.serverId) {
          await remoteUpdateProject(client, row, row.serverId);
          await db.projects.update(row.localId, {
            syncStatus: "synced",
            syncConflict: undefined,
          });
          return;
        }
        const id = await remoteInsertProject(client, row);
        await db.projects.update(row.localId, {
          serverId: id,
          syncStatus: "synced",
          syncConflict: undefined,
        });
        return;
      }
      if (!row.serverId) throw new Error("Proyecto sin serverId para actualizar");
      await remoteUpdateProject(client, row, row.serverId);
      await db.projects.update(row.localId, {
        syncStatus: "synced",
        syncConflict: undefined,
      });
      return;
    }

    if (entry.entityType === "polygon") {
      const row = await db.polygons.get(entry.entityLocalId);
      if (!row) throw new Error("Polígono local no encontrado");
      const proj = await db.projects.get(row.projectLocalId);
      if (!proj?.serverId) throw new Error("Proyecto padre sin serverId");

      if (entry.action === "create") {
        if (row.serverId) {
          await remoteUpdatePolygon(client, row, row.serverId);
          await db.polygons.update(row.localId, {
            syncStatus: "synced",
            syncConflict: undefined,
          });
          return;
        }
        const id = await remoteInsertPolygon(client, row, proj.serverId);
        await db.polygons.update(row.localId, {
          serverId: id,
          syncStatus: "synced",
          syncConflict: undefined,
        });
        return;
      }
      if (!row.serverId) throw new Error("Polígono sin serverId");
      await remoteUpdatePolygon(client, row, row.serverId);
      await db.polygons.update(row.localId, {
        syncStatus: "synced",
        syncConflict: undefined,
      });
      return;
    }

    if (entry.entityType === "vertex") {
      const row = await db.vertices.get(entry.entityLocalId);
      if (!row) throw new Error("Vértice local no encontrado");
      const poly = await db.polygons.get(row.polygonLocalId);
      if (!poly?.serverId) throw new Error("Polígono padre sin serverId");

      if (entry.action === "create") {
        if (row.serverId) {
          await remoteUpdateVertex(client, row, row.serverId);
          await db.vertices.update(row.localId, {
            syncStatus: "synced",
            syncConflict: undefined,
            syncErrorReason: undefined,
            photoUploadAttempts: 0,
          });
          return;
        }
        const id = await remoteInsertVertex(client, row, poly.serverId);
        await db.vertices.update(row.localId, {
          serverId: id,
          syncStatus: "synced",
          syncConflict: undefined,
          syncErrorReason: undefined,
          photoUploadAttempts: 0,
        });
        return;
      }
      if (!row.serverId) throw new Error("Vértice sin serverId");
      await remoteUpdateVertex(client, row, row.serverId);
      await db.vertices.update(row.localId, {
        syncStatus: "synced",
        syncConflict: undefined,
        syncErrorReason: undefined,
        photoUploadAttempts: 0,
      });
      return;
    }

    if (entry.entityType === "poi") {
      const row = await db.pois.get(entry.entityLocalId);
      if (!row) throw new Error("POI local no encontrado");
      const proj = await db.projects.get(row.projectLocalId);
      if (!proj?.serverId) throw new Error("Proyecto padre sin serverId");

      if (entry.action === "create") {
        if (row.serverId) {
          await remoteUpdatePoi(client, row, row.serverId);
          await db.pois.update(row.localId, {
            syncStatus: "synced",
            syncConflict: undefined,
            syncErrorReason: undefined,
            photoUploadAttempts: 0,
          });
          return;
        }
        const id = await remoteInsertPoi(client, row, proj.serverId);
        await db.pois.update(row.localId, {
          serverId: id,
          syncStatus: "synced",
          syncConflict: undefined,
          syncErrorReason: undefined,
          photoUploadAttempts: 0,
        });
        return;
      }
      if (!row.serverId) throw new Error("POI sin serverId");
      await remoteUpdatePoi(client, row, row.serverId);
      await db.pois.update(row.localId, {
        syncStatus: "synced",
        syncConflict: undefined,
        syncErrorReason: undefined,
        photoUploadAttempts: 0,
      });
      return;
    }

    if (entry.entityType === "photo") {
      const row = await db.projectPhotos.get(entry.entityLocalId);
      if (!row) throw new Error("Foto de proyecto no encontrada");
      const proj = await db.projects.get(row.projectLocalId);
      if (!proj?.serverId) throw new Error("Proyecto padre sin serverId");

      if (entry.action === "create") {
        if (row.serverId) {
          await remoteUpdateProjectPhoto(client, row, row.serverId);
          await db.projectPhotos.update(row.localId, {
            syncStatus: "synced",
            syncConflict: undefined,
            syncErrorReason: undefined,
            photoUploadAttempts: 0,
          });
          return;
        }
        const id = await remoteInsertProjectPhoto(client, row, proj.serverId);
        await db.projectPhotos.update(row.localId, {
          serverId: id,
          syncStatus: "synced",
          syncConflict: undefined,
          syncErrorReason: undefined,
          photoUploadAttempts: 0,
        });
        return;
      }
      if (!row.serverId) throw new Error("Foto sin serverId");
      await remoteUpdateProjectPhoto(client, row, row.serverId);
      await db.projectPhotos.update(row.localId, {
        syncStatus: "synced",
        syncConflict: undefined,
        syncErrorReason: undefined,
        photoUploadAttempts: 0,
      });
      return;
    }

    throw new Error("sync: entrada no contemplada");
  }
}

export const syncManager = new SyncManager();

import Dexie, { type Table, type Transaction } from "dexie";
import { isDexieDebugEnabled } from "@/lib/db/dexieDebugLog";

export interface LocalProject {
  localId: string;
  serverId?: string;
  name: string;
  description?: string;
  locationLabel?: string;
  clientName?: string;
  clientContact?: string;
  status: "draft" | "in_progress" | "completed" | "shared";
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "pending" | "synced" | "error";
  syncConflict?: "remote_deleted";
}

export interface LocalPolygon {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  name: string;
  type: "main" | "sub";
  color: string;
  areaM2?: number;
  perimeterM?: number;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "pending" | "synced" | "error";
  syncConflict?: "remote_deleted";
}

export interface LocalVertex {
  localId: string;
  serverId?: string;
  polygonLocalId: string;
  orderIndex: number;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  altitudeM?: number;
  capturedAt: Date;
  /** Legado: algunas filas solo tienen esto. Preferir `photoBytes` + `photoMime` en WebKit. */
  photoBlob?: Blob;
  /** Foto en crudo (IndexedDB suele llevarlo mejor que `Blob` en Safari). */
  photoBytes?: ArrayBuffer;
  photoMime?: string;
  photoUrl?: string;
  note?: string;
  captureMethod:
    | "gps_single"
    | "gps_averaged"
    | "manual_map"
    | "photo_exif";
  syncStatus: "pending" | "synced" | "error";
  /** Intentos fallidos de subida a Storage en el último ciclo (máx. 3 antes de `sync_error`). */
  photoUploadAttempts?: number;
  /** El servidor ya no tiene la fila; el usuario debe decidir recrear o revisar. */
  syncConflict?: "remote_deleted";
  /** Motivo de `syncStatus: "error"` cuando aplica. */
  syncErrorReason?: "photo_upload";
}

export interface LocalPOI {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  label: string;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  /** Legado: preferir `photoBytes` + `photoMime` en WebKit. */
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
  photoUrl?: string;
  note?: string;
  capturedAt: Date;
  syncStatus: "pending" | "synced" | "error";
  photoUploadAttempts?: number;
  syncConflict?: "remote_deleted";
  syncErrorReason?: "photo_upload";
}

export interface LocalProjectPhoto {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  capturedAt: Date;
  syncStatus: "pending" | "synced" | "error";
  photoUploadAttempts?: number;
  syncConflict?: "remote_deleted";
  syncErrorReason?: "photo_upload";
}

export interface SyncQueueEntry {
  id?: number;
  entityType: "project" | "polygon" | "vertex" | "poi" | "photo";
  entityLocalId: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  attemptCount: number;
  lastAttempt?: Date;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
}

export interface CachedTile {
  url: string;
  blob: Blob;
  cachedAt: Date;
  zoom: number;
  x: number;
  y: number;
}

type LegacyPhotoRow = {
  localId: string;
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
};

async function migrateLegacyPhotoBlobsInTx(
  tx: Transaction,
  tableName: "vertices" | "projectPhotos" | "pois",
): Promise<void> {
  const table = tx.table(tableName) as Table<LegacyPhotoRow, string>;
  const rows = await table.toArray();
  for (const row of rows) {
    const b = row.photoBlob;
    if (!b) continue;
    if (row.photoBytes != null && row.photoBytes.byteLength > 0) continue;
    try {
      const mime = b.type || "image/jpeg";
      const bytes = await b.arrayBuffer();
      await table.where("localId").equals(row.localId).modify((r) => {
        r.photoBytes = bytes;
        r.photoMime = mime;
        delete r.photoBlob;
      });
    } catch (e) {
      if (isDexieDebugEnabled()) {
        console.warn(
          `[TerrainCapture:Dexie] migrate legacy ${tableName} skip`,
          row.localId,
          e,
        );
      }
    }
  }
}

export class TerrainCaptureDB extends Dexie {
  projects!: Table<LocalProject, string>;
  polygons!: Table<LocalPolygon, string>;
  vertices!: Table<LocalVertex, string>;
  pois!: Table<LocalPOI, string>;
  projectPhotos!: Table<LocalProjectPhoto, string>;
  syncQueue!: Table<SyncQueueEntry, number>;
  tileCache!: Table<CachedTile, string>;

  constructor() {
    super("TerrainCaptureDB");
    this.version(1).stores({
      projects: "localId, serverId, status, syncStatus, createdAt",
      polygons: "localId, serverId, projectLocalId, type, syncStatus",
      vertices: "localId, serverId, polygonLocalId, orderIndex, syncStatus",
      pois: "localId, serverId, projectLocalId, syncStatus",
      projectPhotos:
        "localId, serverId, projectLocalId, syncStatus, capturedAt",
      syncQueue: "++id, entityType, entityLocalId, status, createdAt",
      tileCache: "url, zoom, cachedAt",
    });
    // orderBy("updatedAt") en dashboard — el índice debe existir
    this.version(2).stores({
      projects:
        "localId, serverId, status, syncStatus, createdAt, updatedAt",
    });
    this.version(3)
      .stores({
        projects:
          "localId, serverId, status, syncStatus, createdAt, updatedAt",
        polygons: "localId, serverId, projectLocalId, type, syncStatus",
        vertices: "localId, serverId, polygonLocalId, orderIndex, syncStatus",
        pois: "localId, serverId, projectLocalId, syncStatus",
        projectPhotos:
          "localId, serverId, projectLocalId, syncStatus, capturedAt",
        syncQueue: "++id, entityType, entityLocalId, status, createdAt",
        tileCache: "url, zoom, cachedAt",
      })
      .upgrade(async (tx) => {
        await migrateLegacyPhotoBlobsInTx(tx, "vertices");
        await migrateLegacyPhotoBlobsInTx(tx, "projectPhotos");
        await migrateLegacyPhotoBlobsInTx(tx, "pois");
      });
  }
}

let dbInstance: TerrainCaptureDB | null = null;

export function getDb(): TerrainCaptureDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB solo está disponible en el cliente");
  }
  dbInstance ??= new TerrainCaptureDB();
  return dbInstance;
}

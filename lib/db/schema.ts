import Dexie, { type Table } from "dexie";

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
  photoBlob?: Blob;
  photoUrl?: string;
  note?: string;
  captureMethod:
    | "gps_single"
    | "gps_averaged"
    | "manual_map"
    | "photo_exif";
  syncStatus: "pending" | "synced" | "error";
}

export interface LocalPOI {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  label: string;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  photoBlob?: Blob;
  photoUrl?: string;
  note?: string;
  capturedAt: Date;
  syncStatus: "pending" | "synced" | "error";
}

export interface LocalProjectPhoto {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  photoBlob?: Blob;
  photoUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  capturedAt: Date;
  syncStatus: "pending" | "synced" | "error";
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db/schema";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalProjectPhoto,
  LocalVertex,
} from "@/lib/db/schema";

type RemoteProject = {
  id: string;
  local_id: string;
  name: string;
  description: string | null;
  location_label: string | null;
  client_name: string | null;
  client_contact: string | null;
  status: LocalProject["status"];
  created_at: string;
  updated_at: string;
};

type RemotePolygon = {
  id: string;
  local_id: string;
  project_id: string;
  name: string;
  type: LocalPolygon["type"];
  color: string;
  area_m2: number | string | null;
  perimeter_m: number | string | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
};

type RemoteVertex = {
  id: string;
  local_id: string;
  polygon_id: string;
  order_index: number;
  latitude: number | string;
  longitude: number | string;
  gps_accuracy_m: number | string | null;
  altitude_m: number | string | null;
  captured_at: string;
  updated_at: string;
  photo_url: string | null;
  thumbnail_url: string | null;
  note: string | null;
  capture_method: LocalVertex["captureMethod"];
};

type RemotePoi = {
  id: string;
  local_id: string;
  project_id: string;
  label: string;
  latitude: number | string;
  longitude: number | string;
  gps_accuracy_m: number | string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  note: string | null;
  captured_at: string;
  updated_at: string;
};

type RemoteProjectPhoto = {
  id: string;
  local_id: string;
  project_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  captured_at: string;
  updated_at: string;
};

function toDate(value: string | null | undefined): Date {
  if (value == null || value === "") return new Date(0);
  return new Date(value);
}

/** Filas Dexie legadas sin `updatedAt` o fecha inválida (evita crash en pull LWW). */
function dexieUpdatedAtMs(row: { updatedAt?: Date }): number {
  const d = row.updatedAt;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  return 0;
}

function toNum(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function deleteQueueEntriesForLocalIds(localIds: Iterable<string>): Promise<void> {
  const db = getDb();
  const idSet = new Set(localIds);
  if (idSet.size === 0) return;
  const entries = await db.syncQueue.toArray();
  for (const e of entries) {
    if (e.id != null && idSet.has(e.entityLocalId)) {
      await db.syncQueue.delete(e.id);
    }
  }
}

/** Vértices del polígono y la fila del polígono (no borra POI ni fotos de proyecto). */
async function deletePolygonBranch(polygonLocalId: string): Promise<void> {
  const db = getDb();
  const verts = await db.vertices.where("polygonLocalId").equals(polygonLocalId).toArray();
  const ids = verts.map((v) => v.localId);
  ids.push(polygonLocalId);
  await deleteQueueEntriesForLocalIds(ids);
  await db.vertices.where("polygonLocalId").equals(polygonLocalId).delete();
  await db.polygons.delete(polygonLocalId);
}

async function deleteProjectSubtree(projectLocalId: string): Promise<void> {
  const db = getDb();
  const polys = await db.polygons.where("projectLocalId").equals(projectLocalId).toArray();
  const localIds = new Set<string>([projectLocalId]);
  for (const p of polys) {
    localIds.add(p.localId);
    const verts = await db.vertices.where("polygonLocalId").equals(p.localId).toArray();
    for (const v of verts) localIds.add(v.localId);
  }
  const pois = await db.pois.where("projectLocalId").equals(projectLocalId).toArray();
  for (const poi of pois) localIds.add(poi.localId);
  const photos = await db.projectPhotos.where("projectLocalId").equals(projectLocalId).toArray();
  for (const ph of photos) localIds.add(ph.localId);

  await deleteQueueEntriesForLocalIds(localIds);

  for (const p of polys) {
    await db.vertices.where("polygonLocalId").equals(p.localId).delete();
  }
  await db.polygons.where("projectLocalId").equals(projectLocalId).delete();
  await db.pois.where("projectLocalId").equals(projectLocalId).delete();
  await db.projectPhotos.where("projectLocalId").equals(projectLocalId).delete();
  await db.projects.delete(projectLocalId);
}

function mapRemoteProject(r: RemoteProject): LocalProject {
  return {
    localId: r.local_id,
    serverId: r.id,
    name: r.name,
    description: r.description ?? undefined,
    locationLabel: r.location_label ?? undefined,
    clientName: r.client_name ?? undefined,
    clientContact: r.client_contact ?? undefined,
    status: r.status,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
    syncStatus: "synced",
    syncConflict: undefined,
  };
}

function mapRemotePolygon(
  r: RemotePolygon,
  projectLocalId: string,
): LocalPolygon {
  return {
    localId: r.local_id,
    serverId: r.id,
    projectLocalId,
    name: r.name,
    type: r.type,
    color: r.color,
    areaM2: toNum(r.area_m2),
    perimeterM: toNum(r.perimeter_m),
    isClosed: Boolean(r.is_closed),
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
    syncStatus: "synced",
    syncConflict: undefined,
  };
}

function mapRemoteVertex(r: RemoteVertex, polygonLocalId: string): LocalVertex {
  return {
    localId: r.local_id,
    serverId: r.id,
    polygonLocalId,
    orderIndex: r.order_index,
    latitude: toNum(r.latitude) ?? 0,
    longitude: toNum(r.longitude) ?? 0,
    gpsAccuracyM: toNum(r.gps_accuracy_m),
    altitudeM: toNum(r.altitude_m),
    capturedAt: toDate(r.captured_at),
    updatedAt: toDate(r.updated_at),
    photoUrl: r.photo_url ?? undefined,
    note: r.note ?? undefined,
    captureMethod: r.capture_method,
    syncStatus: "synced",
    syncConflict: undefined,
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  };
}

function mapRemotePoi(r: RemotePoi, projectLocalId: string): LocalPOI {
  return {
    localId: r.local_id,
    serverId: r.id,
    projectLocalId,
    label: r.label,
    latitude: toNum(r.latitude) ?? 0,
    longitude: toNum(r.longitude) ?? 0,
    gpsAccuracyM: toNum(r.gps_accuracy_m),
    photoUrl: r.photo_url ?? undefined,
    note: r.note ?? undefined,
    capturedAt: toDate(r.captured_at),
    updatedAt: toDate(r.updated_at),
    syncStatus: "synced",
    syncConflict: undefined,
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  };
}

function mapRemoteProjectPhoto(
  r: RemoteProjectPhoto,
  projectLocalId: string,
): LocalProjectPhoto {
  return {
    localId: r.local_id,
    serverId: r.id,
    projectLocalId,
    updatedAt: toDate(r.updated_at),
    photoUrl: r.photo_url,
    thumbnailUrl: r.thumbnail_url ?? undefined,
    caption: r.caption ?? undefined,
    latitude: toNum(r.latitude),
    longitude: toNum(r.longitude),
    capturedAt: toDate(r.captured_at),
    syncStatus: "synced",
    syncConflict: undefined,
    syncErrorReason: undefined,
    photoUploadAttempts: 0,
  };
}

async function fetchVerticesForPolygons(
  client: SupabaseClient,
  polygonServerIds: string[],
): Promise<RemoteVertex[]> {
  if (polygonServerIds.length === 0) return [];
  const { data, error } = await client
    .from("vertices")
    .select(
      "id, local_id, polygon_id, order_index, latitude, longitude, gps_accuracy_m, altitude_m, captured_at, updated_at, photo_url, thumbnail_url, note, capture_method",
    )
    .in("polygon_id", polygonServerIds);
  if (error) throw error;
  return (data ?? []) as RemoteVertex[];
}

async function applyFullProjectFromRemote(
  client: SupabaseClient,
  rp: RemoteProject,
): Promise<void> {
  const db = getDb();
  const { data: polyRows, error: polyErr } = await client
    .from("polygons")
    .select(
      "id, local_id, project_id, name, type, color, area_m2, perimeter_m, is_closed, created_at, updated_at",
    )
    .eq("project_id", rp.id);
  if (polyErr) throw polyErr;
  const remotePolys = (polyRows ?? []) as RemotePolygon[];
  const polyServerIds = remotePolys.map((p) => p.id);
  const remoteVerts = await fetchVerticesForPolygons(client, polyServerIds);

  const { data: poiRows, error: poiErr } = await client
    .from("points_of_interest")
    .select(
      "id, local_id, project_id, label, latitude, longitude, gps_accuracy_m, photo_url, thumbnail_url, note, captured_at, updated_at",
    )
    .eq("project_id", rp.id);
  if (poiErr) throw poiErr;
  const remotePois = (poiRows ?? []) as RemotePoi[];

  const { data: photoRows, error: photoErr } = await client
    .from("project_photos")
    .select(
      "id, local_id, project_id, photo_url, thumbnail_url, caption, latitude, longitude, captured_at, updated_at",
    )
    .eq("project_id", rp.id);
  if (photoErr) throw photoErr;
  const remotePhotos = (photoRows ?? []) as RemoteProjectPhoto[];

  const projectLocalId = rp.local_id;
  const vertsByPolyServer = new Map<string, RemoteVertex[]>();
  for (const v of remoteVerts) {
    const list = vertsByPolyServer.get(v.polygon_id) ?? [];
    list.push(v);
    vertsByPolyServer.set(v.polygon_id, list);
  }
  for (const list of vertsByPolyServer.values()) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  await db.transaction(
    "rw",
    [
      db.projects,
      db.polygons,
      db.vertices,
      db.pois,
      db.projectPhotos,
    ],
    async () => {
      await db.projects.put(mapRemoteProject(rp));
      for (const poly of remotePolys) {
        await db.polygons.put(mapRemotePolygon(poly, projectLocalId));
        const vs = vertsByPolyServer.get(poly.id) ?? [];
        for (const rv of vs) {
          await db.vertices.put(mapRemoteVertex(rv, poly.local_id));
        }
      }
      for (const poi of remotePois) {
        await db.pois.put(mapRemotePoi(poi, projectLocalId));
      }
      for (const ph of remotePhotos) {
        await db.projectPhotos.put(mapRemoteProjectPhoto(ph, projectLocalId));
      }
    },
  );
}

async function mergeNewPoisAndPhotos(
  client: SupabaseClient,
  rp: RemoteProject,
): Promise<void> {
  const db = getDb();
  const projectLocalId = rp.local_id;

  const { data: poiRows, error: poiErr } = await client
    .from("points_of_interest")
    .select(
      "id, local_id, project_id, label, latitude, longitude, gps_accuracy_m, photo_url, thumbnail_url, note, captured_at, updated_at",
    )
    .eq("project_id", rp.id);
  if (poiErr) throw poiErr;

  const { data: photoRows, error: photoErr } = await client
    .from("project_photos")
    .select(
      "id, local_id, project_id, photo_url, thumbnail_url, caption, latitude, longitude, captured_at, updated_at",
    )
    .eq("project_id", rp.id);
  if (photoErr) throw photoErr;

  await db.transaction("rw", db.pois, db.projectPhotos, async () => {
    for (const row of (poiRows ?? []) as RemotePoi[]) {
      const existing = await db.pois.get(row.local_id);
      if (!existing) await db.pois.put(mapRemotePoi(row, projectLocalId));
      else if (
        toDate(row.updated_at).getTime() > dexieUpdatedAtMs(existing)
      ) {
        await db.pois.put(mapRemotePoi(row, projectLocalId));
      }
    }
    for (const row of (photoRows ?? []) as RemoteProjectPhoto[]) {
      const existing = await db.projectPhotos.get(row.local_id);
      if (!existing) await db.projectPhotos.put(mapRemoteProjectPhoto(row, projectLocalId));
      else if (
        toDate(row.updated_at).getTime() > dexieUpdatedAtMs(existing)
      ) {
        await db.projectPhotos.put(mapRemoteProjectPhoto(row, projectLocalId));
      }
    }
  });
}

async function upsertPoisAndPhotosOverwrite(
  client: SupabaseClient,
  rp: RemoteProject,
): Promise<void> {
  const db = getDb();
  const projectLocalId = rp.local_id;

  const { data: poiRows, error: poiErr } = await client
    .from("points_of_interest")
    .select(
      "id, local_id, project_id, label, latitude, longitude, gps_accuracy_m, photo_url, thumbnail_url, note, captured_at",
    )
    .eq("project_id", rp.id);
  if (poiErr) throw poiErr;

  const { data: photoRows, error: photoErr } = await client
    .from("project_photos")
    .select(
      "id, local_id, project_id, photo_url, thumbnail_url, caption, latitude, longitude, captured_at",
    )
    .eq("project_id", rp.id);
  if (photoErr) throw photoErr;

  await db.transaction("rw", db.pois, db.projectPhotos, async () => {
    for (const row of (poiRows ?? []) as RemotePoi[]) {
      await db.pois.put(mapRemotePoi(row, projectLocalId));
    }
    for (const row of (photoRows ?? []) as RemoteProjectPhoto[]) {
      await db.projectPhotos.put(mapRemoteProjectPhoto(row, projectLocalId));
    }
  });
}

export type PullRemoteResult = {
  projectsFetched: number;
  projectsApplied: number;
  projectsSkippedLocalNewer: number;
};

/**
 * Descarga proyectos (y árbol) desde Supabase y los fusiona en Dexie.
 * - Proyecto: si `remote.updated_at` es más reciente que el local, reemplaza todo el árbol.
 * - Si el proyecto no existe localmente, inserta el árbol completo.
 * - Si el proyecto está al día en fecha pero un polígono remoto es más reciente, sustituye solo ese polígono (y vértices).
 * - POI / fotos de galería: sin `updated_at` en servidor; se insertan si faltan localmente, y si hubo sustitución de proyecto o polígono se sobrescriben desde remoto.
 */
export async function pullRemoteFromSupabase(
  client: SupabaseClient,
): Promise<PullRemoteResult> {
  const db = getDb();
  const { data: projectRows, error: projErr } = await client
    .from("projects")
    .select(
      "id, local_id, name, description, location_label, client_name, client_contact, status, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (projErr) throw projErr;

  const remoteProjects = (projectRows ?? []) as RemoteProject[];
  let projectsApplied = 0;
  let projectsSkippedLocalNewer = 0;

  for (const rp of remoteProjects) {
    const local = await db.projects.get(rp.local_id);
    const remoteProjectTime = toDate(rp.updated_at).getTime();

    if (!local) {
      await deleteQueueEntriesForLocalIds([rp.local_id]);
      await applyFullProjectFromRemote(client, rp);
      projectsApplied++;
      continue;
    }

    const localProjectTime = dexieUpdatedAtMs(local);
    const projectRemoteNewer = remoteProjectTime > localProjectTime;

    const { data: polyRows, error: polyErr } = await client
      .from("polygons")
      .select(
        "id, local_id, project_id, name, type, color, area_m2, perimeter_m, is_closed, created_at, updated_at",
      )
      .eq("project_id", rp.id);
    if (polyErr) throw polyErr;
    const remotePolys = (polyRows ?? []) as RemotePolygon[];

    const stalePolygons: RemotePolygon[] = [];
    for (const rpoly of remotePolys) {
      const lp = await db.polygons.get(rpoly.local_id);
      const rTime = toDate(rpoly.updated_at).getTime();
      if (!lp || lp.projectLocalId !== rp.local_id) {
        stalePolygons.push(rpoly);
        continue;
      }
      if (rTime > dexieUpdatedAtMs(lp)) {
        stalePolygons.push(rpoly);
      }
    }

    if (!projectRemoteNewer && stalePolygons.length === 0) {
      await mergeNewPoisAndPhotos(client, rp);
      projectsSkippedLocalNewer++;
      continue;
    }

    if (projectRemoteNewer) {
      await deleteProjectSubtree(rp.local_id);
      await applyFullProjectFromRemote(client, rp);
      projectsApplied++;
      continue;
    }

    await db.projects.update(rp.local_id, {
      serverId: rp.id,
      syncStatus: "synced",
      syncConflict: undefined,
    });

    const polyServerIds = stalePolygons.map((p) => p.id);
    const remoteVerts = await fetchVerticesForPolygons(client, polyServerIds);
    const vertsByPolyServer = new Map<string, RemoteVertex[]>();
    for (const v of remoteVerts) {
      const list = vertsByPolyServer.get(v.polygon_id) ?? [];
      list.push(v);
      vertsByPolyServer.set(v.polygon_id, list);
    }
    for (const list of vertsByPolyServer.values()) {
      list.sort((a, b) => a.order_index - b.order_index);
    }

    for (const rpoly of stalePolygons) {
      const lp = await db.polygons.get(rpoly.local_id);
      if (lp) {
        await deletePolygonBranch(rpoly.local_id);
      }
      await db.transaction("rw", [db.polygons, db.vertices], async () => {
        await db.polygons.put(mapRemotePolygon(rpoly, rp.local_id));
        const vs = vertsByPolyServer.get(rpoly.id) ?? [];
        for (const rv of vs) {
          await db.vertices.put(mapRemoteVertex(rv, rpoly.local_id));
        }
      });
    }

    await upsertPoisAndPhotosOverwrite(client, rp);
    projectsApplied++;
  }

  return {
    projectsFetched: remoteProjects.length,
    projectsApplied,
    projectsSkippedLocalNewer,
  };
}

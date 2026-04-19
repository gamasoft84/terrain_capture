import type { SupabaseClient } from "@supabase/supabase-js";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalProjectPhoto,
  LocalVertex,
} from "@/lib/db/schema";
import {
  MAX_PHOTO_UPLOAD_ATTEMPTS,
  PhotoUploadExhaustedError,
  RemoteEntityGoneError,
} from "@/lib/db/sync/errors";
import { centroidFromVerticesEwkt, pointEwkt, polygonFromVerticesEwkt } from "@/lib/db/sync/geo";
import {
  pathExtensionForImageBlob,
  uploadToProjectPhotosBucket,
} from "@/lib/supabase/storage";

function assertUpdateRows(
  data: { id: string }[] | null,
  entityType: RemoteEntityGoneError["entityType"],
  localId: string,
): void {
  if (!data?.length) {
    throw new RemoteEntityGoneError(entityType, localId);
  }
}

async function listVerticesByPolygonLocal(
  polygonLocalId: string,
): Promise<LocalVertex[]> {
  const list = await getDb()
    .vertices.where("polygonLocalId")
    .equals(polygonLocalId)
    .toArray();
  list.sort((a, b) => a.orderIndex - b.orderIndex);
  return list;
}

function iso(d: Date): string {
  return d.toISOString();
}

export async function remoteInsertProject(
  client: SupabaseClient,
  row: LocalProject,
): Promise<string> {
  const { data, error } = await client
    .from("projects")
    .insert({
      local_id: row.localId,
      name: row.name,
      description: row.description ?? null,
      location_label: row.locationLabel ?? null,
      client_name: row.clientName ?? null,
      client_contact: row.clientContact ?? null,
      status: row.status,
      created_at: iso(row.createdAt),
      updated_at: iso(row.updatedAt),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function remoteUpdateProject(
  client: SupabaseClient,
  row: LocalProject,
  serverId: string,
): Promise<void> {
  const { data, error } = await client
    .from("projects")
    .update({
      name: row.name,
      description: row.description ?? null,
      location_label: row.locationLabel ?? null,
      client_name: row.clientName ?? null,
      client_contact: row.clientContact ?? null,
      status: row.status,
      updated_at: iso(row.updatedAt),
    })
    .eq("id", serverId)
    .select("id");
  if (error) throw error;
  assertUpdateRows(data as { id: string }[] | null, "project", row.localId);
}

export async function remoteInsertPolygon(
  client: SupabaseClient,
  row: LocalPolygon,
  projectRemoteId: string,
): Promise<string> {
  const verts = await listVerticesByPolygonLocal(row.localId);
  const polyWkt =
    row.isClosed && verts.length >= 3 ? polygonFromVerticesEwkt(verts) : null;
  const centroidWkt =
    row.isClosed && verts.length >= 3 ? centroidFromVerticesEwkt(verts) : null;

  const { data, error } = await client
    .from("polygons")
    .insert({
      local_id: row.localId,
      project_id: projectRemoteId,
      name: row.name,
      type: row.type,
      color: row.color,
      area_m2: row.areaM2 ?? null,
      perimeter_m: row.perimeterM ?? null,
      centroid: centroidWkt,
      geometry: polyWkt,
      is_closed: row.isClosed,
      created_at: iso(row.createdAt),
      updated_at: iso(row.updatedAt),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function remoteUpdatePolygon(
  client: SupabaseClient,
  row: LocalPolygon,
  serverId: string,
): Promise<void> {
  const verts = await listVerticesByPolygonLocal(row.localId);
  const polyWkt =
    row.isClosed && verts.length >= 3 ? polygonFromVerticesEwkt(verts) : null;
  const centroidWkt =
    row.isClosed && verts.length >= 3 ? centroidFromVerticesEwkt(verts) : null;

  const { data, error } = await client
    .from("polygons")
    .update({
      name: row.name,
      color: row.color,
      area_m2: row.areaM2 ?? null,
      perimeter_m: row.perimeterM ?? null,
      centroid: centroidWkt,
      geometry: polyWkt,
      is_closed: row.isClosed,
      updated_at: iso(row.updatedAt),
    })
    .eq("id", serverId)
    .select("id");
  if (error) throw error;
  assertUpdateRows(data as { id: string }[] | null, "polygon", row.localId);
}

async function uploadVertexPhotoIfNeeded(
  client: SupabaseClient,
  projectLocalId: string,
  vertex: LocalVertex,
): Promise<string | undefined> {
  if (vertex.photoUrl?.startsWith("http")) return vertex.photoUrl;
  const blob = blobFromStored(vertex);
  if (!blob || blob.size === 0) return vertex.photoUrl;

  const path = `${projectLocalId}/vertices/${vertex.localId}.jpg`;
  const mime = blob.type || vertex.photoMime || "image/jpeg";

  for (let attempt = 1; attempt <= MAX_PHOTO_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const { publicUrl } = await uploadToProjectPhotosBucket(
        client,
        path,
        blob,
        mime,
      );
      await getDb().vertices.update(vertex.localId, {
        photoUploadAttempts: 0,
      });
      return publicUrl;
    } catch {
      await getDb().vertices.update(vertex.localId, {
        photoUploadAttempts: attempt,
      });
      if (attempt === MAX_PHOTO_UPLOAD_ATTEMPTS) {
        throw new PhotoUploadExhaustedError("vertex", vertex.localId);
      }
    }
  }
}

async function resolvePolygonProjectLocalId(
  polygonLocalId: string,
): Promise<string | undefined> {
  const poly = await getDb().polygons.get(polygonLocalId);
  return poly?.projectLocalId;
}

export async function remoteInsertVertex(
  client: SupabaseClient,
  vertex: LocalVertex,
  polygonRemoteId: string,
): Promise<string> {
  const projectLocalId = await resolvePolygonProjectLocalId(vertex.polygonLocalId);
  if (!projectLocalId) throw new Error("Polígono local no encontrado para vértice");

  let photoUrl = vertex.photoUrl ?? null;
  const uploaded = await uploadVertexPhotoIfNeeded(client, projectLocalId, vertex);
  if (uploaded) photoUrl = uploaded;
  if (photoUrl?.startsWith("http")) {
    await getDb().vertices.update(vertex.localId, { photoUrl });
  }

  const coordEwkt = pointEwkt(vertex.longitude, vertex.latitude);

  const { data, error } = await client
    .from("vertices")
    .insert({
      local_id: vertex.localId,
      polygon_id: polygonRemoteId,
      order_index: vertex.orderIndex,
      coordinates: coordEwkt,
      latitude: vertex.latitude,
      longitude: vertex.longitude,
      gps_accuracy_m: vertex.gpsAccuracyM ?? null,
      altitude_m: vertex.altitudeM ?? null,
      captured_at: iso(vertex.capturedAt),
      photo_url: photoUrl,
      thumbnail_url: null,
      note: vertex.note ?? null,
      capture_method: vertex.captureMethod,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function remoteUpdateVertex(
  client: SupabaseClient,
  vertex: LocalVertex,
  serverId: string,
): Promise<void> {
  const projectLocalId = await resolvePolygonProjectLocalId(vertex.polygonLocalId);
  if (!projectLocalId) throw new Error("Polígono local no encontrado para vértice");

  let photoUrl = vertex.photoUrl ?? null;
  const uploaded = await uploadVertexPhotoIfNeeded(client, projectLocalId, vertex);
  if (uploaded) photoUrl = uploaded;
  if (photoUrl?.startsWith("http")) {
    await getDb().vertices.update(vertex.localId, { photoUrl });
  }

  const coordEwkt = pointEwkt(vertex.longitude, vertex.latitude);

  const { data, error } = await client
    .from("vertices")
    .update({
      order_index: vertex.orderIndex,
      coordinates: coordEwkt,
      latitude: vertex.latitude,
      longitude: vertex.longitude,
      gps_accuracy_m: vertex.gpsAccuracyM ?? null,
      altitude_m: vertex.altitudeM ?? null,
      captured_at: iso(vertex.capturedAt),
      photo_url: photoUrl,
      note: vertex.note ?? null,
      capture_method: vertex.captureMethod,
    })
    .eq("id", serverId)
    .select("id");
  if (error) throw error;
  assertUpdateRows(data as { id: string }[] | null, "vertex", vertex.localId);
}

async function uploadPoiPhotoIfNeeded(
  client: SupabaseClient,
  projectLocalId: string,
  poi: LocalPOI,
): Promise<string | undefined> {
  if (poi.photoUrl?.startsWith("http")) return poi.photoUrl;
  const blob = blobFromStored(poi);
  if (!blob || blob.size === 0) return poi.photoUrl;

  const path = `${projectLocalId}/pois/${poi.localId}.jpg`;
  const mime = blob.type || poi.photoMime || "image/jpeg";

  for (let attempt = 1; attempt <= MAX_PHOTO_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const { publicUrl } = await uploadToProjectPhotosBucket(
        client,
        path,
        blob,
        mime,
      );
      await getDb().pois.update(poi.localId, { photoUploadAttempts: 0 });
      return publicUrl;
    } catch {
      await getDb().pois.update(poi.localId, {
        photoUploadAttempts: attempt,
      });
      if (attempt === MAX_PHOTO_UPLOAD_ATTEMPTS) {
        throw new PhotoUploadExhaustedError("poi", poi.localId);
      }
    }
  }
}

export async function remoteInsertPoi(
  client: SupabaseClient,
  poi: LocalPOI,
  projectRemoteId: string,
): Promise<string> {
  let photoUrl = poi.photoUrl ?? null;
  const uploaded = await uploadPoiPhotoIfNeeded(
    client,
    poi.projectLocalId,
    poi,
  );
  if (uploaded) photoUrl = uploaded;
  if (photoUrl?.startsWith("http")) {
    await getDb().pois.update(poi.localId, { photoUrl });
  }

  const coordEwkt = pointEwkt(poi.longitude, poi.latitude);

  const { data, error } = await client
    .from("points_of_interest")
    .insert({
      local_id: poi.localId,
      project_id: projectRemoteId,
      label: poi.label,
      coordinates: coordEwkt,
      latitude: poi.latitude,
      longitude: poi.longitude,
      gps_accuracy_m: poi.gpsAccuracyM ?? null,
      photo_url: photoUrl,
      thumbnail_url: null,
      note: poi.note ?? null,
      captured_at: iso(poi.capturedAt),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function remoteUpdatePoi(
  client: SupabaseClient,
  poi: LocalPOI,
  serverId: string,
): Promise<void> {
  let photoUrl = poi.photoUrl ?? null;
  const uploaded = await uploadPoiPhotoIfNeeded(
    client,
    poi.projectLocalId,
    poi,
  );
  if (uploaded) photoUrl = uploaded;
  if (photoUrl?.startsWith("http")) {
    await getDb().pois.update(poi.localId, { photoUrl });
  }

  const coordEwkt = pointEwkt(poi.longitude, poi.latitude);

  const { data, error } = await client
    .from("points_of_interest")
    .update({
      label: poi.label,
      coordinates: coordEwkt,
      latitude: poi.latitude,
      longitude: poi.longitude,
      gps_accuracy_m: poi.gpsAccuracyM ?? null,
      photo_url: photoUrl,
      note: poi.note ?? null,
      captured_at: iso(poi.capturedAt),
    })
    .eq("id", serverId)
    .select("id");
  if (error) throw error;
  assertUpdateRows(data as { id: string }[] | null, "poi", poi.localId);
}

async function uploadProjectPhotoBlob(
  client: SupabaseClient,
  projectLocalId: string,
  photo: LocalProjectPhoto,
): Promise<string> {
  const blob = blobFromStored(photo);
  if (!blob || blob.size === 0) {
    throw new Error("Foto de proyecto sin bytes locales");
  }
  const path = `${projectLocalId}/gallery/${photo.localId}.jpg`;
  const mime = blob.type || photo.photoMime || "image/jpeg";

  for (let attempt = 1; attempt <= MAX_PHOTO_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const { publicUrl } = await uploadToProjectPhotosBucket(
        client,
        path,
        blob,
        mime,
      );
      await getDb().projectPhotos.update(photo.localId, {
        photoUploadAttempts: 0,
      });
      return publicUrl;
    } catch {
      await getDb().projectPhotos.update(photo.localId, {
        photoUploadAttempts: attempt,
      });
      if (attempt === MAX_PHOTO_UPLOAD_ATTEMPTS) {
        throw new PhotoUploadExhaustedError("photo", photo.localId);
      }
    }
  }
  throw new PhotoUploadExhaustedError("photo", photo.localId);
}

export async function remoteInsertProjectPhoto(
  client: SupabaseClient,
  photo: LocalProjectPhoto,
  projectRemoteId: string,
): Promise<string> {
  const photoUrl = photo.photoUrl?.startsWith("http")
    ? photo.photoUrl
    : await uploadProjectPhotoBlob(client, photo.projectLocalId, photo);

  if (photoUrl.startsWith("http")) {
    await getDb().projectPhotos.update(photo.localId, { photoUrl });
  }

  const { data, error } = await client
    .from("project_photos")
    .insert({
      local_id: photo.localId,
      project_id: projectRemoteId,
      photo_url: photoUrl,
      thumbnail_url: photo.thumbnailUrl ?? null,
      caption: photo.caption ?? null,
      latitude: photo.latitude ?? null,
      longitude: photo.longitude ?? null,
      captured_at: iso(photo.capturedAt),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function remoteUpdateProjectPhoto(
  client: SupabaseClient,
  photo: LocalProjectPhoto,
  serverId: string,
): Promise<void> {
  const photoUrl = photo.photoUrl?.startsWith("http")
    ? photo.photoUrl
    : await uploadProjectPhotoBlob(client, photo.projectLocalId, photo);

  if (photoUrl.startsWith("http")) {
    await getDb().projectPhotos.update(photo.localId, { photoUrl });
  }

  const { data, error } = await client
    .from("project_photos")
    .update({
      photo_url: photoUrl,
      thumbnail_url: photo.thumbnailUrl ?? null,
      caption: photo.caption ?? null,
      latitude: photo.latitude ?? null,
      longitude: photo.longitude ?? null,
      captured_at: iso(photo.capturedAt),
    })
    .eq("id", serverId)
    .select("id");
  if (error) throw error;
  assertUpdateRows(data as { id: string }[] | null, "photo", photo.localId);
}

export async function remoteDelete(
  client: SupabaseClient,
  table:
    | "projects"
    | "polygons"
    | "vertices"
    | "points_of_interest"
    | "project_photos",
  serverId: string,
): Promise<void> {
  const { error } = await client.from(table).delete().eq("id", serverId);
  if (error) throw error;
}

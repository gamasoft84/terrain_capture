import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-photos";

/** Extensión de objeto en Storage alineada con `contentType` (WebP tras compresión canvas). */
export function pathExtensionForImageBlob(
  blob: Blob,
  mimeHint?: string,
): string {
  const mime = (blob.type || mimeHint || "").toLowerCase();
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadToProjectPhotosBucket(
  client: SupabaseClient,
  path: string,
  file: Blob,
  contentType: string,
): Promise<{ publicUrl: string }> {
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

export async function uploadProjectVertexPhoto(
  client: SupabaseClient,
  path: string,
  file: Blob,
  contentType: string,
): Promise<{ publicUrl: string }> {
  return uploadToProjectPhotosBucket(client, path, file, contentType);
}

export async function deleteStorageObject(
  client: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

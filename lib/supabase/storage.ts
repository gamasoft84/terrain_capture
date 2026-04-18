import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "project-photos";

export async function uploadProjectVertexPhoto(
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

export async function deleteStorageObject(
  client: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

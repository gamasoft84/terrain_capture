/** Campos de foto principal + miniatura local (Dexie). */
export type StoredPhotoRow = {
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
  thumbnailBytes?: ArrayBuffer;
  thumbnailMime?: string;
};

/** Fila con foto persistida como bytes (IDB) o legado como Blob. */
export function blobFromStored(row: StoredPhotoRow): Blob | undefined {
  if (row.photoBytes != null && row.photoBytes.byteLength > 0) {
    const type = row.photoMime?.trim() || "image/jpeg";
    return new Blob([row.photoBytes], { type });
  }
  if (row.photoBlob != null) return row.photoBlob;
  return undefined;
}

/** Para miniaturas en rejillas: usa `thumbnailBytes` si existe; si no, la foto completa. */
export function thumbnailOrPhotoBlob(row: StoredPhotoRow): Blob | undefined {
  if (row.thumbnailBytes != null && row.thumbnailBytes.byteLength > 0) {
    const type = row.thumbnailMime?.trim() || "image/webp";
    return new Blob([row.thumbnailBytes], { type });
  }
  return blobFromStored(row);
}

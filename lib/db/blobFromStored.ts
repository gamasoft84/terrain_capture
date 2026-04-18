/** Fila con foto persistida como bytes (IDB) o legado como Blob. */
export function blobFromStored(row: {
  photoBlob?: Blob;
  photoBytes?: ArrayBuffer;
  photoMime?: string;
}): Blob | undefined {
  if (row.photoBytes != null && row.photoBytes.byteLength > 0) {
    const type = row.photoMime?.trim() || "image/jpeg";
    return new Blob([row.photoBytes], { type });
  }
  if (row.photoBlob != null) return row.photoBlob;
  return undefined;
}

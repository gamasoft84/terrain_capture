/**
 * Safari/WebKit a veces lanza "Error preparing Blob/File data…" al guardar
 * un `File` o incluso un `Blob` poco “desacoplado” en IndexedDB.
 * Copiar bytes con `arrayBuffer` + `new Blob` es lo más fiable; `slice` queda de respaldo.
 */
export async function cloneBlobForIndexedDb(source: Blob): Promise<Blob> {
  const type = source.type || "application/octet-stream";
  try {
    const buf = await source.arrayBuffer();
    const out = new Blob([buf], { type });
    console.info("[TerrainCapture:Dexie] cloneBuffer arrayBuffer OK", {
      inSize: source.size,
      outSize: out.size,
      type: out.type,
    });
    return out;
  } catch (e) {
    console.error("[TerrainCapture:Dexie] cloneBuffer arrayBuffer falló → slice", {
      message: e instanceof Error ? e.message : String(e),
      inSize: source.size,
      type,
    });
    return source.slice(0, source.size, type);
  }
}

/** Alias del nombre anterior por si algún bundle/import quedó cacheado. */
export { cloneBlobForIndexedDb as blobForIndexedDb };

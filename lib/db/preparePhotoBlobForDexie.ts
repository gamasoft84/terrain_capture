import { cloneBlobForIndexedDb } from "@/lib/db/blobForIndexedDb";
import { dexieDebugInfo, dexieDebugWarn } from "@/lib/db/dexieDebugLog";

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const TAG = "preparePhotoBlob";

/**
 * Safari a veces rechaza fotos de cámara (HEIC / muy grandes) en IndexedDB aunque
 * el Blob sea “clonado”. Re-encode a JPEG acotado reduce tamaño y evita el error.
 */
export async function preparePhotoBlobForDexie(source: Blob): Promise<Blob> {
  dexieDebugInfo(`${TAG} entrada`, {
    size: source.size,
    type: source.type,
    ctor: source.constructor.name,
  });

  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    dexieDebugWarn(`${TAG} sin document/createImageBitmap → cloneBuffer`);
    return cloneBlobForIndexedDb(source);
  }

  try {
    const bitmap = await createImageBitmap(source);
    try {
      const sw = bitmap.width;
      const sh = bitmap.height;
      if (sw <= 0 || sh <= 0) {
        dexieDebugWarn(`${TAG} dimensiones inválidas ${sw}x${sh} → cloneBuffer`);
        return cloneBlobForIndexedDb(source);
      }
      const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        dexieDebugWarn(`${TAG} sin contexto 2d → cloneBuffer`);
        return cloneBlobForIndexedDb(source);
      }
      ctx.drawImage(bitmap, 0, 0, dw, dh);
      const jpeg = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
      });
      if (!jpeg || jpeg.size === 0) {
        dexieDebugWarn(`${TAG} toBlob vacío → cloneBuffer`);
        return cloneBlobForIndexedDb(source);
      }
      dexieDebugInfo(`${TAG} salida JPEG`, {
        size: jpeg.size,
        type: jpeg.type,
        canvas: `${dw}x${dh}`,
        orig: `${sw}x${sh}`,
      });
      return jpeg;
    } finally {
      bitmap.close();
    }
  } catch (e) {
    dexieDebugWarn(`${TAG} bitmap/canvas falló → cloneBuffer`, {
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : typeof e,
      sourceSize: source.size,
      sourceType: source.type,
    });
    return cloneBlobForIndexedDb(source);
  }
}

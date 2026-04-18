import { cloneBlobForIndexedDb } from "@/lib/db/blobForIndexedDb";

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const TAG = "[TerrainCapture:Dexie] preparePhotoBlob";

/**
 * Safari a veces rechaza fotos de cámara (HEIC / muy grandes) en IndexedDB aunque
 * el Blob sea “clonado”. Re-encode a JPEG acotado reduce tamaño y evita el error.
 */
export async function preparePhotoBlobForDexie(source: Blob): Promise<Blob> {
  console.info(`${TAG} entrada`, {
    size: source.size,
    type: source.type,
    ctor: source.constructor.name,
  });

  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    console.warn(`${TAG} sin document/createImageBitmap → cloneBuffer`);
    return cloneBlobForIndexedDb(source);
  }

  try {
    const bitmap = await createImageBitmap(source);
    try {
      const sw = bitmap.width;
      const sh = bitmap.height;
      if (sw <= 0 || sh <= 0) {
        console.warn(`${TAG} dimensiones inválidas ${sw}x${sh} → cloneBuffer`);
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
        console.warn(`${TAG} sin contexto 2d → cloneBuffer`);
        return cloneBlobForIndexedDb(source);
      }
      ctx.drawImage(bitmap, 0, 0, dw, dh);
      const jpeg = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
      });
      if (!jpeg || jpeg.size === 0) {
        console.warn(`${TAG} toBlob vacío → cloneBuffer`);
        return cloneBlobForIndexedDb(source);
      }
      console.info(`${TAG} salida JPEG`, {
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
    console.error(`${TAG} bitmap/canvas falló → cloneBuffer`, {
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : typeof e,
      sourceSize: source.size,
      sourceType: source.type,
    });
    return cloneBlobForIndexedDb(source);
  }
}

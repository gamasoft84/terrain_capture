import { cloneBlobForIndexedDb } from "@/lib/db/blobForIndexedDb";
import { dexieDebugInfo, dexieDebugWarn } from "@/lib/db/dexieDebugLog";

const MAX_EDGE = 1920;
const THUMB_SIZE = 200;
const JPEG_QUALITY = 0.82;
const WEBP_QUALITY_MAIN = 0.82;
const WEBP_QUALITY_THUMB = 0.78;
const TAG = "preparePhoto";

export type PreparedPhotoForDexie = {
  photo: Blob;
  /** Miniatura 200×200 cover en WebP (o JPEG si el navegador no codifica WebP). */
  thumbnail?: Blob;
};

async function encodeCanvasToPhotoBlob(
  canvas: HTMLCanvasElement,
  webpQuality: number,
): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", webpQuality);
  });
  if (webp && webp.size > 0) return webp;
  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
  return jpeg && jpeg.size > 0 ? jpeg : null;
}

/**
 * Re-encode capturas a WebP (fallback JPEG) y genera miniatura 200×200 para listas.
 * Safari a veces rechaza HEIC/muy grandes en IndexedDB; el canvas reduce tamaño y tipo.
 */
export async function preparePhotoForDexie(
  source: Blob,
): Promise<PreparedPhotoForDexie> {
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
    const photo = await cloneBlobForIndexedDb(source);
    return { photo };
  }

  try {
    const bitmap = await createImageBitmap(source);
    try {
      const sw = bitmap.width;
      const sh = bitmap.height;
      if (sw <= 0 || sh <= 0) {
        dexieDebugWarn(`${TAG} dimensiones inválidas ${sw}x${sh} → cloneBuffer`);
        const photo = await cloneBlobForIndexedDb(source);
        return { photo };
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
        const photo = await cloneBlobForIndexedDb(source);
        return { photo };
      }
      ctx.drawImage(bitmap, 0, 0, dw, dh);

      const photo = await encodeCanvasToPhotoBlob(canvas, WEBP_QUALITY_MAIN);
      if (!photo || photo.size === 0) {
        dexieDebugWarn(`${TAG} toBlob vacío → cloneBuffer`);
        const fallback = await cloneBlobForIndexedDb(source);
        return { photo: fallback };
      }

      let thumbnail: Blob | undefined;
      const tc = document.createElement("canvas");
      tc.width = THUMB_SIZE;
      tc.height = THUMB_SIZE;
      const tctx = tc.getContext("2d");
      if (tctx) {
        const coverScale = Math.max(THUMB_SIZE / sw, THUMB_SIZE / sh);
        const tw = Math.round(sw * coverScale);
        const th = Math.round(sh * coverScale);
        tctx.drawImage(
          bitmap,
          (THUMB_SIZE - tw) / 2,
          (THUMB_SIZE - th) / 2,
          tw,
          th,
        );
        const tb = await encodeCanvasToPhotoBlob(tc, WEBP_QUALITY_THUMB);
        if (tb && tb.size > 0) thumbnail = tb;
      }

      dexieDebugInfo(`${TAG} salida`, {
        size: photo.size,
        type: photo.type,
        canvas: `${dw}x${dh}`,
        orig: `${sw}x${sh}`,
        thumbSize: thumbnail?.size,
        thumbType: thumbnail?.type,
      });
      return { photo, thumbnail };
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
    const photo = await cloneBlobForIndexedDb(source);
    return { photo };
  }
}

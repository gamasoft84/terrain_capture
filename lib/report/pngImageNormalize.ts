/**
 * Antes del PNG de historia: reduce JPEG solo la galería (fotos grandes).
 * La captura del mapa se deja en PNG tal cual viene del motor (Mapbox/WebGL,
 * Google o MapLibre) para no aplastar transparencia a negro.
 */

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function bitmapFromBlob(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* continuar con <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("img"));
    el.src = url;
  });
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(img);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error("createImageBitmap");
}

/** Escala una imagen (data URL) a JPEG con lado máximo `maxSide`. */
export async function downscaleToJpegDataUrl(
  src: string,
  maxSide: number,
  quality = 0.88,
): Promise<string> {
  if (!src.startsWith("data:")) {
    return src;
  }

  const blob = await blobFromDataUrl(src);
  const bmp = await bitmapFromBlob(blob);
  try {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d");

    ctx.drawImage(bmp, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    return out.length > 32 ? out : src;
  } finally {
    bmp.close();
  }
}

export async function normalizeTerrainReportPngRasterSources(input: {
  mapImageDataUrl: string | null;
  galleryImages: readonly { src: string | null }[];
}): Promise<{
  mapImageDataUrl: string | null;
  galleryImages: { src: string | null }[];
}> {
  /**
   * No convertir la captura del mapa a JPEG: el canvas WebGL suele exportar PNG
   * con alpha; al rasterizar a JPEG las zonas transparentes pasan a negro y la
   * franja del mapa en el PNG del reporte queda “vacía” o negra.
   */
  const mapImageDataUrl = input.mapImageDataUrl;

  const galleryImages = await Promise.all(
    input.galleryImages.map(async (g) => {
      const s = g.src;
      if (!s?.startsWith("data:")) return { src: s };
      try {
        return { src: await downscaleToJpegDataUrl(s, 720) };
      } catch {
        return { src: s };
      }
    }),
  );

  return { mapImageDataUrl, galleryImages };
}

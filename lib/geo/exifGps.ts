export type ExifGpsPosition = {
  latitude: number;
  longitude: number;
};

/**
 * Lee lat/lng desde EXIF de una imagen (JPEG/HEIC según soporte del navegador y exifr).
 */
export async function extractGpsFromImageFile(
  file: File | Blob,
): Promise<ExifGpsPosition | null> {
  try {
    const { gps } = await import("exifr");
    const g = await gps(file);
    if (
      g &&
      typeof g.latitude === "number" &&
      typeof g.longitude === "number" &&
      Number.isFinite(g.latitude) &&
      Number.isFinite(g.longitude)
    ) {
      return { latitude: g.latitude, longitude: g.longitude };
    }
  } catch {
    /* sin EXIF o formato no soportado */
  }
  return null;
}

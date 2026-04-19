/** Rectángulo orientativo México continental + Baja/islas (no es frontera política exacta). */

export function isLikelyMexicoRegion(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 14 && lat <= 33 && lng <= -86 && lng >= -119;
}

/** `true` si el usuario confirma guardar porque cree que las coords son correctas. */
export function confirmIfOutsideMexicoRegion(lat: number, lng: number): boolean {
  if (isLikelyMexicoRegion(lat, lng)) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(
    [
      "Las coordenadas quedan fuera del ámbito habitual usado por esta app para México (~14°–33° N, ~119°–86° O).",
      "",
      "¿Las diste en otro país o zona y quieres guardar igual?",
    ].join("\n"),
  );
}

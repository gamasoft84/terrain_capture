/** Logs ruidosos de IndexedDB/fotos solo en desarrollo. */
export function isDexieDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function dexieDebugInfo(...args: unknown[]): void {
  if (isDexieDebugEnabled()) console.info("[TerrainCapture:Dexie]", ...args);
}

export function dexieDebugWarn(...args: unknown[]): void {
  if (isDexieDebugEnabled()) console.warn("[TerrainCapture:Dexie]", ...args);
}

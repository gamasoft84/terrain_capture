/** Zoom máximo tras `fitBounds` al ver un proyecto (satélite con teselas fiables). */

export const MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT = 16;
export const MAP_FIT_BOUNDS_MAX_ZOOM_MIN = 12;
export const MAP_FIT_BOUNDS_MAX_ZOOM_MAX = 20;

export const MAP_FIT_BOUNDS_MAX_ZOOM_STORAGE_KEY =
  "terraincapture:mapFitBoundsMaxZoom";

export const MAP_FIT_BOUNDS_MAX_ZOOM_CHANGED_EVENT =
  "terraincapture:map-fit-bounds-max-zoom";

let clientSnapshotReady = false;

function clampZoom(n: number): number {
  const z = Math.round(Number(n));
  if (!Number.isFinite(z)) return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
  return Math.min(
    MAP_FIT_BOUNDS_MAX_ZOOM_MAX,
    Math.max(MAP_FIT_BOUNDS_MAX_ZOOM_MIN, z),
  );
}

export function readMapFitBoundsMaxZoom(): number {
  if (typeof window === "undefined") return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
  try {
    const raw = window.localStorage.getItem(MAP_FIT_BOUNDS_MAX_ZOOM_STORAGE_KEY);
    if (raw == null || raw === "") return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
    return clampZoom(Number.parseInt(raw, 10));
  } catch {
    return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
  }
}

export function getMapFitBoundsMaxZoomSnapshot(): number {
  if (typeof window === "undefined") return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
  if (!clientSnapshotReady) return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
  return readMapFitBoundsMaxZoom();
}

export function getMapFitBoundsMaxZoomServerSnapshot(): number {
  return MAP_FIT_BOUNDS_MAX_ZOOM_DEFAULT;
}

export function subscribeMapFitBoundsMaxZoom(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  queueMicrotask(() => {
    if (!clientSnapshotReady) {
      clientSnapshotReady = true;
      onStoreChange();
    }
  });

  const onCustom = () => {
    clientSnapshotReady = true;
    onStoreChange();
  };
  const onStorage = () => {
    clientSnapshotReady = true;
    onStoreChange();
  };
  window.addEventListener(MAP_FIT_BOUNDS_MAX_ZOOM_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MAP_FIT_BOUNDS_MAX_ZOOM_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeMapFitBoundsMaxZoom(value: number): void {
  if (typeof window === "undefined") return;
  const z = clampZoom(value);
  try {
    window.localStorage.setItem(
      MAP_FIT_BOUNDS_MAX_ZOOM_STORAGE_KEY,
      String(z),
    );
    window.dispatchEvent(new Event(MAP_FIT_BOUNDS_MAX_ZOOM_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

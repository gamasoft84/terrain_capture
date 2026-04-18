/** Preferencia local: mover vértices en el mapa (solo pruebas / escritorio). */

export const VERTEX_MAP_DRAG_STORAGE_KEY = "terraincapture:allowVertexMapDrag";

export const VERTEX_MAP_DRAG_CHANGED_EVENT = "terraincapture:vertex-map-drag";

/** Evita mismatch SSR/cliente: hasta el primer microtask devolvemos false. */
let clientDragPrefSnapshotReady = false;

export function readAllowVertexMapDrag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VERTEX_MAP_DRAG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getAllowVertexMapDragSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!clientDragPrefSnapshotReady) return false;
  return readAllowVertexMapDrag();
}

export function getAllowVertexMapDragServerSnapshot(): boolean {
  return false;
}

/** Suscripción para useSyncExternalStore (localStorage + eventos). */
export function subscribeAllowVertexMapDrag(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  queueMicrotask(() => {
    if (!clientDragPrefSnapshotReady) {
      clientDragPrefSnapshotReady = true;
      onStoreChange();
    }
  });

  const onCustom = () => {
    clientDragPrefSnapshotReady = true;
    onStoreChange();
  };
  const onStorage = () => {
    clientDragPrefSnapshotReady = true;
    onStoreChange();
  };
  window.addEventListener(VERTEX_MAP_DRAG_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(VERTEX_MAP_DRAG_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeAllowVertexMapDrag(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(VERTEX_MAP_DRAG_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(VERTEX_MAP_DRAG_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(VERTEX_MAP_DRAG_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

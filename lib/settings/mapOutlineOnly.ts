/** Preferencia local: mapa en modo “solo contorno” (trazo fino, sin globos P1…). */

export const MAP_OUTLINE_ONLY_STORAGE_KEY = "terraincapture:mapOutlineOnly";

export const MAP_OUTLINE_ONLY_CHANGED_EVENT = "terraincapture:map-outline-only";

let clientOutlineSnapshotReady = false;

export function readMapOutlineOnly(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MAP_OUTLINE_ONLY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getMapOutlineOnlySnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!clientOutlineSnapshotReady) return false;
  return readMapOutlineOnly();
}

export function getMapOutlineOnlyServerSnapshot(): boolean {
  return false;
}

export function subscribeMapOutlineOnly(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  queueMicrotask(() => {
    if (!clientOutlineSnapshotReady) {
      clientOutlineSnapshotReady = true;
      onStoreChange();
    }
  });

  const onCustom = () => {
    clientOutlineSnapshotReady = true;
    onStoreChange();
  };
  const onStorage = () => {
    clientOutlineSnapshotReady = true;
    onStoreChange();
  };
  window.addEventListener(MAP_OUTLINE_ONLY_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MAP_OUTLINE_ONLY_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeMapOutlineOnly(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(MAP_OUTLINE_ONLY_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MAP_OUTLINE_ONLY_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(MAP_OUTLINE_ONLY_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

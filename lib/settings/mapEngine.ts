/** Motor de mapa preferido (UI + render). */

export const MAP_ENGINE_STORAGE_KEY = "terraincapture:mapEngine";

export const MAP_ENGINE_CHANGED_EVENT = "terraincapture:map-engine";

export type MapEngineId = "mapbox" | "google" | "maplibre";

const VALID = new Set<MapEngineId>(["mapbox", "google", "maplibre"]);

let clientSnapshotReady = false;

function parse(raw: string | null): MapEngineId {
  if (!raw || !VALID.has(raw as MapEngineId)) return "mapbox";
  return raw as MapEngineId;
}

export function readMapEngine(): MapEngineId {
  if (typeof window === "undefined") return "mapbox";
  try {
    return parse(window.localStorage.getItem(MAP_ENGINE_STORAGE_KEY));
  } catch {
    return "mapbox";
  }
}

export function getMapEngineSnapshot(): MapEngineId {
  if (typeof window === "undefined") return "mapbox";
  if (!clientSnapshotReady) return "mapbox";
  return readMapEngine();
}

export function getMapEngineServerSnapshot(): MapEngineId {
  return "mapbox";
}

export function subscribeMapEngine(onStoreChange: () => void) {
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
  window.addEventListener(MAP_ENGINE_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MAP_ENGINE_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeMapEngine(value: MapEngineId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAP_ENGINE_STORAGE_KEY, value);
    window.dispatchEvent(new Event(MAP_ENGINE_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

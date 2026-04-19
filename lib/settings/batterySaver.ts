/** Modo ahorro de batería: GPS con menor precisión (`enableHighAccuracy: false`) para uso prolongado en campo. */

export const BATTERY_SAVER_STORAGE_KEY = "terraincapture:batterySaver";

export const BATTERY_SAVER_CHANGED_EVENT = "terraincapture:battery-saver";

let clientBatterySaverSnapshotReady = false;

export function readBatterySaverEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BATTERY_SAVER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getBatterySaverSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!clientBatterySaverSnapshotReady) return false;
  return readBatterySaverEnabled();
}

export function getBatterySaverServerSnapshot(): boolean {
  return false;
}

export function subscribeBatterySaver(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  queueMicrotask(() => {
    if (!clientBatterySaverSnapshotReady) {
      clientBatterySaverSnapshotReady = true;
      onStoreChange();
    }
  });

  const onCustom = () => {
    clientBatterySaverSnapshotReady = true;
    onStoreChange();
  };
  const onStorage = () => {
    clientBatterySaverSnapshotReady = true;
    onStoreChange();
  };
  window.addEventListener(BATTERY_SAVER_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(BATTERY_SAVER_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeBatterySaverEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(BATTERY_SAVER_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(BATTERY_SAVER_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(BATTERY_SAVER_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Preferencia local: modo campo (UI más limpia + mapa enfocado a perímetro). */

export const FIELD_MODE_STORAGE_KEY = "terraincapture:fieldMode";
export const FIELD_MODE_CHANGED_EVENT = "terraincapture:field-mode";

let clientSnapshotReady = false;

export function readFieldModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIELD_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getFieldModeSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!clientSnapshotReady) return false;
  return readFieldModeEnabled();
}

export function getFieldModeServerSnapshot(): boolean {
  return false;
}

export function subscribeFieldMode(onStoreChange: () => void) {
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
  window.addEventListener(FIELD_MODE_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FIELD_MODE_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeFieldModeEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(FIELD_MODE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(FIELD_MODE_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(FIELD_MODE_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}


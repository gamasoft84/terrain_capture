/** Último proyecto visitado (solo preferencia de navegación; datos en Dexie). */

export const LAST_PROJECT_LOCAL_ID_STORAGE_KEY =
  "terraincapture:lastProjectLocalId";

export const LAST_PROJECT_LOCAL_ID_CHANGED_EVENT =
  "terraincapture:last-project-local-id";

let clientSnapshotReady = false;

export function readLastProjectLocalId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LAST_PROJECT_LOCAL_ID_STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function getLastProjectLocalIdSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  if (!clientSnapshotReady) return null;
  return readLastProjectLocalId();
}

export function getLastProjectLocalIdServerSnapshot(): string | null {
  return null;
}

export function subscribeLastProjectLocalId(onStoreChange: () => void) {
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
  window.addEventListener(LAST_PROJECT_LOCAL_ID_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LAST_PROJECT_LOCAL_ID_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeLastProjectLocalId(localId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROJECT_LOCAL_ID_STORAGE_KEY, localId);
    window.dispatchEvent(new Event(LAST_PROJECT_LOCAL_ID_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Desde `/projects/:id` o subrutas; ignora `/projects/new`. */
export function rememberLastProjectFromPathname(pathname: string): void {
  const m = pathname.match(/^\/projects\/([^/]+)/);
  if (!m) return;
  const id = m[1];
  if (!id || id === "new") return;
  writeLastProjectLocalId(id);
}

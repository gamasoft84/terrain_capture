import { isDexieDebugEnabled } from "@/lib/db/dexieDebugLog";

const TAG = "[TerrainCapture:Dexie]";

/** Contexto útil cuando IndexedDB rechaza un Blob (p. ej. Safari UnknownError). */
export async function logDexieBlobFailure(
  operation: string,
  err: unknown,
  meta: Record<string, unknown>,
): Promise<void> {
  const name =
    err instanceof DOMException
      ? err.name
      : err instanceof Error
        ? err.name
        : typeof err;
  const message =
    err instanceof DOMException || err instanceof Error
      ? err.message
      : String(err);
  const code = err instanceof DOMException ? err.code : undefined;

  console.error(`${TAG} ${operation} falló`, {
    name,
    message,
    code,
    ...meta,
  });

  if (!isDexieDebugEnabled()) return;

  try {
    const est = await globalThis.navigator?.storage?.estimate?.();
    if (est) {
      console.error(`${TAG} espacio estimado (navigator.storage)`, {
        usageBytes: est.usage,
        quotaBytes: est.quota,
        usageMB:
          est.usage != null ? Math.round((est.usage / 1e6) * 10) / 10 : null,
        quotaMB:
          est.quota != null ? Math.round((est.quota / 1e6) * 10) / 10 : null,
      });
    }
  } catch {
    /* ignore */
  }

  if (err instanceof Error && err.stack) {
    console.error(`${TAG} stack`, err.stack);
  }
}

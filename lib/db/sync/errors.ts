/** Máx. intentos de subida a Storage por ciclo de sync antes de marcar error. */
export const MAX_PHOTO_UPLOAD_ATTEMPTS = 3;

/** Fila esperada en Postgres ya no existe (p. ej. borrada en dashboard). */
export class RemoteEntityGoneError extends Error {
  readonly code = "REMOTE_ENTITY_GONE" as const;
  constructor(
    readonly entityType:
      | "vertex"
      | "poi"
      | "polygon"
      | "project"
      | "photo",
    readonly localId: string,
  ) {
    super(`El registro remoto ya no existe (${entityType} · ${localId})`);
    this.name = "RemoteEntityGoneError";
  }
}

/** Subida a Storage falló tras el máximo de intentos en esta corrida de sync. */
export class PhotoUploadExhaustedError extends Error {
  readonly code = "PHOTO_UPLOAD_EXHAUSTED" as const;
  constructor(
    readonly entityType: "vertex" | "poi" | "photo",
    readonly localId: string,
  ) {
    super(`No se pudo subir la foto tras varios intentos (${entityType})`);
    this.name = "PhotoUploadExhaustedError";
  }
}

export function isRemoteEntityGoneError(e: unknown): e is RemoteEntityGoneError {
  return e instanceof RemoteEntityGoneError;
}

export function isPhotoUploadExhaustedError(
  e: unknown,
): e is PhotoUploadExhaustedError {
  return e instanceof PhotoUploadExhaustedError;
}

/** Supabase/PostgREST suele lanzar objetos planos; evita `[object Object]` en la cola. */
export function formatSyncError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) return o.message;
    if (typeof o.error === "string" && o.error.length > 0) return o.error;
    if (typeof o.details === "string" && o.details.length > 0) return o.details;
    if (typeof o.hint === "string" && o.hint.length > 0) return o.hint;
    if (typeof o.code === "string" && o.code.length > 0) {
      try {
        return JSON.stringify({ code: o.code, message: o.message, details: o.details });
      } catch {
        return o.code;
      }
    }
    try {
      return JSON.stringify(err);
    } catch {
      /* fall through */
    }
  }
  return String(err);
}

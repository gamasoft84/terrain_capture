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

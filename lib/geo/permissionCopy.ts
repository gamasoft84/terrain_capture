/** Mensajes claros sobre permisos en iPhone / Safari (bloque único para copiar desde UI). */

export const IOS_LOCATION_SETTINGS_PATH =
  "Ajustes → Privacidad y seguridad → Ubicación → Safari Websites → TerrainCapture / Safari → «Al usar la app» o «Preguntar». Si usas otro navegador, revisa ubicación para ese navegador.";

export const IOS_CAMERA_SETTINGS_PATH =
  "Ajustes → Safari → Cámara y micrófono → permitir cuando el sitio lo solicite (o revisa Pantalla de inicio si añadiste la PWA).";

/** Texto para código 1 (permiso denegado) según sea GPS o uso genérico. */
export function geolocationDeniedHint(): string {
  return [
    "Ubicación denegada.",
    IOS_LOCATION_SETTINGS_PATH,
    "Luego recarga esta página y vuelve a intentar.",
  ].join(" ");
}

export function cameraPermissionHint(): string {
  return IOS_CAMERA_SETTINGS_PATH;
}

/** Versión corta debajo de botones cámara/galería en formularios. */
export function cameraPermissionShortLine(): string {
  return "iPhone: si la cámara no abre, revisa Ajustes → Safari → Cámara / micrófono para este sitio.";
}

/** Normaliza errores devueltos por la API de geolocalización para el usuario final. */
export function formatGeolocationUserMessage(
  err: GeolocationPositionError | Pick<GeolocationPositionError, "code" | "message">,
): string {
  switch (err.code) {
    case 1:
      return geolocationDeniedHint();
    case 2:
      return [
        "Posición no disponible.",
        "Comprueba que los servicios de ubicación estén activos en el sistema.",
      ].join(" ");
    case 3:
      return [
        "Tiempo de espera agotado esperando GPS.",
        "En interior o escritorio suele tardar más: repetir al aire libre o revisar ubicación para Safari.",
        IOS_LOCATION_SETTINGS_PATH,
      ].join(" ");
    default:
      return err.message?.trim() || "Error de ubicación.";
  }
}

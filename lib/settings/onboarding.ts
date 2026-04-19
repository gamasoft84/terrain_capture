/** Tour de bienvenida y textos de permisos (campo / iOS). */

export const WELCOME_TOUR_DONE_KEY = "terraincapture:welcomeTourV1";

export const FIELD_PERMISSIONS_INTRO_DONE_KEY =
  "terraincapture:fieldPermissionsIntroV1";

export function readWelcomeTourDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(WELCOME_TOUR_DONE_KEY) === "1") {
      return true;
    }
    /** Instalaciones anteriores al tour: ya vieron la intro de permisos. */
    if (
      window.localStorage.getItem(FIELD_PERMISSIONS_INTRO_DONE_KEY) === "1"
    ) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function writeWelcomeTourDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_TOUR_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readFieldPermissionsIntroDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(FIELD_PERMISSIONS_INTRO_DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeFieldPermissionsIntroDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIELD_PERMISSIONS_INTRO_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

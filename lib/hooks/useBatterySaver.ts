"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getBatterySaverServerSnapshot,
  getBatterySaverSnapshot,
  subscribeBatterySaver,
  writeBatterySaverEnabled,
} from "@/lib/settings/batterySaver";

/** Preferencia activa: modo ahorro de batería (GPS menos preciso). */
export function useBatterySaverEnabled(): boolean {
  return useSyncExternalStore(
    subscribeBatterySaver,
    getBatterySaverSnapshot,
    getBatterySaverServerSnapshot,
  );
}

export function useBatterySaverControls(): {
  batterySaverEnabled: boolean;
  setBatterySaverEnabled: (value: boolean) => void;
} {
  const batterySaverEnabled = useBatterySaverEnabled();
  const setBatterySaverEnabled = useCallback((value: boolean) => {
    writeBatterySaverEnabled(value);
  }, []);
  return { batterySaverEnabled, setBatterySaverEnabled };
}

/**
 * `true` = GPS de alta precisión (recomendado para captura fina).
 * `false` = modo ahorro de batería activo en Ajustes.
 */
export function useHighAccuracyGpsDesired(): boolean {
  return !useBatterySaverEnabled();
}

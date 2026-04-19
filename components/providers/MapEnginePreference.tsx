"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { MapEngineId } from "@/lib/settings/mapEngine";
import {
  getMapEngineServerSnapshot,
  getMapEngineSnapshot,
  subscribeMapEngine,
  writeMapEngine,
} from "@/lib/settings/mapEngine";

type Ctx = {
  mapEngine: MapEngineId;
  setMapEngine: (value: MapEngineId) => void;
};

const MapEngineContext = createContext<Ctx | null>(null);

export function MapEnginePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mapEngine = useSyncExternalStore(
    subscribeMapEngine,
    getMapEngineSnapshot,
    getMapEngineServerSnapshot,
  );

  const setMapEngine = useCallback((value: MapEngineId) => {
    writeMapEngine(value);
  }, []);

  const value = useMemo(
    () => ({ mapEngine, setMapEngine }),
    [mapEngine, setMapEngine],
  );

  return (
    <MapEngineContext.Provider value={value}>{children}</MapEngineContext.Provider>
  );
}

export function useMapEngine(): Ctx {
  const ctx = useContext(MapEngineContext);
  if (!ctx) {
    throw new Error(
      "useMapEngine debe usarse dentro de MapEnginePreferenceProvider",
    );
  }
  return ctx;
}

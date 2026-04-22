"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getMapOutlineOnlyServerSnapshot,
  getMapOutlineOnlySnapshot,
  subscribeMapOutlineOnly,
  writeMapOutlineOnly,
} from "@/lib/settings/mapOutlineOnly";

type Ctx = {
  mapOutlineOnly: boolean;
  setMapOutlineOnly: (value: boolean) => void;
};

const MapOutlineOnlyContext = createContext<Ctx | null>(null);

export function MapOutlineOnlyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mapOutlineOnly = useSyncExternalStore(
    subscribeMapOutlineOnly,
    getMapOutlineOnlySnapshot,
    getMapOutlineOnlyServerSnapshot,
  );

  const setMapOutlineOnly = useCallback((value: boolean) => {
    writeMapOutlineOnly(value);
  }, []);

  const value = useMemo(
    () => ({ mapOutlineOnly, setMapOutlineOnly }),
    [mapOutlineOnly, setMapOutlineOnly],
  );

  return (
    <MapOutlineOnlyContext.Provider value={value}>
      {children}
    </MapOutlineOnlyContext.Provider>
  );
}

export function useMapOutlineOnly(): Ctx {
  const ctx = useContext(MapOutlineOnlyContext);
  if (!ctx) {
    throw new Error(
      "useMapOutlineOnly debe usarse dentro de MapOutlineOnlyProvider",
    );
  }
  return ctx;
}

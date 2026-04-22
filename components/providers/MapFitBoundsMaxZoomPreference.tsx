"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getMapFitBoundsMaxZoomServerSnapshot,
  getMapFitBoundsMaxZoomSnapshot,
  subscribeMapFitBoundsMaxZoom,
  writeMapFitBoundsMaxZoom,
} from "@/lib/settings/mapFitBoundsMaxZoom";

type Ctx = {
  mapFitBoundsMaxZoom: number;
  setMapFitBoundsMaxZoom: (value: number) => void;
};

const MapFitBoundsMaxZoomContext = createContext<Ctx | null>(null);

export function MapFitBoundsMaxZoomProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mapFitBoundsMaxZoom = useSyncExternalStore(
    subscribeMapFitBoundsMaxZoom,
    getMapFitBoundsMaxZoomSnapshot,
    getMapFitBoundsMaxZoomServerSnapshot,
  );

  const setMapFitBoundsMaxZoom = useCallback((value: number) => {
    writeMapFitBoundsMaxZoom(value);
  }, []);

  const value = useMemo(
    () => ({ mapFitBoundsMaxZoom, setMapFitBoundsMaxZoom }),
    [mapFitBoundsMaxZoom, setMapFitBoundsMaxZoom],
  );

  return (
    <MapFitBoundsMaxZoomContext.Provider value={value}>
      {children}
    </MapFitBoundsMaxZoomContext.Provider>
  );
}

export function useMapFitBoundsMaxZoom(): Ctx {
  const ctx = useContext(MapFitBoundsMaxZoomContext);
  if (!ctx) {
    throw new Error(
      "useMapFitBoundsMaxZoom debe usarse dentro de MapFitBoundsMaxZoomProvider",
    );
  }
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getAllowVertexMapDragServerSnapshot,
  getAllowVertexMapDragSnapshot,
  subscribeAllowVertexMapDrag,
  writeAllowVertexMapDrag,
} from "@/lib/settings/mapVertexDrag";

type Ctx = {
  allowVertexMapDrag: boolean;
  setAllowVertexMapDrag: (value: boolean) => void;
};

const MapVertexDragContext = createContext<Ctx | null>(null);

export function MapVertexDragProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowVertexMapDrag = useSyncExternalStore(
    subscribeAllowVertexMapDrag,
    getAllowVertexMapDragSnapshot,
    getAllowVertexMapDragServerSnapshot,
  );

  const setAllowVertexMapDrag = useCallback((value: boolean) => {
    writeAllowVertexMapDrag(value);
  }, []);

  const value = useMemo(
    () => ({ allowVertexMapDrag, setAllowVertexMapDrag }),
    [allowVertexMapDrag, setAllowVertexMapDrag],
  );

  return (
    <MapVertexDragContext.Provider value={value}>
      {children}
    </MapVertexDragContext.Provider>
  );
}

export function useMapVertexDrag(): Ctx {
  const ctx = useContext(MapVertexDragContext);
  if (!ctx) {
    throw new Error("useMapVertexDrag debe usarse dentro de MapVertexDragProvider");
  }
  return ctx;
}

"use client";

import { useCallback, useRef, useState } from "react";
import { countTilesForBounds, type LngLatBoundsLiteral } from "@/lib/map/esri-tiles";
import {
  precacheArea,
  type PrecacheAreaResult,
  type TilePrecacheProgress,
} from "@/lib/map/tile-cache";

export function useTileCache() {
  const [progress, setProgress] = useState<TilePrecacheProgress | null>(null);
  const [lastResult, setLastResult] = useState<PrecacheAreaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startPrecache = useCallback(
    async (bounds: LngLatBoundsLiteral, minZoom: number, maxZoom: number) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setError(null);
      setLastResult(null);
      setProgress({ done: 0, total: 0, phase: "counting" });

      try {
        const result = await precacheArea(bounds, minZoom, maxZoom, {
          signal: ac.signal,
          onProgress: setProgress,
        });
        setLastResult(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setProgress((prev) =>
          prev
            ? { ...prev, phase: "error", total: prev.total }
            : { done: 0, total: 0, phase: "error" },
        );
      }
    },
    [],
  );

  const cancelPrecache = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const estimateTileCount = useCallback(
    (area: LngLatBoundsLiteral, minZoom: number, maxZoom: number) =>
      countTilesForBounds(area, minZoom, maxZoom),
    [],
  );

  const busy =
    progress?.phase === "fetching" ||
    progress?.phase === "counting";

  return {
    busy,
    progress,
    lastResult,
    error,
    startPrecache,
    cancelPrecache,
    estimateTileCount,
  };
}

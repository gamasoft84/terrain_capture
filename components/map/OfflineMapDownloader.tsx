"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { LngLatBoundsLiteral } from "@/lib/map/esri-tiles";
import { useTileCache } from "@/lib/hooks/useTileCache";
import {
  ESRI_RASTER_ATTRIBUTION,
  ensureTerrainCacheProtocol,
  terrainCacheRasterTiles,
} from "@/lib/map/tile-providers";

const DEFAULT_CENTER: [number, number] = [-96.13, 15.87];
const DEFAULT_ZOOM = 12;

const ZOOM_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export function OfflineMapDownloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bounds, setBounds] = useState<LngLatBoundsLiteral | null>(null);
  const [minZoom, setMinZoom] = useState(12);
  const [maxZoom, setMaxZoom] = useState(16);

  const {
    busy,
    progress,
    error,
    lastResult,
    startPrecache,
    cancelPrecache,
    estimateTileCount,
  } = useTileCache();

  const syncBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    setBounds({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ensureTerrainCacheProtocol();

    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          esri: {
            type: "raster",
            tiles: terrainCacheRasterTiles,
            tileSize: 256,
            attribution: ESRI_RASTER_ATTRIBUTION,
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: "esri-offline-preview",
            type: "raster",
            source: "esri",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", syncBounds);
    map.on("moveend", syncBounds);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [syncBounds]);

  const lo = Math.min(minZoom, maxZoom);
  const hi = Math.max(minZoom, maxZoom);
  const estimated =
    bounds != null ? estimateTileCount(bounds, lo, hi) : null;

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="border-border bg-muted/30 relative h-[min(22rem,55vh)] w-full overflow-hidden rounded-xl border"
      />

      <p className="text-muted-foreground text-xs leading-snug">
        Muévete por el satélital hasta cubrir la zona que quieras usar sin datos. Las
        teselas se guardan solo en este dispositivo (Dexie); el mismo mapa del proyecto
        las usará cuando no haya red.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tile-min-z">Zoom mínimo</Label>
          <select
            id="tile-min-z"
            value={minZoom}
            disabled={busy}
            onChange={(e) => setMinZoom(Number(e.target.value))}
            className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            {ZOOM_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tile-max-z">Zoom máximo</Label>
          <select
            id="tile-max-z"
            value={maxZoom}
            disabled={busy}
            onChange={(e) => setMaxZoom(Number(e.target.value))}
            className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            {ZOOM_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {estimated != null && (
        <p className="text-muted-foreground font-mono text-xs">
          ≈ {estimated.toLocaleString("es-MX")} teselas en esta vista y rango (máx.
          12&nbsp;000 por descarga).
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy || bounds == null}
          onClick={() => bounds && startPrecache(bounds, lo, hi)}
        >
          {busy ? "Descargando…" : "Descargar mapa de esta zona"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!busy}
          onClick={() => cancelPrecache()}
        >
          Cancelar
        </Button>
      </div>

      {busy && progress && progress.total > 0 && (
        <div className="space-y-1">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            {progress.done.toLocaleString("es-MX")} /{" "}
            {progress.total.toLocaleString("es-MX")} ({pct}%)
            {progress.currentZoom != null ? ` · z${progress.currentZoom}` : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm leading-snug" role="alert">
          {error}
        </p>
      )}

      {!busy && lastResult && progress?.phase !== "error" && (
        <p className="text-muted-foreground text-sm leading-snug">
          {progress?.phase === "cancelled"
            ? "Descarga detenida."
            : `Listo: ${lastResult.downloaded.toLocaleString("es-MX")} nuevas, ${lastResult.skipped.toLocaleString("es-MX")} ya estaban${
                lastResult.failed > 0
                  ? `, ${lastResult.failed.toLocaleString("es-MX")} fallidas`
                  : ""
              }.`}
        </p>
      )}
    </div>
  );
}

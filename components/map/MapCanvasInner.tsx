"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Position } from "geojson";
import * as turf from "@turf/turf";
import { cn } from "@/lib/utils";
import type { LocalVertex } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { updateVertex } from "@/lib/db/vertices";

const ESRI_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const DEFAULT_CENTER: [number, number] = [-96.13, 15.87];
const DEFAULT_ZOOM = 14;

const SOURCE_ID = "terrain-geo";
const FILL_LAYER_ID = "terrain-fill";
const LINE_LAYER_ID = "terrain-line";

export interface MapCanvasProps {
  vertices: LocalVertex[];
  isClosed: boolean;
  areaM2?: number | null;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  showUserLocation?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  /** Si true y hay `vertexDragTarget`, los marcadores P1… son arrastrables (pruebas). */
  allowVertexDrag?: boolean;
  /** Polígono al que pertenecen los vértices (para persistir coords al soltar). */
  vertexDragTarget?: {
    polygonLocalId: string;
    polygonIsClosed: boolean;
  } | null;
}

function sortedVertices(vertices: LocalVertex[]): LocalVertex[] {
  return [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
}

function formatAreaLabel(areaM2: number): string {
  if (areaM2 >= 10_000) return `${(areaM2 / 10_000).toFixed(2)} ha`;
  return `${areaM2.toFixed(1)} m²`;
}

function buildFeatureCollection(
  vertices: LocalVertex[],
  isClosed: boolean,
): FeatureCollection {
  const sorted = sortedVertices(vertices);
  const coords: Position[] = sorted.map((v) => [v.longitude, v.latitude]);
  const features: Feature[] = [];

  if (coords.length >= 2) {
    const lineCoords: Position[] =
      isClosed && coords.length >= 3 ? [...coords, coords[0]!] : [...coords];
    features.push({
      type: "Feature",
      properties: { kind: "line" },
      geometry: { type: "LineString", coordinates: lineCoords },
    });
  }

  if (isClosed && coords.length >= 3) {
    const ring = [...coords, coords[0]!];
    features.push({
      type: "Feature",
      properties: { kind: "fill" },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  return { type: "FeatureCollection", features };
}

function createVertexMarkerEl(index: number, draggable: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cn(
    "border-background flex size-8 items-center justify-center rounded-full border-2 bg-primary text-xs font-bold text-primary-foreground shadow-md",
    draggable &&
      "cursor-grab touch-none ring-2 ring-amber-500/80 active:cursor-grabbing",
  );
  el.textContent = `P${index + 1}`;
  return el;
}

function createAreaLabelEl(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    "bg-background/90 text-foreground border-primary/40 pointer-events-none rounded-md border px-2 py-1 font-mono text-xs font-semibold shadow-lg";
  el.textContent = text;
  return el;
}

export default function MapCanvasInner({
  vertices,
  isClosed,
  areaM2,
  onMapClick,
  showUserLocation = true,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  className,
  allowVertexDrag = false,
  vertexDragTarget = null,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const areaMarkerRef = useRef<maplibregl.Marker | null>(null);
  const styleReadyRef = useRef(false);
  const vertexCountForFitRef = useRef(-1);
  const didFitForCurrentVertexSetRef = useRef(false);
  const onClickRef = useRef(onMapClick);
  const dataRef = useRef({
    vertices,
    isClosed,
    areaM2,
    allowVertexDrag,
    vertexDragTarget,
  });
  const mountOptsRef = useRef({
    initialCenter,
    initialZoom,
    showUserLocation,
  });

  useLayoutEffect(() => {
    onClickRef.current = onMapClick;
    dataRef.current = {
      vertices,
      isClosed,
      areaM2,
      allowVertexDrag,
      vertexDragTarget,
    };
    mountOptsRef.current = { initialCenter, initialZoom, showUserLocation };
  }, [
    onMapClick,
    vertices,
    isClosed,
    areaM2,
    allowVertexDrag,
    vertexDragTarget,
    initialCenter,
    initialZoom,
    showUserLocation,
  ]);

  const syncMap = useCallback((map: maplibregl.Map) => {
    const {
      vertices: v,
      isClosed: closed,
      areaM2: area,
      allowVertexDrag: dragPref,
      vertexDragTarget: dragCtx,
    } = dataRef.current;
    const sorted = sortedVertices(v);
    const coords: Position[] = sorted.map((vertex) => [
      vertex.longitude,
      vertex.latitude,
    ]);

    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(buildFeatureCollection(v, closed));
    }

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const dragEnabled = Boolean(dragPref && dragCtx);

    sorted.forEach((vertex, i) => {
      const marker = new maplibregl.Marker({
        element: createVertexMarkerEl(i, dragEnabled),
        draggable: dragEnabled,
      })
        .setLngLat([vertex.longitude, vertex.latitude])
        .addTo(map);

      if (dragEnabled && dragCtx) {
        marker.on("dragend", () => {
          const ll = marker.getLngLat();
          const ctx = dataRef.current.vertexDragTarget;
          if (!ctx) return;
          void (async () => {
            try {
              await updateVertex(vertex.localId, {
                latitude: ll.lat,
                longitude: ll.lng,
                captureMethod: "manual_map",
              });
              await refreshPolygonMetricsFromVertices(
                ctx.polygonLocalId,
                ctx.polygonIsClosed,
              );
            } catch {
              marker.setLngLat([vertex.longitude, vertex.latitude]);
            }
          })();
        });
      }

      markersRef.current.push(marker);
    });

    areaMarkerRef.current?.remove();
    areaMarkerRef.current = null;

    if (closed && coords.length >= 3 && area != null && Number.isFinite(area)) {
      const ring = [...coords, coords[0]!];
      const poly = turf.polygon([ring]);
      const c = turf.centroid(poly);
      const [lng, lat] = c.geometry.coordinates;
      const label = createAreaLabelEl(formatAreaLabel(area));
      areaMarkerRef.current = new maplibregl.Marker({ element: label })
        .setLngLat([lng, lat])
        .addTo(map);
    }

    if (coords.length === 0) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      return;
    }

    const bounds = new maplibregl.LngLatBounds(
      coords[0] as [number, number],
      coords[0] as [number, number],
    );
    for (const pt of coords) bounds.extend(pt as [number, number]);

    if (!dragPref) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      return;
    }

    if (coords.length !== vertexCountForFitRef.current) {
      vertexCountForFitRef.current = coords.length;
      didFitForCurrentVertexSetRef.current = false;
    }
    if (!didFitForCurrentVertexSetRef.current) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      didFitForCurrentVertexSetRef.current = true;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { initialCenter: ic, initialZoom: iz, showUserLocation: sul } =
      mountOptsRef.current;

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          esri: {
            type: "raster",
            tiles: [ESRI_TILE],
            tileSize: 256,
            attribution:
              '<a href="https://www.esri.com/">© Esri</a> — Maxar, Earthstar, USDA, USGS, IGN, IGP',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: "esri",
            type: "raster",
            source: "esri",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: ic,
      zoom: iz,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    if (sul) {
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
            maximumAge: 5_000,
            timeout: 20_000,
          },
          trackUserLocation: true,
          showAccuracyCircle: true,
          showUserLocation: true,
        }),
        "top-right",
      );
    }

    map.on("click", (e) => {
      onClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "fill"],
        paint: {
          "fill-color": "#10b981",
          "fill-opacity": 0.28,
        },
      });

      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "kind"], "line"],
        paint: {
          "line-color": "#34d399",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });

      styleReadyRef.current = true;
      syncMap(map);
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(container);

    return () => {
      styleReadyRef.current = false;
      ro.disconnect();
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      areaMarkerRef.current?.remove();
      areaMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [syncMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    syncMap(map);
  }, [
    vertices,
    isClosed,
    areaM2,
    allowVertexDrag,
    vertexDragTarget,
    syncMap,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("min-h-[280px] w-full overflow-hidden rounded-lg", className)}
    />
  );
}

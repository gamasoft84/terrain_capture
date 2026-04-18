"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Polygon,
  Position,
} from "geojson";
import * as turf from "@turf/turf";
import { cn } from "@/lib/utils";
import type { LocalPolygon, LocalVertex } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { updateVertex } from "@/lib/db/vertices";
import { calculateCentroid, formatAreaDisplay } from "@/lib/geo/calculations";

const ESRI_TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const DEFAULT_CENTER: [number, number] = [-96.13, 15.87];
const DEFAULT_ZOOM = 14;

const SOURCE_ID = "terrain-geo";
const FILL_LAYER_ID = "terrain-fill";
const LINE_LAYER_ID = "terrain-line";

const SUB_SOURCE_ID = "terrain-sub-geo";
const SUB_FILL_LAYER_ID = "terrain-sub-fill";
const SUB_LINE_LAYER_ID = "terrain-sub-line";

export type SubPolygonMapLayer = {
  polygon: LocalPolygon;
  vertices: LocalVertex[];
};

export interface MapCanvasProps {
  vertices: LocalVertex[];
  isClosed: boolean;
  areaM2?: number | null;
  /** Sub-polígonos con sus vértices (relleno + contorno por color). */
  subLayers?: SubPolygonMapLayer[];
  /** Resalta geometría y vértices de este sub-polígono. */
  selectedSubPolygonLocalId?: string | null;
  /** Click en el mapa: sub-polígono cerrado bajo el punto (el de menor área si hay varios). */
  onSelectSubPolygonFromMap?: (polygonLocalId: string | null) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  showUserLocation?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  allowVertexDrag?: boolean;
  /** Contexto de persistencia al arrastrar un marcador (por vértice). */
  resolveVertexDragTarget?: (
    vertex: LocalVertex,
  ) => { polygonLocalId: string; polygonIsClosed: boolean } | null;
}

function sortedVertices(vertices: LocalVertex[]): LocalVertex[] {
  return [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);
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

function buildSubPolygonsFeatureCollection(
  layers: SubPolygonMapLayer[],
  selectedId: string | null | undefined,
): FeatureCollection {
  const features: Feature[] = [];
  for (const { polygon, vertices } of layers) {
    const sel = polygon.localId === selectedId;
    const fc = buildFeatureCollection(vertices, polygon.isClosed);
    for (const f of fc.features) {
      if (f.properties?.kind === "fill" && f.geometry.type === "Polygon") {
        features.push({
          type: "Feature",
          properties: {
            kind: "fill",
            polygonId: polygon.localId,
            fillColor: polygon.color,
            fillOpacity: sel ? 0.38 : 0.2,
          },
          geometry: f.geometry as Polygon,
        });
      } else if (
        f.properties?.kind === "line" &&
        f.geometry.type === "LineString"
      ) {
        features.push({
          type: "Feature",
          properties: {
            kind: "line",
            polygonId: polygon.localId,
            lineColor: polygon.color,
            lineWidth: sel ? 4 : 2,
            lineOpacity: sel ? 1 : 0.75,
          },
          geometry: f.geometry as LineString,
        });
      }
    }
  }
  return { type: "FeatureCollection", features };
}

function verticesToTurfPolygon(vertices: LocalVertex[]) {
  const sorted = sortedVertices(vertices);
  if (sorted.length < 3) return null;
  const ring: Position[] = sorted.map((v) => [v.longitude, v.latitude]);
  ring.push([sorted[0]!.longitude, sorted[0]!.latitude]);
  return turf.polygon([ring]);
}

function pickSubPolygonAtPoint(
  lng: number,
  lat: number,
  layers: SubPolygonMapLayer[],
): string | null {
  const pt = turf.point([lng, lat]);
  let best: { id: string; area: number } | null = null;
  for (const { polygon, vertices } of layers) {
    if (!polygon.isClosed || vertices.length < 3) continue;
    const poly = verticesToTurfPolygon(vertices);
    if (!poly) continue;
    if (!turf.booleanPointInPolygon(pt, poly)) continue;
    const area = turf.area(poly);
    if (!best || area < best.area) {
      best = { id: polygon.localId, area };
    }
  }
  return best?.id ?? null;
}

function createVertexMarkerEl(
  label: string,
  draggable: boolean,
  variant: "main" | "sub",
  subColor?: string,
): HTMLDivElement {
  const el = document.createElement("div");
  if (variant === "main") {
    el.className = cn(
      "border-background flex size-8 items-center justify-center rounded-full border-2 bg-primary text-xs font-bold text-primary-foreground shadow-md",
      draggable &&
        "cursor-grab touch-none ring-2 ring-amber-500/80 active:cursor-grabbing",
    );
  } else {
    el.className = cn(
      "border-background flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md",
      draggable &&
        "cursor-grab touch-none ring-2 ring-amber-500/80 active:cursor-grabbing",
    );
    el.style.backgroundColor = "rgba(250, 250, 250, 0.95)";
    el.style.color = "#171717";
    el.style.borderColor = subColor ?? "#f97316";
  }
  el.textContent = label;
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
  subLayers = [],
  selectedSubPolygonLocalId = null,
  onSelectSubPolygonFromMap,
  onMapClick,
  showUserLocation = true,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  className,
  allowVertexDrag = false,
  resolveVertexDragTarget,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const areaMarkerRef = useRef<maplibregl.Marker | null>(null);
  const styleReadyRef = useRef(false);
  const vertexCountForFitRef = useRef(-1);
  const didFitForCurrentVertexSetRef = useRef(false);
  const onClickRef = useRef(onMapClick);
  const onSubPickRef = useRef(onSelectSubPolygonFromMap);
  const dataRef = useRef({
    vertices,
    isClosed,
    areaM2,
    subLayers,
    selectedSubPolygonLocalId,
    allowVertexDrag,
    resolveVertexDragTarget,
  });
  const mountOptsRef = useRef({
    initialCenter,
    initialZoom,
    showUserLocation,
  });
  const prevAllowVertexDragRef = useRef(allowVertexDrag);

  const syncMap = useCallback((map: maplibregl.Map) => {
    const {
      vertices: v,
      isClosed: closed,
      areaM2: area,
      subLayers: subs,
      selectedSubPolygonLocalId: selectedSubId,
      allowVertexDrag: dragPref,
      resolveVertexDragTarget: resolveDrag,
    } = dataRef.current;

    const mainSrc = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (mainSrc) {
      mainSrc.setData(buildFeatureCollection(v, closed));
    }

    const subSrc = map.getSource(SUB_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (subSrc) {
      subSrc.setData(
        buildSubPolygonsFeatureCollection(subs, selectedSubId ?? null),
      );
    }

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    type MarkerEntry = {
      vertex: LocalVertex;
      label: string;
      variant: "main" | "sub";
      subColor?: string;
    };
    const markerEntries: MarkerEntry[] = [];
    sortedVertices(v).forEach((vertex, i) => {
      markerEntries.push({
        vertex,
        label: `P${i + 1}`,
        variant: "main",
      });
    });
    if (selectedSubId) {
      const pack = subs.find((s) => s.polygon.localId === selectedSubId);
      if (pack) {
        sortedVertices(pack.vertices).forEach((vertex, i) => {
          markerEntries.push({
            vertex,
            label: `S${i + 1}`,
            variant: "sub",
            subColor: pack.polygon.color,
          });
        });
      }
    }

    markerEntries.forEach(({ vertex, label, variant, subColor }) => {
      const dragCtx = resolveDrag?.(vertex) ?? null;
      const dragEnabled = Boolean(dragPref && dragCtx);
      const marker = new maplibregl.Marker({
        element: createVertexMarkerEl(
          label,
          dragEnabled,
          variant,
          subColor,
        ),
        draggable: dragEnabled,
      })
        .setLngLat([vertex.longitude, vertex.latitude])
        .addTo(map);

      if (dragEnabled && dragCtx) {
        marker.on("dragend", () => {
          const ll = marker.getLngLat();
          const ctx =
            dataRef.current.resolveVertexDragTarget?.(vertex) ?? null;
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

    const mainSorted = sortedVertices(v);
    const mainCoords: Position[] = mainSorted.map((vertex) => [
      vertex.longitude,
      vertex.latitude,
    ]);

    if (closed && mainCoords.length >= 3 && area != null && Number.isFinite(area)) {
      const [lng, lat] = calculateCentroid(mainSorted);
      const label = createAreaLabelEl(formatAreaDisplay(area));
      areaMarkerRef.current = new maplibregl.Marker({ element: label })
        .setLngLat([lng, lat])
        .addTo(map);
    }

    const allCoords: Position[] = [...mainCoords];
    for (const { vertices: sv } of subs) {
      for (const x of sv) {
        allCoords.push([x.longitude, x.latitude]);
      }
    }

    if (allCoords.length === 0) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      return;
    }

    const bounds = new maplibregl.LngLatBounds(
      allCoords[0] as [number, number],
      allCoords[0] as [number, number],
    );
    for (const pt of allCoords) bounds.extend(pt as [number, number]);

    if (!dragPref) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      return;
    }

    const markerCount = markerEntries.length;
    if (markerCount !== vertexCountForFitRef.current) {
      vertexCountForFitRef.current = markerCount;
      didFitForCurrentVertexSetRef.current = false;
    }
    if (!didFitForCurrentVertexSetRef.current) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      didFitForCurrentVertexSetRef.current = true;
    }
  }, []);

  useLayoutEffect(() => {
    onClickRef.current = onMapClick;
    onSubPickRef.current = onSelectSubPolygonFromMap;
    dataRef.current = {
      vertices,
      isClosed,
      areaM2,
      subLayers,
      selectedSubPolygonLocalId,
      allowVertexDrag,
      resolveVertexDragTarget,
    };
    mountOptsRef.current = { initialCenter, initialZoom, showUserLocation };

    const prev = prevAllowVertexDragRef.current;
    const next = allowVertexDrag;
    const map = mapRef.current;
    if (prev !== next && map && styleReadyRef.current) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      syncMap(map);
    }
    prevAllowVertexDragRef.current = next;
  }, [
    onMapClick,
    onSelectSubPolygonFromMap,
    vertices,
    isClosed,
    areaM2,
    subLayers,
    selectedSubPolygonLocalId,
    allowVertexDrag,
    resolveVertexDragTarget,
    initialCenter,
    initialZoom,
    showUserLocation,
    syncMap,
  ]);

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
      const { lng, lat } = e.lngLat;
      const subs = dataRef.current.subLayers;
      if (subs.length > 0 && onSubPickRef.current) {
        const hit = pickSubPolygonAtPoint(lng, lat, subs);
        onSubPickRef.current(hit);
      }
      onClickRef.current?.({ lng, lat });
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

      map.addSource(SUB_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: SUB_FILL_LAYER_ID,
        type: "fill",
        source: SUB_SOURCE_ID,
        filter: ["==", ["get", "kind"], "fill"],
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-opacity": ["get", "fillOpacity"],
        },
      });

      map.addLayer({
        id: SUB_LINE_LAYER_ID,
        type: "line",
        source: SUB_SOURCE_ID,
        filter: ["==", ["get", "kind"], "line"],
        paint: {
          "line-color": ["get", "lineColor"],
          "line-width": ["get", "lineWidth"],
          "line-opacity": ["get", "lineOpacity"],
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
    subLayers,
    selectedSubPolygonLocalId,
    resolveVertexDragTarget,
    syncMap,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("min-h-[280px] w-full overflow-hidden rounded-lg", className)}
    />
  );
}

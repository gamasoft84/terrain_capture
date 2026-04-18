"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import type { LocalPOI, LocalPolygon, LocalVertex } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { updatePOI } from "@/lib/db/pois";
import { updateVertex } from "@/lib/db/vertices";
import {
  calculateCentroid,
  EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM,
  edgeDistanceLabelFeatures,
  formatAreaDisplay,
} from "@/lib/geo/calculations";

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
  /** POIs del proyecto (marcador MapPin + etiqueta). */
  pois?: LocalPOI[];
  /** Resalta el marcador del POI seleccionado (p. ej. sheet abierto). */
  selectedPoiLocalId?: string | null;
  onPoiMarkerClick?: (poi: LocalPOI) => void;
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

function applyEdgeDistanceMarkerVisibility(
  markers: maplibregl.Marker[],
  zoom: number,
) {
  const show = zoom >= EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM;
  for (const m of markers) {
    m.getElement().style.display = show ? "" : "none";
  }
}

function createEdgeDistanceLabelEl(
  text: string,
  variant: "main" | "sub",
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cn(
    "pointer-events-none max-w-[5rem] select-none truncate rounded px-1 py-0.5 text-center font-mono text-[9px] font-semibold leading-tight text-white shadow-md ring-1",
    variant === "main"
      ? "bg-black/60 ring-white/25"
      : "bg-amber-950/80 ring-amber-200/35",
  );
  el.textContent = text;
  return el;
}

function createPoiMarkerEl(
  label: string,
  selected: boolean,
  draggable: boolean,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = cn(
    "flex flex-col items-center gap-0.5 pointer-events-auto",
    selected &&
      "rounded-lg outline outline-2 outline-offset-2 outline-amber-400",
    draggable
      ? "cursor-grab touch-none ring-2 ring-amber-500/80 rounded-lg active:cursor-grabbing"
      : "cursor-pointer",
  );
  const iconWrap = document.createElement("div");
  iconWrap.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.35))";
  iconWrap.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#fffbeb" stroke="#d97706"/></svg>';
  const text = document.createElement("div");
  text.style.maxWidth = "5.5rem";
  text.style.overflow = "hidden";
  text.style.textOverflow = "ellipsis";
  text.style.whiteSpace = "nowrap";
  text.style.fontSize = "10px";
  text.style.fontWeight = "600";
  text.style.lineHeight = "1.2";
  text.style.padding = "2px 6px";
  text.style.borderRadius = "4px";
  text.style.background = "rgba(255,255,255,0.92)";
  text.style.color = "#171717";
  text.style.border = "1px solid rgba(217,119,6,0.45)";
  text.style.boxShadow = "0 1px 2px rgba(0,0,0,0.15)";
  text.textContent = label;
  wrap.appendChild(iconWrap);
  wrap.appendChild(text);
  return wrap;
}

export default function MapCanvasInner({
  vertices,
  isClosed,
  areaM2,
  subLayers = [],
  selectedSubPolygonLocalId = null,
  onSelectSubPolygonFromMap,
  pois = [],
  selectedPoiLocalId = null,
  onPoiMarkerClick,
  onMapClick,
  showUserLocation = true,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  className,
  allowVertexDrag = false,
  resolveVertexDragTarget,
}: MapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapZoomDisplay, setMapZoomDisplay] = useState<number | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);
  const edgeDistanceMarkersRef = useRef<maplibregl.Marker[]>([]);
  const areaMarkerRef = useRef<maplibregl.Marker | null>(null);
  const styleReadyRef = useRef(false);
  const vertexCountForFitRef = useRef(-1);
  const didFitForCurrentVertexSetRef = useRef(false);
  const onClickRef = useRef(onMapClick);
  const onSubPickRef = useRef(onSelectSubPolygonFromMap);
  const onPoiClickRef = useRef(onPoiMarkerClick);
  const dataRef = useRef({
    vertices,
    isClosed,
    areaM2,
    subLayers,
    selectedSubPolygonLocalId,
    pois,
    selectedPoiLocalId,
    allowVertexDrag,
    resolveVertexDragTarget,
  });
  const mountOptsRef = useRef({
    initialCenter,
    initialZoom,
    showUserLocation,
  });
  const prevAllowVertexDragRef = useRef(allowVertexDrag);
  /** Tras `dragend` en un POI, MapLibre puede disparar `click`: no abrir el sheet. */
  const poiSkipNextOpenRef = useRef(false);

  const syncMap = useCallback((map: maplibregl.Map) => {
    const {
      vertices: v,
      isClosed: closed,
      areaM2: area,
      subLayers: subs,
      selectedSubPolygonLocalId: selectedSubId,
      pois: poiList,
      selectedPoiLocalId: selectedPoiId,
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
    for (const m of edgeDistanceMarkersRef.current) m.remove();
    edgeDistanceMarkersRef.current = [];

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

    for (const f of edgeDistanceLabelFeatures(v, closed)) {
      const coords = f.geometry.coordinates;
      const label = String(f.properties?.label ?? "");
      const el = createEdgeDistanceLabelEl(label, "main");
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(coords as [number, number])
        .addTo(map);
      edgeDistanceMarkersRef.current.push(marker);
    }

    if (selectedSubId) {
      const pack = subs.find((s) => s.polygon.localId === selectedSubId);
      if (pack) {
        for (const f of edgeDistanceLabelFeatures(
          pack.vertices,
          pack.polygon.isClosed,
        )) {
          const coords = f.geometry.coordinates;
          const label = String(f.properties?.label ?? "");
          const el = createEdgeDistanceLabelEl(label, "sub");
          const marker = new maplibregl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat(coords as [number, number])
            .addTo(map);
          edgeDistanceMarkersRef.current.push(marker);
        }
      }
    }

    for (const m of poiMarkersRef.current) m.remove();
    poiMarkersRef.current = [];
    const poiDragEnabled = Boolean(dragPref);
    for (const poi of poiList) {
      const el = createPoiMarkerEl(
        poi.label,
        Boolean(selectedPoiId && poi.localId === selectedPoiId),
        poiDragEnabled,
      );
      if (poiDragEnabled) {
        el.title =
          "Arrastra para reubicar el POI. Toque para abrir el detalle.";
      }
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (poiSkipNextOpenRef.current) {
          poiSkipNextOpenRef.current = false;
          return;
        }
        onPoiClickRef.current?.(poi);
      });
      const marker = new maplibregl.Marker({
        element: el,
        draggable: poiDragEnabled,
      })
        .setLngLat([poi.longitude, poi.latitude])
        .addTo(map);

      if (poiDragEnabled) {
        marker.on("dragend", () => {
          poiSkipNextOpenRef.current = true;
          const ll = marker.getLngLat();
          void (async () => {
            try {
              await updatePOI(poi.localId, {
                latitude: ll.lat,
                longitude: ll.lng,
              });
            } catch {
              marker.setLngLat([poi.longitude, poi.latitude]);
            }
          })();
        });
      }

      poiMarkersRef.current.push(marker);
    }

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
    for (const p of poiList) {
      allCoords.push([p.longitude, p.latitude]);
    }

    if (allCoords.length === 0) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      applyEdgeDistanceMarkerVisibility(
        edgeDistanceMarkersRef.current,
        map.getZoom(),
      );
      return;
    }

    const bounds = new maplibregl.LngLatBounds(
      allCoords[0] as [number, number],
      allCoords[0] as [number, number],
    );
    for (const pt of allCoords) bounds.extend(pt as [number, number]);

    if (!dragPref) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      applyEdgeDistanceMarkerVisibility(
        edgeDistanceMarkersRef.current,
        map.getZoom(),
      );
      return;
    }

    const markerCount = markerEntries.length + poiList.length;
    if (markerCount !== vertexCountForFitRef.current) {
      vertexCountForFitRef.current = markerCount;
      didFitForCurrentVertexSetRef.current = false;
    }
    if (!didFitForCurrentVertexSetRef.current) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 18, duration: 500 });
      didFitForCurrentVertexSetRef.current = true;
    }

    applyEdgeDistanceMarkerVisibility(
      edgeDistanceMarkersRef.current,
      map.getZoom(),
    );
  }, []);

  useLayoutEffect(() => {
    onClickRef.current = onMapClick;
    onSubPickRef.current = onSelectSubPolygonFromMap;
    onPoiClickRef.current = onPoiMarkerClick;
    dataRef.current = {
      vertices,
      isClosed,
      areaM2,
      subLayers,
      selectedSubPolygonLocalId,
      pois,
      selectedPoiLocalId,
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
    onPoiMarkerClick,
    vertices,
    isClosed,
    areaM2,
    subLayers,
    selectedSubPolygonLocalId,
    pois,
    selectedPoiLocalId,
    allowVertexDrag,
    resolveVertexDragTarget,
    initialCenter,
    initialZoom,
    showUserLocation,
    syncMap,
  ]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let detachZoomListeners: (() => void) | null = null;

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
      /* Deja espacio bajo la fila Galería / POIs / Lista (overlay en la página). */
      const topRight = map
        .getContainer()
        .querySelector<HTMLElement>(".maplibregl-ctrl-top-right");
      const zoomGroup = topRight?.querySelector<HTMLElement>(
        ".maplibregl-ctrl-group",
      );
      if (zoomGroup) {
        zoomGroup.style.marginTop = "3.25rem";
      }

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

      const updateZoomAndEdgeLabels = () => {
        const z = map.getZoom();
        setMapZoomDisplay(Math.round(z * 100) / 100);
        applyEdgeDistanceMarkerVisibility(edgeDistanceMarkersRef.current, z);
      };
      updateZoomAndEdgeLabels();
      map.on("zoom", updateZoomAndEdgeLabels);
      map.on("zoomend", updateZoomAndEdgeLabels);
      map.on("moveend", updateZoomAndEdgeLabels);
      detachZoomListeners = () => {
        map.off("zoom", updateZoomAndEdgeLabels);
        map.off("zoomend", updateZoomAndEdgeLabels);
        map.off("moveend", updateZoomAndEdgeLabels);
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => map.resize());
      });
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    const wrap = wrapperRef.current;
    if (wrap) ro.observe(wrap);
    else ro.observe(container);

    return () => {
      detachZoomListeners?.();
      styleReadyRef.current = false;
      ro.disconnect();
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      for (const m of poiMarkersRef.current) m.remove();
      poiMarkersRef.current = [];
      for (const m of edgeDistanceMarkersRef.current) m.remove();
      edgeDistanceMarkersRef.current = [];
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
    pois,
    selectedPoiLocalId,
    resolveVertexDragTarget,
    syncMap,
  ]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg",
        className,
      )}
    >
      <div
        ref={mapContainerRef}
        className="relative min-h-0 w-full min-w-0 flex-1 basis-0"
      />
      {/* Arriba a la izquierda, bajo el bloque del título del proyecto (overlay); el panel inferior tapaba bottom- */}
      <div className="pointer-events-none absolute top-24 left-3 z-[50] flex max-w-[11rem] flex-col gap-0.5 rounded-md bg-black/80 px-2.5 py-1.5 font-mono text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm">
        <span className="text-xs font-semibold tabular-nums tracking-tight">
          Zoom: {mapZoomDisplay ?? "—"}
        </span>
        <span className="text-[10px] leading-snug text-white/80">
          Distancias en mapa si zoom ≥ {EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM}
        </span>
      </div>
    </div>
  );
}

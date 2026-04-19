"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import Map, {
  GeolocateControl,
  Layer,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
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

const DEFAULT_CENTER: [number, number] = [-96.13, 15.87];
const DEFAULT_ZOOM = 14;

/** Satélite + calles / etiquetas (similar al híbrido anterior). */
const MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
};

export type SubPolygonMapLayer = {
  polygon: LocalPolygon;
  vertices: LocalVertex[];
};

export interface MapCanvasProps {
  vertices: LocalVertex[];
  isClosed: boolean;
  areaM2?: number | null;
  subLayers?: SubPolygonMapLayer[];
  selectedSubPolygonLocalId?: string | null;
  onSelectSubPolygonFromMap?: (polygonLocalId: string | null) => void;
  pois?: LocalPOI[];
  selectedPoiLocalId?: string | null;
  onPoiMarkerClick?: (poi: LocalPOI) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  showUserLocation?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  allowVertexDrag?: boolean;
  resolveVertexDragTarget?: (
    vertex: LocalVertex,
  ) => { polygonLocalId: string; polygonIsClosed: boolean } | null;
  minimalChrome?: boolean;
  /** PNG desde el canvas WebGL tras `idle` (reporte PDF). */
  onCaptureReady?: (dataUrl: string) => void;
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

function mapboxAccessToken(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    ""
  ).trim();
}

export default function MapCanvasInner(props: MapCanvasProps) {
  const token = mapboxAccessToken();

  if (!token) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex min-h-[280px] flex-1 items-center justify-center rounded-lg border p-4 text-center text-sm",
          props.className,
        )}
      >
        Define{" "}
        <span className="text-foreground font-mono">
          NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        </span>{" "}
        (tu token de Mapbox) en{" "}
        <span className="font-mono">.env.local</span> y reinicia el servidor.
      </div>
    );
  }

  return <MapboxTerrainMap {...props} mapboxAccessToken={token} />;
}

type InnerProps = MapCanvasProps & { mapboxAccessToken: string };

function MapboxTerrainMap({
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
  minimalChrome = false,
  onCaptureReady,
  mapboxAccessToken: mapboxToken,
}: InnerProps) {
  const mapRef = useRef<MapRef>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captureDoneRef = useRef(false);
  const vertexCountForFitRef = useRef(-1);
  const didFitForCurrentVertexSetRef = useRef(false);
  const poiSkipNextOpenRef = useRef(false);

  const [zoom, setZoom] = useState(initialZoom);
  const [mapReady, setMapReady] = useState(false);

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

  useLayoutEffect(() => {
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
  }, [
    vertices,
    isClosed,
    areaM2,
    subLayers,
    selectedSubPolygonLocalId,
    pois,
    selectedPoiLocalId,
    allowVertexDrag,
    resolveVertexDragTarget,
  ]);

  const mountOptsRef = useRef({
    initialCenter,
    initialZoom,
  });
  useLayoutEffect(() => {
    mountOptsRef.current = { initialCenter, initialZoom };
  }, [initialCenter, initialZoom]);

  const mainFc = useMemo(
    () => buildFeatureCollection(vertices, isClosed),
    [vertices, isClosed],
  );

  const subFc = useMemo(
    () =>
      buildSubPolygonsFeatureCollection(
        subLayers,
        selectedSubPolygonLocalId ?? null,
      ),
    [subLayers, selectedSubPolygonLocalId],
  );

  const vertexMarkers = useMemo(() => {
    const entries: {
      vertex: LocalVertex;
      label: string;
      variant: "main" | "sub";
      subColor?: string;
    }[] = [];
    sortedVertices(vertices).forEach((v, i) => {
      entries.push({ vertex: v, label: `P${i + 1}`, variant: "main" });
    });
    if (selectedSubPolygonLocalId) {
      const pack = subLayers.find(
        (s) => s.polygon.localId === selectedSubPolygonLocalId,
      );
      if (pack) {
        sortedVertices(pack.vertices).forEach((v, i) => {
          entries.push({
            vertex: v,
            label: `S${i + 1}`,
            variant: "sub",
            subColor: pack.polygon.color,
          });
        });
      }
    }
    return entries;
  }, [vertices, subLayers, selectedSubPolygonLocalId]);

  const edgeFeaturesMain = useMemo(
    () => edgeDistanceLabelFeatures(vertices, isClosed),
    [vertices, isClosed],
  );

  const edgeFeaturesSub = useMemo(() => {
    if (!selectedSubPolygonLocalId) return [];
    const pack = subLayers.find(
      (s) => s.polygon.localId === selectedSubPolygonLocalId,
    );
    if (!pack) return [];
    return edgeDistanceLabelFeatures(
      pack.vertices,
      pack.polygon.isClosed,
    );
  }, [subLayers, selectedSubPolygonLocalId]);

  const areaCentroid = useMemo(() => {
    if (
      !isClosed ||
      vertices.length < 3 ||
      areaM2 == null ||
      !Number.isFinite(areaM2)
    ) {
      return null;
    }
    const sorted = sortedVertices(vertices);
    const [lng, lat] = calculateCentroid(sorted);
    return { lng, lat };
  }, [vertices, isClosed, areaM2]);

  const allBoundsPoints = useMemo(() => {
    const pts: { lng: number; lat: number }[] = [];
    for (const v of sortedVertices(vertices)) {
      pts.push({ lng: v.longitude, lat: v.latitude });
    }
    for (const { vertices: sv } of subLayers) {
      for (const x of sv) {
        pts.push({ lng: x.longitude, lat: x.latitude });
      }
    }
    for (const p of pois) {
      pts.push({ lng: p.longitude, lat: p.latitude });
    }
    return pts;
  }, [vertices, subLayers, pois]);

  const hasGeometry = allBoundsPoints.length > 0;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapReady) return;

    const pad: mapboxgl.PaddingOptions = {
      top: 56,
      right: 56,
      bottom: 56,
      left: 56,
    };

    if (!hasGeometry) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      const { initialCenter: ic, initialZoom: iz } = mountOptsRef.current;
      const center: [number, number] = [ic[0], ic[1]];
      if (minimalChrome) {
        map.jumpTo({ center, zoom: iz });
      } else {
        map.easeTo({ center, zoom: iz, duration: 550 });
      }
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    for (const p of allBoundsPoints) bounds.extend([p.lng, p.lat]);

    const duration = minimalChrome ? 0 : 500;

    if (!allowVertexDrag) {
      map.fitBounds(bounds, { padding: pad, maxZoom: 18, duration });
      return;
    }

    const markerCount = vertexMarkers.length + pois.length;
    if (markerCount !== vertexCountForFitRef.current) {
      vertexCountForFitRef.current = markerCount;
      didFitForCurrentVertexSetRef.current = false;
    }
    if (!didFitForCurrentVertexSetRef.current) {
      map.fitBounds(bounds, { padding: pad, maxZoom: 18, duration });
      didFitForCurrentVertexSetRef.current = true;
    }
  }, [
    mapReady,
    hasGeometry,
    allBoundsPoints,
    allowVertexDrag,
    vertexMarkers.length,
    pois.length,
    vertices,
    initialCenter[0],
    initialCenter[1],
    initialZoom,
    minimalChrome,
  ]);

  useEffect(() => {
    const wrap = wrapperRef.current;
    const map = mapRef.current?.getMap();
    if (!wrap || !map) return;
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !minimalChrome || !onCaptureReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let cancelled = false;
    captureDoneRef.current = false;

    const runCapture = () => {
      if (cancelled || captureDoneRef.current) return;
      captureDoneRef.current = true;
      try {
        map.triggerRepaint();
        const canvas = map.getCanvas();
        onCaptureReady(canvas.toDataURL("image/png"));
      } catch {
        onCaptureReady("");
      }
    };

    const fallback = window.setTimeout(runCapture, 12_000);
    map.once("idle", () => {
      window.clearTimeout(fallback);
      window.setTimeout(runCapture, minimalChrome ? 750 : 0);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [mapReady, minimalChrome, onCaptureReady]);

  const handleMapClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const subs = dataRef.current.subLayers;
      if (subs.length > 0 && onSelectSubPolygonFromMap) {
        const hit = pickSubPolygonAtPoint(lng, lat, subs);
        onSelectSubPolygonFromMap(hit);
      }
      onMapClick?.({ lng, lat });
    },
    [onMapClick, onSelectSubPolygonFromMap],
  );

  const showEdgeLabels = zoom >= EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM;

  const onMapLoad = useCallback(() => {
    setMapReady(true);
    captureDoneRef.current = false;
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "terrain-map-canvas-root relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg",
        className,
      )}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        mapStyle={MAP_STYLE}
        style={containerStyle}
        initialViewState={{
          longitude: initialCenter[0],
          latitude: initialCenter[1],
          zoom: initialZoom,
        }}
        attributionControl={!minimalChrome}
        reuseMaps
        preserveDrawingBuffer={minimalChrome}
        onLoad={onMapLoad}
        onClick={handleMapClick}
        onMove={(e) => setZoom(e.viewState.zoom)}
      >
        {!minimalChrome ? (
          <>
            <NavigationControl position="top-right" showCompass={false} />
            {showUserLocation ? (
              <GeolocateControl
                position="top-right"
                trackUserLocation
                showAccuracyCircle
              />
            ) : null}
          </>
        ) : null}

        <Source id="terrain-main" type="geojson" data={mainFc}>
          <Layer
            id="terrain-main-fill"
            type="fill"
            filter={["==", ["get", "kind"], "fill"]}
            paint={{
              "fill-color": "#10b981",
              "fill-opacity": 0.28,
            }}
          />
          <Layer
            id="terrain-main-line"
            type="line"
            filter={["==", ["get", "kind"], "line"]}
            paint={{
              "line-color": "#34d399",
              "line-opacity": 0.95,
              "line-width": 3,
            }}
          />
        </Source>

        <Source id="terrain-sub" type="geojson" data={subFc}>
          <Layer
            id="terrain-sub-fill"
            type="fill"
            filter={["==", ["get", "kind"], "fill"]}
            paint={{
              "fill-color": ["get", "fillColor"],
              "fill-opacity": ["get", "fillOpacity"],
            }}
          />
          <Layer
            id="terrain-sub-line"
            type="line"
            filter={["==", ["get", "kind"], "line"]}
            paint={{
              "line-color": ["get", "lineColor"],
              "line-width": ["get", "lineWidth"],
              "line-opacity": ["get", "lineOpacity"],
            }}
          />
        </Source>

        {vertexMarkers.map(({ vertex, label, variant, subColor }) => {
          const dragCtx = resolveVertexDragTarget?.(vertex) ?? null;
          const dragEnabled = Boolean(allowVertexDrag && dragCtx);
          return (
            <Marker
              key={`${variant}-${vertex.localId}`}
              longitude={vertex.longitude}
              latitude={vertex.latitude}
              draggable={dragEnabled}
              anchor="center"
              onDragEnd={(ev) => {
                const ll = ev.lngLat;
                if (!dragCtx) return;
                void (async () => {
                  try {
                    await updateVertex(vertex.localId, {
                      latitude: ll.lat,
                      longitude: ll.lng,
                      captureMethod: "manual_map",
                    });
                    await refreshPolygonMetricsFromVertices(
                      dragCtx.polygonLocalId,
                      dragCtx.polygonIsClosed,
                    );
                  } catch {
                    /* ignore */
                  }
                })();
              }}
            >
              <div
                className={cn(
                  "border-background flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md",
                  variant === "main"
                    ? "bg-primary text-primary-foreground"
                    : "ring-2 ring-amber-500/80",
                  dragEnabled &&
                    "cursor-grab touch-none active:cursor-grabbing",
                )}
                style={
                  variant === "sub"
                    ? {
                        backgroundColor: "rgba(250,250,250,0.95)",
                        color: "#171717",
                        borderColor: subColor ?? "#f97316",
                      }
                    : undefined
                }
              >
                {label}
              </div>
            </Marker>
          );
        })}

        {pois.map((poi) => {
          const dragEnabled = Boolean(allowVertexDrag);
          const selected = Boolean(
            selectedPoiLocalId && poi.localId === selectedPoiLocalId,
          );
          return (
            <Marker
              key={poi.localId}
              longitude={poi.longitude}
              latitude={poi.latitude}
              draggable={dragEnabled}
              anchor="bottom"
              onClick={(ev) => {
                ev.originalEvent.stopPropagation();
                if (poiSkipNextOpenRef.current) {
                  poiSkipNextOpenRef.current = false;
                  return;
                }
                onPoiMarkerClick?.(poi);
              }}
              onDragEnd={(ev) => {
                poiSkipNextOpenRef.current = true;
                const ll = ev.lngLat;
                void (async () => {
                  try {
                    await updatePOI(poi.localId, {
                      latitude: ll.lat,
                      longitude: ll.lng,
                    });
                  } catch {
                    /* ignore */
                  }
                })();
              }}
            >
              <div
                className={cn(
                  "flex flex-col items-center gap-0.5",
                  selected &&
                    "rounded-lg outline outline-2 outline-offset-2 outline-amber-400",
                  dragEnabled
                    ? "cursor-grab touch-none ring-2 ring-amber-500/80 rounded-lg active:cursor-grabbing"
                    : "cursor-pointer",
                )}
              >
                <div style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" }}>
                  {/* pin */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle
                      cx="12"
                      cy="10"
                      r="2.5"
                      fill="#fffbeb"
                      stroke="#d97706"
                    />
                  </svg>
                </div>
                <div
                  className="max-w-[5.5rem] truncate rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-tight shadow-sm"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    color: "#171717",
                    borderColor: "rgba(217,119,6,0.45)",
                  }}
                >
                  {poi.label}
                </div>
              </div>
            </Marker>
          );
        })}

        {showEdgeLabels &&
          edgeFeaturesMain.map((f, i) => {
            const g = f.geometry as Point;
            const [lng, lat] = g.coordinates;
            const label = String(f.properties?.label ?? "");
            return (
              <Marker
                key={`edge-m-${i}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <div
                  className={cn(
                    "pointer-events-none max-w-[5rem] -translate-x-1/2 -translate-y-1/2 truncate rounded px-1 py-0.5 text-center font-mono text-[9px] font-semibold leading-tight text-white shadow-md ring-1",
                    "bg-black/60 ring-white/25",
                  )}
                >
                  {label}
                </div>
              </Marker>
            );
          })}

        {showEdgeLabels &&
          edgeFeaturesSub.map((f, i) => {
            const g = f.geometry as Point;
            const [lng, lat] = g.coordinates;
            const label = String(f.properties?.label ?? "");
            return (
              <Marker
                key={`edge-s-${i}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <div
                  className={cn(
                    "pointer-events-none max-w-[5rem] -translate-x-1/2 -translate-y-1/2 truncate rounded px-1 py-0.5 text-center font-mono text-[9px] font-semibold leading-tight text-white shadow-md ring-1",
                    "bg-amber-950/80 ring-amber-200/35",
                  )}
                >
                  {label}
                </div>
              </Marker>
            );
          })}

        {areaCentroid ? (
          <Marker
            longitude={areaCentroid.lng}
            latitude={areaCentroid.lat}
            anchor="center"
          >
            <div className="bg-background/90 text-foreground border-primary/40 pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 font-mono text-xs font-semibold shadow-lg">
              {formatAreaDisplay(areaM2!)}
            </div>
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}

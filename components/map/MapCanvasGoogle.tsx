"use client";

import {
  GoogleMap,
  Marker,
  Polygon,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import type { Point } from "geojson";
import { toPng } from "html-to-image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { LocalVertex } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { updatePOI } from "@/lib/db/pois";
import { updateVertex } from "@/lib/db/vertices";
import {
  calculateCentroid,
  EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM,
  edgeDistanceLabelFeatures,
  formatAreaDisplay,
} from "@/lib/geo/calculations";
import {
  containerStyle,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  pickSubPolygonAtPoint,
  sortedVertices,
  type MapCanvasProps,
  type SubPolygonMapLayer,
} from "@/components/map/mapCanvasShared";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
} as const;

function googleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export default function MapCanvasGoogle(props: MapCanvasProps) {
  const key = googleMapsApiKey();
  if (!key) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex min-h-[280px] flex-1 items-center justify-center rounded-lg border p-4 text-center text-sm",
          props.className,
        )}
      >
        Define{" "}
        <span className="text-foreground font-mono">
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </span>{" "}
        en <span className="font-mono">.env.local</span> o elige otro motor en
        Ajustes.
      </div>
    );
  }

  return <GoogleTerrainMap {...props} apiKey={key} />;
}

type InnerProps = MapCanvasProps & { apiKey: string };

function GoogleTerrainMap({
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
  apiKey,
}: InnerProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "terraincapture-google-map",
    googleMapsApiKey: apiKey,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captureDoneRef = useRef(false);
  const vertexCountForFitRef = useRef(-1);
  const didFitForCurrentVertexSetRef = useRef(false);
  const poiSkipNextOpenRef = useRef(false);

  const [zoom, setZoom] = useState(initialZoom);
  const [mapReady, setMapReady] = useState(false);
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(
    null,
  );

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

  const mainPath = useMemo(
    () =>
      sortedVertices(vertices).map((v) => ({
        lat: v.latitude,
        lng: v.longitude,
      })),
    [vertices],
  );

  const subPaths = useMemo(() => {
    const out: {
      polygon: SubPolygonMapLayer["polygon"];
      path: google.maps.LatLngLiteral[];
      closed: boolean;
      selected: boolean;
    }[] = [];
    for (const layer of subLayers) {
      const path = sortedVertices(layer.vertices).map((v) => ({
        lat: v.latitude,
        lng: v.longitude,
      }));
      out.push({
        polygon: layer.polygon,
        path,
        closed: layer.polygon.isClosed,
        selected: layer.polygon.localId === selectedSubPolygonLocalId,
      });
    }
    return out;
  }, [subLayers, selectedSubPolygonLocalId]);

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

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    captureDoneRef.current = false;
    setZoom(map.getZoom() ?? DEFAULT_ZOOM);
    map.addListener("zoom_changed", () => {
      setZoom(map.getZoom() ?? 0);
    });
  }, []);

  useEffect(() => {
    if (!showUserLocation || typeof navigator === "undefined") return;
    const id = navigator.geolocation?.watchPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
    return () => {
      if (id != null) navigator.geolocation.clearWatch(id);
    };
  }, [showUserLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const pad = 56;

    if (!hasGeometry) {
      vertexCountForFitRef.current = -1;
      didFitForCurrentVertexSetRef.current = false;
      const { initialCenter: ic, initialZoom: iz } = mountOptsRef.current;
      map.panTo({ lat: ic[1], lng: ic[0] });
      map.setZoom(iz);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const p of allBoundsPoints) {
      bounds.extend({ lat: p.lat, lng: p.lng });
    }

    if (!allowVertexDrag) {
      map.fitBounds(bounds, { top: pad, right: pad, bottom: pad, left: pad });
      return;
    }

    const markerCount = vertexMarkers.length + pois.length;
    if (markerCount !== vertexCountForFitRef.current) {
      vertexCountForFitRef.current = markerCount;
      didFitForCurrentVertexSetRef.current = false;
    }
    if (!didFitForCurrentVertexSetRef.current) {
      map.fitBounds(bounds, { top: pad, right: pad, bottom: pad, left: pad });
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
    initialCenter,
    initialZoom,
  ]);

  useEffect(() => {
    const wrap = wrapperRef.current;
    const map = mapRef.current;
    if (!wrap || !map) return;
    const ro = new ResizeObserver(() => {
      if (typeof window !== "undefined" && window.google?.maps?.event) {
        window.google.maps.event.trigger(map, "resize");
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !minimalChrome || !onCaptureReady || !wrapperRef.current) {
      return;
    }

    let cancelled = false;
    captureDoneRef.current = false;

    const runCapture = async () => {
      if (cancelled || captureDoneRef.current || !wrapperRef.current) return;
      captureDoneRef.current = true;
      try {
        const dataUrl = await toPng(wrapperRef.current, {
          pixelRatio: 2,
          cacheBust: true,
        });
        onCaptureReady(dataUrl);
      } catch {
        onCaptureReady("");
      }
    };

    const map = mapRef.current;
    if (!map) return;

    const fallback = window.setTimeout(runCapture, 14_000);

    const listener = map.addListener("idle", () => {
      window.clearTimeout(fallback);
      window.setTimeout(runCapture, 800);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      if (listener) window.google.maps.event.removeListener(listener);
    };
  }, [mapReady, minimalChrome, onCaptureReady]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const latLng = e.latLng;
      if (!latLng) return;
      const lat = latLng.lat();
      const lng = latLng.lng();
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

  if (loadError) {
    return (
      <div
        className={cn(
          "bg-muted text-destructive flex min-h-[280px] flex-1 items-center justify-center rounded-lg border p-4 text-center text-sm",
          className,
        )}
      >
        No se pudo cargar Google Maps. Revisa la clave y las APIs habilitadas.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex min-h-[280px] flex-1 animate-pulse items-center justify-center rounded-lg border text-sm",
          className,
        )}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "terrain-map-canvas-root relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg",
        className,
      )}
    >
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, ...containerStyle }}
        center={{ lat: initialCenter[1], lng: initialCenter[0] }}
        zoom={initialZoom}
        mapTypeId={google.maps.MapTypeId.HYBRID}
        onLoad={onMapLoad}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: minimalChrome,
          zoomControl: !minimalChrome,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          maxZoom: 22,
        }}
      >
        {isClosed && mainPath.length >= 3 ? (
          <Polygon
            path={mainPath}
            options={{
              fillColor: "#10b981",
              fillOpacity: 0.28,
              strokeColor: "#34d399",
              strokeOpacity: 0.95,
              strokeWeight: 3,
            }}
          />
        ) : mainPath.length >= 2 ? (
          <Polyline
            path={mainPath}
            options={{
              strokeColor: "#34d399",
              strokeOpacity: 0.95,
              strokeWeight: 3,
            }}
          />
        ) : null}

        {subPaths.map(({ polygon, path, closed, selected }) => {
          if (closed && path.length >= 3) {
            return (
              <Polygon
                key={polygon.localId}
                path={path}
                options={{
                  fillColor: polygon.color,
                  fillOpacity: selected ? 0.38 : 0.2,
                  strokeColor: polygon.color,
                  strokeOpacity: selected ? 1 : 0.75,
                  strokeWeight: selected ? 4 : 2,
                }}
              />
            );
          }
          if (path.length >= 2) {
            return (
              <Polyline
                key={polygon.localId}
                path={closed ? [...path, path[0]!] : path}
                options={{
                  strokeColor: polygon.color,
                  strokeOpacity: selected ? 1 : 0.75,
                  strokeWeight: selected ? 4 : 2,
                }}
              />
            );
          }
          return null;
        })}

        {vertexMarkers.map(({ vertex, label, variant, subColor }) => {
          const dragCtx = resolveVertexDragTarget?.(vertex) ?? null;
          const dragEnabled = Boolean(allowVertexDrag && dragCtx);
          return (
            <Marker
              key={`${variant}-${vertex.localId}`}
              position={{ lat: vertex.latitude, lng: vertex.longitude }}
              draggable={dragEnabled}
              label={{
                text: label,
                color: variant === "main" ? "#052e16" : "#171717",
                fontSize: "11px",
                fontWeight: "bold",
              }}
              onDragEnd={(e) => {
                const ll = e.latLng;
                if (!ll || !dragCtx) return;
                void (async () => {
                  try {
                    await updateVertex(vertex.localId, {
                      latitude: ll.lat(),
                      longitude: ll.lng(),
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
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: variant === "main" ? 10 : 9,
                fillColor: variant === "main" ? "#10b981" : "#fafafa",
                fillOpacity: 1,
                strokeColor: variant === "main" ? "#052e16" : subColor ?? "#f97316",
                strokeWeight: variant === "main" ? 2 : 3,
              }}
            />
          );
        })}

        {pois.map((poi) => {
          const dragEnabled = Boolean(allowVertexDrag);
          return (
            <Marker
              key={poi.localId}
              position={{ lat: poi.latitude, lng: poi.longitude }}
              draggable={dragEnabled}
              onClick={() => {
                if (poiSkipNextOpenRef.current) {
                  poiSkipNextOpenRef.current = false;
                  return;
                }
                onPoiMarkerClick?.(poi);
              }}
              onDragEnd={(e) => {
                poiSkipNextOpenRef.current = true;
                const ll = e.latLng;
                if (!ll) return;
                void (async () => {
                  try {
                    await updatePOI(poi.localId, {
                      latitude: ll.lat(),
                      longitude: ll.lng(),
                    });
                  } catch {
                    /* ignore */
                  }
                })();
              }}
              label={{
                text: poi.label,
                color: "#171717",
                fontSize: "10px",
                fontWeight: "600",
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#fffbeb",
                fillOpacity: 1,
                strokeColor: "#d97706",
                strokeWeight: 2,
              }}
            />
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
                position={{ lat, lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 0.01,
                  strokeOpacity: 0,
                  fillOpacity: 0,
                }}
                label={{ text: label, color: "#fff", fontSize: "9px" }}
              />
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
                position={{ lat, lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 0.01,
                  strokeOpacity: 0,
                  fillOpacity: 0,
                }}
                label={{ text: label, color: "#fde68a", fontSize: "9px" }}
              />
            );
          })}

        {areaCentroid && areaM2 != null ? (
          <Marker
            position={{ lat: areaCentroid.lat, lng: areaCentroid.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0.01,
              strokeOpacity: 0,
              fillOpacity: 0,
            }}
            label={{ text: formatAreaDisplay(areaM2), color: "#f0fdf4", fontSize: "11px" }}
          />
        ) : null}

        {showUserLocation && userPos ? (
          <Marker
            position={userPos}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#3b82f6",
              fillOpacity: 0.45,
              strokeColor: "#1d4ed8",
              strokeWeight: 2,
            }}
          />
        ) : null}
      </GoogleMap>
    </div>
  );
}

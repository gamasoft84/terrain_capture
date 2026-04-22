"use client";

import { useMapFitBoundsMaxZoom } from "@/components/providers/MapFitBoundsMaxZoomPreference";
import { useMapEngine } from "@/components/providers/MapEnginePreference";
import type { MapCanvasProps, SubPolygonMapLayer } from "@/components/map/mapCanvasShared";
import MapCanvasGoogle from "@/components/map/MapCanvasGoogle";
import MapCanvasMapbox from "@/components/map/MapCanvasMapbox";
import MapCanvasMapLibre from "@/components/map/MapCanvasMapLibre";

export type { MapCanvasProps, SubPolygonMapLayer };

export default function MapCanvasInner(props: MapCanvasProps) {
  const { mapEngine } = useMapEngine();
  const { mapFitBoundsMaxZoom } = useMapFitBoundsMaxZoom();

  const merged = {
    ...props,
    fitBoundsMaxZoom: props.fitBoundsMaxZoom ?? mapFitBoundsMaxZoom,
  };

  if (mapEngine === "google") {
    return <MapCanvasGoogle {...merged} />;
  }
  if (mapEngine === "maplibre") {
    return <MapCanvasMapLibre {...merged} />;
  }

  return <MapCanvasMapbox {...merged} />;
}

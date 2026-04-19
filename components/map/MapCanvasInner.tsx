"use client";

import { useMapEngine } from "@/components/providers/MapEnginePreference";
import type { MapCanvasProps, SubPolygonMapLayer } from "@/components/map/mapCanvasShared";
import MapCanvasGoogle from "@/components/map/MapCanvasGoogle";
import MapCanvasMapbox from "@/components/map/MapCanvasMapbox";
import MapCanvasMapLibre from "@/components/map/MapCanvasMapLibre";

export type { MapCanvasProps, SubPolygonMapLayer };

export default function MapCanvasInner(props: MapCanvasProps) {
  const { mapEngine } = useMapEngine();

  if (mapEngine === "google") {
    return <MapCanvasGoogle {...props} />;
  }
  if (mapEngine === "maplibre") {
    return <MapCanvasMapLibre {...props} />;
  }

  return <MapCanvasMapbox {...props} />;
}

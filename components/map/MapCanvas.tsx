"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapCanvasProps } from "./mapCanvasShared";

const MapCanvasInner = dynamic(() => import("./MapCanvasInner"), {
  ssr: false,
  loading: () => (
    <Skeleton
      className="min-h-[280px] w-full flex-1 rounded-lg"
      aria-label="Cargando mapa"
    />
  ),
});

export type { MapCanvasProps, SubPolygonMapLayer } from "./mapCanvasShared";

export default function MapCanvas(props: MapCanvasProps) {
  return <MapCanvasInner {...props} />;
}

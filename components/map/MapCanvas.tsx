"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapCanvasProps } from "./MapCanvasInner";

const MapCanvasInner = dynamic(() => import("./MapCanvasInner"), {
  ssr: false,
  loading: () => (
    <Skeleton className="min-h-[280px] w-full rounded-lg" aria-label="Cargando mapa" />
  ),
});

export type { MapCanvasProps };

export default function MapCanvas(props: MapCanvasProps) {
  return <MapCanvasInner {...props} />;
}

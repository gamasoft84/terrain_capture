"use client";

import { useCallback } from "react";
import MapCanvas, { type SubPolygonMapLayer } from "@/components/map/MapCanvas";
import type { LocalPOI, LocalVertex } from "@/lib/db/schema";

export type ReportPdfMapHostProps = {
  /** Cambia para remontar el mapa y nueva captura. */
  sessionId: number;
  vertices: LocalVertex[];
  polygonIsClosed: boolean;
  subLayers: SubPolygonMapLayer[];
  pois: LocalPOI[];
  /** Devuelve data URL PNG del canvas Mapbox (puede ser vacío si falla la captura). */
  onCaptured: (dataUrl: string) => void;
};

/**
 * Mapa fuera de pantalla para capturar el polígono en el PDF (canvas WebGL tras idle).
 */
export function ReportPdfMapHost({
  sessionId,
  vertices,
  polygonIsClosed,
  subLayers,
  pois,
  onCaptured,
}: ReportPdfMapHostProps) {
  const handleCaptureReady = useCallback(
    (dataUrl: string) => {
      onCaptured(dataUrl);
    },
    [onCaptured],
  );

  return (
    <div
      key={sessionId}
      className="bg-muted fixed top-0 left-[-9999px] z-[400] h-[480px] w-[800px] overflow-hidden rounded-lg shadow-none"
      aria-hidden
    >
      {/*
        Captura del canvas Mapbox tras idle (see MapCanvasInner).
      */}
      <MapCanvas
        className="h-[480px] min-h-[480px] w-full"
        vertices={vertices}
        isClosed={polygonIsClosed}
        subLayers={subLayers}
        pois={pois}
        showUserLocation={false}
        allowVertexDrag={false}
        minimalChrome
        onCaptureReady={handleCaptureReady}
      />
    </div>
  );
}

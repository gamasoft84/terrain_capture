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
  /** Devuelve data URL PNG del mapa según motor en Ajustes (puede ser vacío si falla la captura). */
  onCaptured: (dataUrl: string) => void;
};

/**
 * Mapa fuera de pantalla para capturar el polígono en el PDF (idle + captura Mapbox/WebGL,
 * html-to-image para Google / MapLibre ESRI según motor en Ajustes).
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
        Captura tras idle — ver MapCanvasMapbox / MapCanvasGoogle / MapCanvasMapLibre.
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

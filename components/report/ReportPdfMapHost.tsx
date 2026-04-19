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
      className="pointer-events-none fixed inset-0 z-[400] flex justify-center overflow-hidden"
      style={{ opacity: 0.02, visibility: "visible" }}
      aria-hidden
    >
      {/*
        Dentro del viewport (WebKit carga teselas). Captura tras idle — ver
        MapCanvasMapbox / MapCanvasGoogle / MapCanvasMapLibre.
      */}
      <div className="bg-muted h-[480px] w-[800px] max-w-[100vw] overflow-hidden rounded-lg shadow-none">
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
    </div>
  );
}

"use client";

import { useRef } from "react";
import MapCanvas, { type SubPolygonMapLayer } from "@/components/map/MapCanvas";
import type { LocalPOI, LocalVertex } from "@/lib/db/schema";

export type ReportPdfMapHostProps = {
  /** Cambia para remontar el mapa y nueva captura. */
  sessionId: number;
  vertices: LocalVertex[];
  polygonIsClosed: boolean;
  subLayers: SubPolygonMapLayer[];
  pois: LocalPOI[];
  /** Devuelve data URL PNG (puede ser vacío si falla html-to-image). */
  onCaptured: (dataUrl: string) => void;
};

/**
 * Mapa fuera de pantalla para capturar el polígono en el PDF (html-to-image).
 */
export function ReportPdfMapHost({
  sessionId,
  vertices,
  polygonIsClosed,
  subLayers,
  pois,
  onCaptured,
}: ReportPdfMapHostProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      key={sessionId}
      ref={wrapRef}
      className="bg-muted fixed top-0 left-[-9999px] z-[400] h-[480px] w-[800px] overflow-hidden rounded-lg shadow-none"
      aria-hidden
    >
      <MapCanvas
        className="h-[480px] min-h-[480px] w-full"
        vertices={vertices}
        isClosed={polygonIsClosed}
        subLayers={subLayers}
        pois={pois}
        showUserLocation={false}
        allowVertexDrag={false}
        minimalChrome
        onCaptureReady={async () => {
          const el = wrapRef.current;
          if (!el) {
            onCaptured("");
            return;
          }
          try {
            const { toPng } = await import("html-to-image");
            const url = await toPng(el, {
              pixelRatio: 2,
              cacheBust: true,
            });
            onCaptured(url);
          } catch {
            onCaptured("");
          }
        }}
      />
    </div>
  );
}

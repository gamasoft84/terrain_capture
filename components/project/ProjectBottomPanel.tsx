"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { blobFromStored } from "@/lib/db/blobFromStored";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProjectPhoto,
  LocalVertex,
} from "@/lib/db/schema";
import { formatAreaDisplay, formatPerimeterDisplay } from "@/lib/geo/calculations";
import { buildProjectStats } from "@/lib/project/buildProjectStats";
import type { SubPolygonMapLayer } from "@/components/map/MapCanvas";
import { PolygonStats } from "./PolygonStats";

function VertexStripThumb({
  vertex: v,
  displayIndex,
  onSelect,
}: {
  vertex: LocalVertex;
  displayIndex: number;
  onSelect: () => void;
}) {
  const blobUrl = useMemo(() => {
    const b = blobFromStored(v);
    return b ? URL.createObjectURL(b) : null;
  }, [v]);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);
  const src = v.photoUrl ?? blobUrl;

  return (
    <button
      type="button"
      className="border-border bg-muted/40 hover:border-primary/60 relative shrink-0 overflow-hidden rounded-lg border-2 transition-colors"
      style={{ width: "4.5rem", height: "4.5rem" }}
      onClick={onSelect}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="size-full object-cover" />
          <span className="bg-background/90 text-foreground absolute bottom-1 left-1 rounded px-1 font-mono text-[10px] font-bold shadow-sm">
            P{displayIndex}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center font-mono text-xs font-semibold">
          P{displayIndex}
        </span>
      )}
    </button>
  );
}

export interface ProjectBottomPanelProps {
  vertices: LocalVertex[];
  main: LocalPolygon | undefined;
  subLayers?: SubPolygonMapLayer[];
  pois?: LocalPOI[];
  projectPhotos?: LocalProjectPhoto[];
  onCaptureClick: () => void;
  onClosePolygon: () => void;
  onVertexClick: (vertex: LocalVertex, displayIndex: number) => void;
  closePolygonBusy?: boolean;
  /** Bloque opcional encima de métricas (p. ej. gestión de sub-áreas). */
  subPolygonManager?: ReactNode;
}

export function ProjectBottomPanel({
  vertices,
  main,
  subLayers = [],
  pois = [],
  projectPhotos = [],
  onCaptureClick,
  onClosePolygon,
  onVertexClick,
  closePolygonBusy,
  subPolygonManager,
}: ProjectBottomPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const statsSummary = useMemo(() => {
    if (!main) return null;
    return buildProjectStats({
      main,
      mainVertices: vertices,
      subLayers,
      pois,
      projectPhotos,
    });
  }, [main, vertices, subLayers, pois, projectPhotos]);

  const areaLabel = formatAreaDisplay(main?.areaM2);
  const perimeterLabel = formatPerimeterDisplay(main?.perimeterM);
  const vertexCountCollapsed = statsSummary?.totalVertices ?? vertices.length;

  const canClose =
    Boolean(main) &&
    !main!.isClosed &&
    vertices.length >= 3 &&
    !closePolygonBusy;

  const sorted = [...vertices].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div
      className={cn(
        "border-border bg-card/95 supports-[backdrop-filter]:bg-card/90 fixed right-0 bottom-16 left-0 z-[32] border-t shadow-[0_-4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md",
        expanded ? "max-h-[min(58vh,520px)]" : "max-h-none",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 py-2 text-xs font-medium"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-4" aria-hidden />
        ) : (
          <ChevronUp className="size-4" aria-hidden />
        )}
        {expanded ? "Ocultar panel" : "Mostrar panel"}
      </button>

      {expanded ? (
        <div className="flex max-h-[min(54vh,480px)] min-h-0 flex-col overflow-hidden px-3 pb-3">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {subPolygonManager ? (
              <div className="min-h-0 shrink-0">{subPolygonManager}</div>
            ) : null}
            {main ? (
              <PolygonStats
                main={main}
                mainVertices={vertices}
                subLayers={subLayers}
                pois={pois}
                projectPhotos={projectPhotos}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-12 flex-1"
                disabled={!main}
                onClick={onCaptureClick}
              >
                Capturar vértice
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-12 flex-1"
                disabled={!canClose}
                onClick={onClosePolygon}
              >
                {main?.isClosed
                  ? "Polígono cerrado"
                  : closePolygonBusy
                    ? "Cerrando…"
                    : vertices.length < 3
                      ? "Cerrar (mín. 3 vértices)"
                      : "Cerrar polígono"}
              </Button>
            </div>

            <div className="min-h-0 shrink-0">
              <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                Vértices (principal)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                {sorted.map((v, i) => {
                  const displayIndex = i + 1;
                  return (
                    <VertexStripThumb
                      key={v.localId}
                      vertex={v}
                      displayIndex={displayIndex}
                      onSelect={() => onVertexClick(v, displayIndex)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center justify-center gap-3 px-3 pb-2 text-xs">
          <span>
            <span className="text-foreground font-mono font-semibold">
              {vertexCountCollapsed}
            </span>{" "}
            vért.
          </span>
          <span className="text-foreground font-mono">{areaLabel}</span>
          <span className="text-foreground font-mono">{perimeterLabel}</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { blobFromStored } from "@/lib/db/blobFromStored";
import type { LocalPolygon, LocalVertex } from "@/lib/db/schema";
import {
  estimateAreaError,
  formatAreaDisplay,
} from "@/lib/geo/calculations";

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
  onCaptureClick: () => void;
  onClosePolygon: () => void;
  onVertexClick: (vertex: LocalVertex, displayIndex: number) => void;
  closePolygonBusy?: boolean;
}

export function ProjectBottomPanel({
  vertices,
  main,
  onCaptureClick,
  onClosePolygon,
  onVertexClick,
  closePolygonBusy,
}: ProjectBottomPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const areaLabel = formatAreaDisplay(main?.areaM2);
  const areaUncertaintyM2 = useMemo(() => {
    if (!main?.isClosed || vertices.length < 3) return 0;
    return estimateAreaError(vertices);
  }, [main?.isClosed, vertices]);
  const perimeterLabel =
    main?.perimeterM != null && Number.isFinite(main.perimeterM)
      ? `${main.perimeterM.toFixed(1)} m`
      : "—";
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
        expanded ? "max-h-[min(52vh,420px)]" : "max-h-none",
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
        <div className="flex max-h-[min(48vh,380px)] flex-col gap-3 px-3 pb-3">
          <div className="text-muted-foreground grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-foreground font-mono text-sm font-semibold">
                {vertices.length}
              </div>
              <div>Vértices</div>
            </div>
            <div>
              <div className="text-foreground font-mono text-sm font-semibold">
                {areaLabel}
              </div>
              <div>Área</div>
            </div>
            <div>
              <div className="text-foreground font-mono text-sm font-semibold">
                {perimeterLabel}
              </div>
              <div>Perímetro</div>
            </div>
          </div>

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

          <p className="text-muted-foreground text-[10px] leading-snug">
            Área y perímetro son estimaciones (Turf sobre lon/lat; no sustituye
            topografía certificada).
            {areaUncertaintyM2 > 0 ? (
              <>
                {" "}
                Incertidumbre orientativa del área ≈ ±
                {Math.round(areaUncertaintyM2)} m² según precisión GPS por
                vértice.
              </>
            ) : null}
          </p>

          <div className="min-h-0 flex-1">
            <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
              Vértices
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
      ) : (
        <div className="text-muted-foreground flex items-center justify-center gap-3 px-3 pb-2 text-xs">
          <span>
            <span className="text-foreground font-mono font-semibold">
              {vertices.length}
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

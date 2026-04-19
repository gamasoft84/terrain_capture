"use client";

import { Camera, Hexagon, ImagePlus } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LocalPOI, LocalPolygon, LocalProjectPhoto, LocalVertex } from "@/lib/db/schema";
import {
  buildProjectStats,
  type ProjectPhotoCounts,
} from "@/lib/project/buildProjectStats";
import {
  consecutiveVertexEdgeSegments,
  EDGE_DISTANCE_MAP_LABEL_MIN_ZOOM,
  formatAreaDisplay,
  formatDistanceMeters,
  formatPerimeterDisplay,
  type PolygonEdgeSegment,
} from "@/lib/geo/calculations";

type SubLayerInput = {
  polygon: LocalPolygon;
  vertices: LocalVertex[];
};

export interface PolygonStatsProps {
  main: LocalPolygon;
  mainVertices: LocalVertex[];
  subLayers: SubLayerInput[];
  pois: LocalPOI[];
  projectPhotos: LocalProjectPhoto[];
}

export function PolygonStats({
  main,
  mainVertices,
  subLayers,
  pois,
  projectPhotos,
}: PolygonStatsProps) {
  const stats = useMemo(
    () =>
      buildProjectStats({
        main,
        mainVertices,
        subLayers,
        pois,
        projectPhotos,
      }),
    [main, mainVertices, subLayers, pois, projectPhotos],
  );

  const mainEdgeSegments = useMemo(
    () => consecutiveVertexEdgeSegments(mainVertices, main.isClosed, "P"),
    [mainVertices, main.isClosed],
  );

  const subEdgeBlocks = useMemo(
    () =>
      subLayers.map(({ polygon, vertices }) => ({
        polygonLocalId: polygon.localId,
        name: polygon.name,
        color: polygon.color,
        segments: consecutiveVertexEdgeSegments(
          vertices,
          polygon.isClosed,
          "S",
        ),
      })),
    [subLayers],
  );

  const hasAnyEdgeList =
    mainEdgeSegments.length > 0 ||
    subEdgeBlocks.some((b) => b.segments.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <Card className="border-border/80 overflow-hidden py-2 shadow-none">
        <CardHeader className="space-y-0 px-2.5 pb-1.5 pt-0">
          <CardTitle className="text-[11px] font-semibold tracking-wide uppercase">
            Métricas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-2.5 pb-1.5 pt-0">
          <div>
            <p className="text-muted-foreground mb-1 font-sans text-[10px] font-medium tracking-wide uppercase">
              Terreno principal
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <InlineMetric
                label="Área"
                value={formatAreaDisplay(stats.mainAreaM2)}
              />
              <DotSep />
              <InlineMetric
                label="Perímetro"
                value={formatPerimeterDisplay(stats.mainPerimeterM)}
              />
              <DotSep />
              <InlineMetric
                label="Vértices"
                value={String(stats.mainVertexCount)}
              />
            </div>
            {stats.mainAreaUncertaintyM2 > 0 ? (
              <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
                Incertidumbre área ≈ ±
                {Math.round(stats.mainAreaUncertaintyM2)} m² (GPS por vértice).
              </p>
            ) : null}
          </div>

          <div className="border-border/40 border-t pt-2">
            <p className="text-muted-foreground mb-1 font-sans text-[10px] font-medium tracking-wide uppercase">
              Resumen proyecto
            </p>
            <p className="text-muted-foreground mb-1.5 font-sans text-[9px] leading-snug">
              Área libre ≈ terreno principal menos suma de sub-áreas (estimación).
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <InlineMetric
                label="Área libre"
                value={formatAreaDisplay(stats.freeAreaM2)}
              />
              <DotSep />
              <InlineMetric
                label="Suma sub-áreas"
                value={formatAreaDisplay(
                  stats.subRows.length > 0 ? stats.sumSubAreasM2 : null,
                )}
              />
              <DotSep />
              <InlineMetric
                label="Total vértices"
                value={String(stats.totalVertices)}
              />
              <DotSep />
              <InlineMetric
                label="Puntos de interés"
                value={String(stats.poiCount)}
              />
            </div>
            {stats.subAreasExceedMain ? (
              <p className="text-amber-900 dark:text-amber-200 mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug">
                La suma de sub-áreas supera el área del terreno principal; el
                valor &quot;área libre&quot; queda en 0. Revisa solapes o la
                geometría.
              </p>
            ) : null}
          </div>

          <PhotoSummaryStrip counts={stats.photoCounts} />
        </CardContent>
      </Card>

      {hasAnyEdgeList ? (
        <Card className="border-border/80 py-2 shadow-none">
          <CardHeader className="space-y-0 px-2.5 pb-1 pt-0">
            <CardTitle className="text-[11px] font-semibold tracking-wide uppercase">
              Distancia entre puntos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-2.5 pb-1.5 pt-0">
            {mainEdgeSegments.length > 0 ? (
              <EdgeSegmentBlock title="Terreno principal" segments={mainEdgeSegments} />
            ) : null}
            {subEdgeBlocks.map(
              (block) =>
                block.segments.length > 0 && (
                  <EdgeSegmentBlock
                    key={block.polygonLocalId}
                    title={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: block.color }}
                          aria-hidden
                        />
                        <span>{block.name}</span>
                      </span>
                    }
                    segments={block.segments}
                  />
                ),
            )}
          </CardContent>
        </Card>
      ) : null}

      {stats.subRows.length > 0 ? (
        <Card className="border-border/80 py-2 shadow-none">
          <CardHeader className="space-y-0 px-2.5 pb-1 pt-0">
            <CardTitle className="text-[11px] font-semibold tracking-wide uppercase">
              Sub-áreas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 px-2.5 pb-1.5 pt-0">
            {stats.subRows.map((row) => (
              <div
                key={row.polygonLocalId}
                className="border-border/60 flex flex-col gap-1.5 rounded-md border bg-muted/20 px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-medium">{row.name}</span>
                  {!row.isClosed ? (
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      (abierto)
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <InlineMetric
                    label="Área"
                    value={formatAreaDisplay(row.areaM2)}
                  />
                  <DotSep />
                  <InlineMetric
                    label="Perímetro"
                    value={formatPerimeterDisplay(row.perimeterM)}
                  />
                  <DotSep />
                  <InlineMetric
                    label="Vértices"
                    value={String(row.vertexCount)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground px-0.5 text-[9px] leading-snug">
        Área, perímetro y distancias: estimaciones (Turf); no sustituye
        topografía certificada.
      </p>
    </div>
  );
}

function PhotoSummaryStrip({ counts }: { counts: ProjectPhotoCounts }) {
  const { total, fromVertices, fromPois, fromExtras } = counts;

  return (
    <div className="border-border/70 from-primary/[0.06] to-muted/30 rounded-lg border bg-gradient-to-b via-muted/20 p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          Fotos en el proyecto
        </span>
        <span
          className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-mono text-sm font-bold tabular-nums shadow-sm"
          title="Total de fotos con imagen guardada"
        >
          {total}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PhotoStatMini
          icon={
            <Hexagon
              className="text-primary size-3.5 opacity-90"
              aria-hidden
            />
          }
          label="Polígono"
          hint="en vértices"
          value={fromVertices}
        />
        <PhotoStatMini
          icon={
            <Camera className="text-primary size-3.5 opacity-90" aria-hidden />
          }
          label="POIs"
          hint="con foto"
          value={fromPois}
        />
        <PhotoStatMini
          icon={
            <ImagePlus
              className="text-primary size-3.5 opacity-90"
              aria-hidden
            />
          }
          label="Galería"
          hint="extra"
          value={fromExtras}
        />
      </div>
    </div>
  );
}

function PhotoStatMini({
  icon,
  label,
  hint,
  value,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  value: number;
}) {
  return (
    <div className="border-border/55 bg-background/85 flex flex-col items-center rounded-md border px-1 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="text-muted-foreground mb-1 flex flex-col items-center gap-0.5">
        {icon}
        <span className="max-w-[5rem] text-[9px] font-semibold leading-tight">
          {label}
        </span>
      </span>
      <span className="text-foreground font-mono text-lg font-bold tabular-nums leading-none">
        {value}
      </span>
      <span className="text-muted-foreground mt-0.5 text-[8px] leading-none">
        {hint}
      </span>
    </div>
  );
}

function DotSep() {
  return (
    <span
      className="text-muted-foreground/35 shrink-0 select-none"
      aria-hidden
    >
      ·
    </span>
  );
}

function InlineMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1">
      <span className="text-muted-foreground shrink-0 font-sans text-[10px] font-normal tracking-tight">
        {label}
      </span>
      <span className="text-foreground font-mono text-xs font-semibold tabular-nums">
        {value}
      </span>
    </span>
  );
}

function EdgeSegmentBlock({
  title,
  segments,
}: {
  title: ReactNode;
  segments: PolygonEdgeSegment[];
}) {
  return (
    <div className="border-border/50 rounded-md border bg-muted/10 px-2 py-2">
      <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">
        {title}
      </p>
      <ul className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
        {segments.map((s, i) => (
          <li
            key={`${s.fromLabel}-${s.toLabel}-${i}`}
            className="text-foreground flex items-baseline justify-between gap-2 font-mono text-[11px] tabular-nums"
          >
            <span className="min-w-0 shrink truncate">
              {s.fromLabel} → {s.toLabel}
            </span>
            <span className="text-muted-foreground shrink-0">
              {formatDistanceMeters(s.meters)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

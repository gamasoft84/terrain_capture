"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LocalPOI, LocalPolygon, LocalProjectPhoto, LocalVertex } from "@/lib/db/schema";
import { buildProjectStats } from "@/lib/project/buildProjectStats";
import {
  formatAreaDisplay,
  formatPerimeterDisplay,
} from "@/lib/geo/calculations";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-2">
      <Card className="border-border/80 py-3 shadow-none">
        <CardHeader className="space-y-1 px-3 pb-2 pt-0">
          <CardTitle className="text-sm font-semibold">
            Terreno principal
          </CardTitle>
          <CardDescription className="text-xs">
            Polígono principal del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 px-3 pb-0 pt-0 sm:grid-cols-3">
          <StatBlock label="Área" value={formatAreaDisplay(stats.mainAreaM2)} />
          <StatBlock
            label="Perímetro"
            value={formatPerimeterDisplay(stats.mainPerimeterM)}
          />
          <StatBlock
            label="Vértices"
            value={String(stats.mainVertexCount)}
            className="sm:col-span-1"
          />
        </CardContent>
        {stats.mainAreaUncertaintyM2 > 0 ? (
          <p className="text-muted-foreground px-3 pb-2 pt-1 text-[10px] leading-snug">
            Incertidumbre orientativa del área ≈ ±
            {Math.round(stats.mainAreaUncertaintyM2)} m² según precisión GPS
            por vértice.
          </p>
        ) : null}
      </Card>

      {stats.subRows.length > 0 ? (
        <Card className="border-border/80 py-3 shadow-none">
          <CardHeader className="space-y-1 px-3 pb-2 pt-0">
            <CardTitle className="text-sm font-semibold">Sub-áreas</CardTitle>
            <CardDescription className="text-xs">
              Área y perímetro por sub-polígono
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3 pb-1 pt-0">
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
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatBlock
                    label="Área"
                    value={formatAreaDisplay(row.areaM2)}
                    compact
                  />
                  <StatBlock
                    label="Perím."
                    value={formatPerimeterDisplay(row.perimeterM)}
                    compact
                  />
                  <StatBlock
                    label="Vért."
                    value={String(row.vertexCount)}
                    compact
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 py-3 shadow-none">
        <CardHeader className="space-y-1 px-3 pb-2 pt-0">
          <CardTitle className="text-sm font-semibold">Resumen</CardTitle>
          <CardDescription className="text-xs">
            Área libre estimada y conteos del proyecto
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 px-3 pb-0 pt-0 sm:grid-cols-2">
          <StatBlock
            label="Área libre (principal − subáreas)"
            value={formatAreaDisplay(stats.freeAreaM2)}
            align="left"
          />
          <StatBlock
            label="Suma áreas sub"
            value={formatAreaDisplay(
              stats.subRows.length > 0 ? stats.sumSubAreasM2 : null,
            )}
            align="left"
          />
          <StatBlock
            label="Vértices (total)"
            value={String(stats.totalVertices)}
            align="left"
          />
          <StatBlock
            label="POIs"
            value={String(stats.poiCount)}
            align="left"
          />
          <div
            className={cn(
              "rounded-md border px-2.5 py-2 sm:col-span-2",
              stats.subAreasExceedMain
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border/60 bg-muted/15",
            )}
          >
            <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Fotos (con imagen)
            </p>
            <p className="text-foreground font-mono text-base font-semibold tabular-nums">
              {stats.photoCounts.total}
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-[10px] tabular-nums leading-snug">
              Vértices {stats.photoCounts.fromVertices} · POIs{" "}
              {stats.photoCounts.fromPois} · Adicionales{" "}
              {stats.photoCounts.fromExtras}
            </p>
            {stats.subAreasExceedMain ? (
              <p className="text-amber-900 dark:text-amber-200 mt-1.5 text-[10px] leading-snug">
                La suma de subáreas supera el área del terreno principal; el
                valor &quot;libre&quot; se muestra en 0 (revisa solapes o
                geometría).
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-[10px] leading-snug">
        Área y perímetro son estimaciones (Turf sobre lon/lat; no sustituye
        topografía certificada).
      </p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  compact,
  align = "center",
  className,
}: {
  label: string;
  value: string;
  compact?: boolean;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <div
        className={cn(
          "text-foreground font-mono font-semibold tabular-nums",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "text-muted-foreground",
          compact ? "text-[9px]" : "text-[10px]",
        )}
      >
        {label}
      </div>
    </div>
  );
}

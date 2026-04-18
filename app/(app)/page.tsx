"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/lib/db/schema";
import { formatAreaDisplay } from "@/lib/geo/calculations";

type Row = {
  projectName: string;
  projectLocalId: string;
  locationLabel?: string;
  updatedAt: Date;
  status: string;
  areaLabel: string | null;
};

export default function DashboardPage() {
  /** Valor por defecto: evita skeleton infinito si la query tarda o falla (p. ej. Safari + IndexedDB). */
  const rows = useLiveQuery(
    async (): Promise<Row[]> => {
      try {
        if (typeof window === "undefined") return [];
        const db = getDb();
        const projects = await db.projects.toArray();
        projects.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
        const result: Row[] = [];
        for (const p of projects) {
          const main = await db.polygons
            .where("projectLocalId")
            .equals(p.localId)
            .filter((poly) => poly.type === "main")
            .first();
          let areaLabel: string | null = null;
          if (main?.isClosed && main.areaM2 != null) {
            areaLabel = formatAreaDisplay(main.areaM2);
          }
          result.push({
            projectName: p.name,
            projectLocalId: p.localId,
            locationLabel: p.locationLabel,
            updatedAt: p.updatedAt,
            status: p.status,
            areaLabel,
          });
        }
        return result;
      } catch (e) {
        console.error("[TerrainCapture] dashboard Dexie", e);
        return [];
      }
    },
    [],
    [],
  );

  const safeRows = rows ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Proyectos
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Levantamientos guardados en este dispositivo (Dexie).
        </p>
      </div>

      {safeRows.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Sin proyectos</CardTitle>
            <CardDescription>
              Crea uno para empezar un levantamiento.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {safeRows.map((row) => (
        <Link key={row.projectLocalId} href={`/projects/${row.projectLocalId}`}>
          <Card className="border-border bg-card hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{row.projectName}</CardTitle>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {row.status.replace("_", " ")}
                </Badge>
              </div>
              {row.locationLabel ? (
                <CardDescription>{row.locationLabel}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                Actualizado{" "}
                {format(row.updatedAt, "d MMM yyyy, HH:mm", { locale: es })}
              </span>
              {row.areaLabel ? (
                <span className="text-primary font-mono font-medium">
                  Área: {row.areaLabel}
                </span>
              ) : (
                <span className="font-mono">Área: —</span>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}

      <Link
        href="/projects/new"
        className={cn(
          buttonVariants({ variant: "default", size: "icon-lg" }),
          "fixed bottom-24 right-4 z-30 size-14 rounded-full shadow-lg md:bottom-28",
        )}
        aria-label="Nuevo proyecto"
      >
        <Plus className="size-7" />
      </Link>
    </div>
  );
}

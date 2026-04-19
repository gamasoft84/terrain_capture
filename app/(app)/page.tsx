"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyProjectsHero } from "@/components/dashboard/EmptyProjectsHero";
import {
  ProjectSwipeRow,
  type ProjectSwipeRowData,
} from "@/components/dashboard/ProjectSwipeRow";
import { getDb } from "@/lib/db/schema";
import { formatAreaDisplay } from "@/lib/geo/calculations";

export default function DashboardPage() {
  /** Valor por defecto: evita skeleton infinito si la query tarda o falla (p. ej. Safari + IndexedDB). */
  const rows = useLiveQuery(
    async (): Promise<ProjectSwipeRowData[]> => {
      try {
        if (typeof window === "undefined") return [];
        const db = getDb();
        const projects = await db.projects.toArray();
        projects.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
        const result: ProjectSwipeRowData[] = [];
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

      {safeRows.length === 0 ? <EmptyProjectsHero /> : null}

      {safeRows.map((row) => (
        <ProjectSwipeRow key={row.projectLocalId} row={row} />
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

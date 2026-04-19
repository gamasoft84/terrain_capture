"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportConfig } from "@/components/report/ReportConfig";
import { getDb } from "@/lib/db/schema";
import { listSubPolygonsByProject } from "@/lib/db/polygons";
import { listPoisByProject } from "@/lib/db/pois";
import { listProjectPhotos } from "@/lib/db/projectPhotos";
import { listVerticesByPolygon } from "@/lib/db/vertices";
import { cn } from "@/lib/utils";

export default function ProjectReportPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";

  const data = useLiveQuery(
    async () => {
      if (typeof window === "undefined" || !localId) return undefined;
      const db = getDb();
      const project = await db.projects.get(localId);
      const main = await db.polygons
        .where("projectLocalId")
        .equals(localId)
        .filter((p) => p.type === "main")
        .first();
      let vertexCount = 0;
      if (main != null) {
        const verts = await listVerticesByPolygon(main.localId);
        vertexCount = verts.length;
      }
      const pois = await listPoisByProject(localId);
      const galleryPhotos = await listProjectPhotos(localId);
      const subs = await listSubPolygonsByProject(localId);
      return {
        project,
        previewContext: {
          mainAreaM2: main?.areaM2 ?? null,
          mainPerimeterM: main?.perimeterM ?? null,
          vertexCount,
          poiCount: pois.length,
          galleryPhotoCount: galleryPhotos.length,
          subPolygonCount: subs.length,
        },
      };
    },
    [localId],
  );

  if (data === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="min-h-[28rem] w-full" />
      </div>
    );
  }

  if (!data.project) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Proyecto no encontrado</CardTitle>
          <CardDescription>No hay datos locales para este id.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Inicio
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            Generar reporte
          </h1>
          <p className="text-muted-foreground text-sm">{data.project.name}</p>
        </div>
        <Link
          href={`/projects/${localId}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Volver al mapa
        </Link>
      </div>

      <ReportConfig
        key={data.project.localId}
        project={data.project}
        previewContext={data.previewContext}
      />
    </div>
  );
}

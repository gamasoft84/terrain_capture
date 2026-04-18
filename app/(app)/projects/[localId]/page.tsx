"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db/schema";

export default function ProjectDetailPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";

  const data = useLiveQuery(async () => {
    if (typeof window === "undefined" || !localId) return undefined;
    const db = getDb();
    const project = await db.projects.get(localId);
    const main = await db.polygons
      .where("projectLocalId")
      .equals(localId)
      .filter((p) => p.type === "main")
      .first();
    return { project, main };
  }, [localId]);

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data.project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proyecto no encontrado</CardTitle>
          <CardDescription>
            No hay datos locales para este id. Vuelve al inicio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
          >
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {data.project.name}
          </h1>
          {data.project.locationLabel ? (
            <p className="text-muted-foreground text-sm">
              {data.project.locationLabel}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Lista de proyectos
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vista de proyecto</CardTitle>
          <CardDescription>
            Mapa a pantalla completa, captura de vértices y estadísticas: tarea
            1.10+.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Polígono principal:{" "}
            <span className="text-foreground font-mono">
              {data.main?.name ?? "—"} ({data.main?.localId ?? "—"})
            </span>
          </p>
          <p>
            Estado polígono:{" "}
            {data.main?.isClosed ? "Cerrado" : "Abierto (sin cerrar)"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

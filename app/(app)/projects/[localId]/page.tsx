"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
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
import { CaptureButton } from "@/components/capture/CaptureButton";
import MapCanvas from "@/components/map/MapCanvas";
import { useMapVertexDrag } from "@/components/providers/MapVertexDragPreference";
import { ProjectBottomPanel } from "@/components/project/ProjectBottomPanel";
import { VertexDetailSheet } from "@/components/project/VertexDetailSheet";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { updatePolygon } from "@/lib/db/polygons";
import {
  deleteVertex,
  updateVertex,
} from "@/lib/db/vertices";
import { getDb } from "@/lib/db/schema";
import type { LocalVertex } from "@/lib/db/schema";

export default function ProjectDetailPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";
  const { allowVertexMapDrag } = useMapVertexDrag();

  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  const [vertexSheetOpen, setVertexSheetOpen] = useState(false);
  const [selectedVertex, setSelectedVertex] = useState<LocalVertex | null>(
    null,
  );
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState(1);
  const [closePolygonBusy, setClosePolygonBusy] = useState(false);

  const data = useLiveQuery(async () => {
    if (typeof window === "undefined" || !localId) return undefined;
    const db = getDb();
    const project = await db.projects.get(localId);
    const main = await db.polygons
      .where("projectLocalId")
      .equals(localId)
      .filter((p) => p.type === "main")
      .first();
    const vertices =
      main != null
        ? await db.vertices
            .where("polygonLocalId")
            .equals(main.localId)
            .sortBy("orderIndex")
        : [];
    return { project, main, vertices };
  }, [localId]);

  const handleClosePolygon = useCallback(async () => {
    if (!data?.main || data.vertices.length < 3) return;
    const polygonId = data.main.localId;
    setClosePolygonBusy(true);
    try {
      await updatePolygon(polygonId, { isClosed: true });
      await refreshPolygonMetricsFromVertices(polygonId, true);
    } finally {
      setClosePolygonBusy(false);
    }
  }, [data]);

  const handleDeleteVertex = useCallback(
    async (vertexLocalId: string) => {
      if (!data?.main) return;
      await deleteVertex(vertexLocalId);
      await refreshPolygonMetricsFromVertices(
        data.main.localId,
        data.main.isClosed,
      );
    },
    [data],
  );

  const handleSaveNote = useCallback(
    async (vertexLocalId: string, note: string | undefined) => {
      await updateVertex(vertexLocalId, { note });
    },
    [],
  );

  const openVertexDetail = useCallback((v: LocalVertex, displayIndex: number) => {
    setSelectedVertex(v);
    setSelectedDisplayIndex(displayIndex);
    setVertexSheetOpen(true);
  }, []);

  const onVertexSheetOpenChange = useCallback((open: boolean) => {
    setVertexSheetOpen(open);
    if (!open) setSelectedVertex(null);
  }, []);

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

  if (!data.main) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{data.project.name}</CardTitle>
          <CardDescription>
            No hay polígono principal en Dexie para este proyecto.
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
    <div className="-mx-4 -mt-4 flex min-h-0 flex-1 flex-col">
      <div className="fixed inset-x-0 top-14 bottom-16 z-10">
        <MapCanvas
          className="h-full w-full min-h-0"
          vertices={data.vertices}
          isClosed={data.main.isClosed}
          areaM2={data.main.areaM2 ?? null}
          showUserLocation
          allowVertexDrag={allowVertexMapDrag}
          vertexDragTarget={{
            polygonLocalId: data.main.localId,
            polygonIsClosed: data.main.isClosed,
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <div className="bg-card/90 pointer-events-auto max-w-[min(100%,18rem)] rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm">
            <h1 className="text-foreground truncate text-base font-semibold tracking-tight">
              {data.project.name}
            </h1>
            {data.project.locationLabel ? (
              <p className="text-muted-foreground truncate text-xs">
                {data.project.locationLabel}
              </p>
            ) : null}
          </div>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "pointer-events-auto shrink-0 shadow-md",
            )}
          >
            Lista
          </Link>
        </div>
      </div>

      <CaptureButton
        polygonLocalId={data.main.localId}
        projectLocalId={data.project.localId}
        polygonIsClosed={data.main.isClosed}
        disabled={false}
        showFab={false}
        captureSheetOpen={captureSheetOpen}
        onCaptureSheetOpenChange={setCaptureSheetOpen}
      />

      <ProjectBottomPanel
        vertices={data.vertices}
        main={data.main}
        onCaptureClick={() => setCaptureSheetOpen(true)}
        onClosePolygon={() => void handleClosePolygon()}
        onVertexClick={openVertexDetail}
        closePolygonBusy={closePolygonBusy}
      />

      <VertexDetailSheet
        key={selectedVertex?.localId ?? "closed"}
        vertex={selectedVertex}
        displayIndex={selectedDisplayIndex}
        open={vertexSheetOpen}
        onOpenChange={onVertexSheetOpenChange}
        onDelete={handleDeleteVertex}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
}

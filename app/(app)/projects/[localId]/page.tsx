"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MapCanvas, { type SubPolygonMapLayer } from "@/components/map/MapCanvas";
import { POIDetailSheet } from "@/components/project/POIDetailSheet";
import { useMapVertexDrag } from "@/components/providers/MapVertexDragPreference";
import { useHighAccuracyGpsDesired } from "@/lib/hooks/useBatterySaver";
import { ProjectBottomPanel } from "@/components/project/ProjectBottomPanel";
import {
  SubPolygonWorkflow,
  useSeedSubAreasWorkflow,
} from "@/components/project/SubPolygonWorkflow";
import { VertexDetailSheet } from "@/components/project/VertexDetailSheet";
import { FieldPermissionsIntro } from "@/components/onboarding/FieldPermissionsIntro";
import { analyzeClosedPolygonIssues } from "@/lib/geo/polygonTopology";
import { ProjectMapExportMenu } from "@/components/project/ProjectMapExportMenu";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import {
  listSubPolygonsByProject,
  updatePolygon,
} from "@/lib/db/polygons";
import {
  deleteVertex,
  listVerticesByPolygon,
  updateVertex,
} from "@/lib/db/vertices";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { listProjectPhotos } from "@/lib/db/projectPhotos";
import { deletePOI, listPoisByProject, updatePOI } from "@/lib/db/pois";
import { getDb } from "@/lib/db/schema";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalProjectPhoto,
  LocalVertex,
} from "@/lib/db/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathExtensionForImageBlob,
  uploadToProjectPhotosBucket,
} from "@/lib/supabase/storage";

type ProjectDetailData = {
  project: LocalProject | undefined;
  main: LocalPolygon | undefined;
  vertices: LocalVertex[];
  subLayers: SubPolygonMapLayer[];
  pois: LocalPOI[];
  projectPhotos: LocalProjectPhoto[];
};

export default function ProjectDetailPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";
  const { allowVertexMapDrag } = useMapVertexDrag();
  const highAccuracyGpsDesired = useHighAccuracyGpsDesired();

  /** Centro del mapa en proyecto vacío (solo vértices): ubicación actual del dispositivo. */
  const [emptyProjectUserCenter, setEmptyProjectUserCenter] = useState<
    [number, number] | null
  >(null);

  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  const [vertexSheetOpen, setVertexSheetOpen] = useState(false);
  const [selectedVertex, setSelectedVertex] = useState<LocalVertex | null>(
    null,
  );
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState(1);
  const [closePolygonBusy, setClosePolygonBusy] = useState(false);
  const [selectedSubPolygonLocalId, setSelectedSubPolygonLocalId] = useState<
    string | null
  >(null);
  const [poiSheetOpen, setPoiSheetOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<LocalPOI | null>(null);
  const [subAreasWorkflowEnabled, setSubAreasWorkflowEnabled] =
    useState(false);
  const data = useLiveQuery(
    async (): Promise<ProjectDetailData | undefined> => {
      try {
        if (typeof window === "undefined" || !localId) return undefined;
        const db = getDb();
        const project = await db.projects.get(localId);
        const main = await db.polygons
          .where("projectLocalId")
          .equals(localId)
          .filter((p) => p.type === "main")
          .first();
        let vertices: LocalVertex[] = [];
        if (main != null) {
          vertices = await listVerticesByPolygon(main.localId);
        }
        const subs = await listSubPolygonsByProject(localId);
        const subLayers: SubPolygonMapLayer[] = await Promise.all(
          subs.map(async (polygon) => ({
            polygon,
            vertices: await listVerticesByPolygon(polygon.localId),
          })),
        );
        const pois = await listPoisByProject(localId);
        const projectPhotos = await listProjectPhotos(localId);
        return { project, main, vertices, subLayers, pois, projectPhotos };
      } catch (e) {
        console.error("[TerrainCapture] proyecto Dexie", e);
        return {
          project: undefined,
          main: undefined,
          vertices: [],
          subLayers: [],
          pois: [],
          projectPhotos: [],
        };
      }
    },
    [localId],
  );

  useEffect(() => {
    setEmptyProjectUserCenter(null);
  }, [localId]);

  const isEmptyProjectMap = useMemo(() => {
    if (!data?.main) return false;
    return (
      data.vertices.length === 0 &&
      data.pois.length === 0 &&
      data.subLayers.every((s) => s.vertices.length === 0)
    );
  }, [data?.main, data?.vertices, data?.pois, data?.subLayers]);

  useEffect(() => {
    if (!isEmptyProjectMap) return;
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setEmptyProjectUserCenter([
          pos.coords.longitude,
          pos.coords.latitude,
        ]);
      },
      () => {
        /* sin permiso o error: queda el centro por defecto del mapa */
      },
      {
        enableHighAccuracy: highAccuracyGpsDesired,
        maximumAge: 120_000,
        timeout: 20_000,
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isEmptyProjectMap, highAccuracyGpsDesired]);

  useSeedSubAreasWorkflow(
    data === undefined ? undefined : data.subLayers.length,
    setSubAreasWorkflowEnabled,
  );

  const selectedSubPolygonForUi = useMemo(() => {
    if (!selectedSubPolygonLocalId || !data?.subLayers) {
      return selectedSubPolygonLocalId;
    }
    const ok = data.subLayers.some(
      (s) => s.polygon.localId === selectedSubPolygonLocalId,
    );
    return ok ? selectedSubPolygonLocalId : null;
  }, [data?.subLayers, selectedSubPolygonLocalId]);

  const resolveVertexDragTarget = useMemo(() => {
    if (!data?.main || !allowVertexMapDrag) return undefined;
    const main = data.main;
    const subLayers = data.subLayers;
    return (vertex: LocalVertex) => {
      if (vertex.polygonLocalId === main.localId) {
        return {
          polygonLocalId: main.localId,
          polygonIsClosed: main.isClosed,
        };
      }
      if (
        selectedSubPolygonForUi &&
        vertex.polygonLocalId === selectedSubPolygonForUi
      ) {
        const sub = subLayers.find(
          (s) => s.polygon.localId === vertex.polygonLocalId,
        );
        if (sub) {
          return {
            polygonLocalId: sub.polygon.localId,
            polygonIsClosed: sub.polygon.isClosed,
          };
        }
      }
      return null;
    };
  }, [allowVertexMapDrag, data, selectedSubPolygonForUi]);

  const handleClosePolygon = useCallback(async () => {
    if (!data?.main || data.vertices.length < 3) return;
    const polygonId = data.main.localId;
    const warns = analyzeClosedPolygonIssues(data.vertices);
    if (warns.length > 0 && typeof window !== "undefined") {
      const proceed = window.confirm(
        [
          "Antes de cerrar el polígono:",
          "",
          ...warns.map((w) => `• ${w}`),
          "",
          "¿Cerrar el polígono de todas formas?",
        ].join("\n"),
      );
      if (!proceed) return;
    }
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

  const openPoiDetail = useCallback((poi: LocalPOI) => {
    setSelectedPoi(poi);
    setPoiSheetOpen(true);
  }, []);

  const onPoiSheetOpenChange = useCallback((open: boolean) => {
    setPoiSheetOpen(open);
    if (!open) setSelectedPoi(null);
  }, []);

  const handleDeletePoi = useCallback(async (localId: string) => {
    await deletePOI(localId);
  }, []);

  const handleSavePoi = useCallback(
    async (
      localId: string,
      input: {
        label: string;
        note: string | undefined;
        photoFile: File | null;
      },
    ) => {
      if (!data?.project) return;
      if (input.photoFile) {
        await updatePOI(localId, {
          label: input.label,
          note: input.note,
          photoBlob: input.photoFile,
        });
      } else {
        await updatePOI(localId, { label: input.label, note: input.note });
      }
      if (input.photoFile) {
        try {
          if (
            !process.env.NEXT_PUBLIC_SUPABASE_URL ||
            !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ) {
            return;
          }
          const row = await getDb().pois.get(localId);
          const uploadBlob = row ? blobFromStored(row) : undefined;
          if (!uploadBlob) return;
          const client = createBrowserSupabaseClient();
          const path = `${data.project.localId}/pois/${localId}.${pathExtensionForImageBlob(uploadBlob)}`;
          const { publicUrl } = await uploadToProjectPhotosBucket(
            client,
            path,
            uploadBlob,
            uploadBlob.type || "image/jpeg",
          );
          await getDb().pois.update(localId, { photoUrl: publicUrl });
        } catch {
          /* opcional */
        }
      }
    },
    [data],
  );

  const selectedPoiForUi = useMemo(() => {
    if (!selectedPoi || !data?.pois) return null;
    const fresh = data.pois.find((p) => p.localId === selectedPoi.localId);
    return fresh ?? selectedPoi;
  }, [data, selectedPoi]);

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
      <FieldPermissionsIntro />
      <div className="fixed inset-x-0 top-14 bottom-16 z-10 flex flex-col">
        <MapCanvas
          className="min-h-0 w-full flex-1 basis-0"
          vertices={data.vertices}
          isClosed={data.main.isClosed}
          areaM2={data.main.areaM2 ?? null}
          subLayers={data.subLayers}
          selectedSubPolygonLocalId={selectedSubPolygonForUi}
          onSelectSubPolygonFromMap={setSelectedSubPolygonLocalId}
          pois={data.pois}
          selectedPoiLocalId={
            poiSheetOpen ? selectedPoiForUi?.localId ?? null : null
          }
          onPoiMarkerClick={openPoiDetail}
          showUserLocation
          initialCenter={emptyProjectUserCenter ?? undefined}
          initialZoom={emptyProjectUserCenter ? 16 : undefined}
          allowVertexDrag={allowVertexMapDrag}
          resolveVertexDragTarget={resolveVertexDragTarget}
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
          <div className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ProjectMapExportMenu projectLocalId={localId} />
            <Link
              href={`/projects/${data.project.localId}/report`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "shadow-md",
              )}
            >
              Reporte
            </Link>
            <Link
              href={`/projects/${data.project.localId}/gallery`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "shadow-md",
              )}
            >
              Galería
            </Link>
            <Link
              href={`/projects/${data.project.localId}/pois`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "shadow-md",
              )}
            >
              POIs
            </Link>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "shadow-md",
              )}
            >
              Lista
            </Link>
          </div>
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
        enableSubPolygonCapture={subAreasWorkflowEnabled}
      />

      <ProjectBottomPanel
        vertices={data.vertices}
        main={data.main}
        subLayers={data.subLayers}
        pois={data.pois}
        projectPhotos={data.projectPhotos}
        onCaptureClick={() => setCaptureSheetOpen(true)}
        onClosePolygon={() => void handleClosePolygon()}
        onVertexClick={openVertexDetail}
        closePolygonBusy={closePolygonBusy}
        subPolygonManager={
          <SubPolygonWorkflow
            projectLocalId={data.project.localId}
            subPolygons={data.subLayers.map((s) => s.polygon)}
            selectedSubPolygonLocalId={selectedSubPolygonForUi}
            onSelectSubPolygon={setSelectedSubPolygonLocalId}
            workflowEnabled={subAreasWorkflowEnabled}
            onWorkflowEnabledChange={setSubAreasWorkflowEnabled}
          />
        }
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

      <POIDetailSheet
        poi={selectedPoiForUi}
        open={poiSheetOpen}
        onOpenChange={onPoiSheetOpenChange}
        onDelete={handleDeletePoi}
        onSave={handleSavePoi}
      />
    </div>
  );
}

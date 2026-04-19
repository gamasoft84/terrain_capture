"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SubPolygonMapLayer } from "@/components/map/MapCanvas";
import { ReportConfig } from "@/components/report/ReportConfig";
import { ReportPdfMapHost } from "@/components/report/ReportPdfMapHost";
import {
  buildTerrainReportPngFilename,
  ReportPngExportHost,
  triggerDownloadTerrainReportPng,
  type TerrainReportPngInput,
} from "@/components/report/ReportPNG";
import {
  downloadTerrainReportPdf,
  type TerrainReportPdfInput,
} from "@/components/report/ReportPDF";
import { hydrateGalleryForPdf } from "@/lib/report/pdfHydrate";
import { collectProjectGallery } from "@/lib/gallery/collectProjectGallery";
import { listSubPolygonsByProject } from "@/lib/db/polygons";
import type { ReportGenerationPayload } from "@/lib/report/config";
import { getDb } from "@/lib/db/schema";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalVertex,
} from "@/lib/db/schema";
import { listPoisByProject } from "@/lib/db/pois";
import { listVerticesByPolygon } from "@/lib/db/vertices";
import { shareReport } from "@/lib/utils/share";
import { cn } from "@/lib/utils";

function buildReportShareText(
  project: LocalProject,
  payload: ReportGenerationPayload,
): string {
  const lines: string[] = [`Informe TerrainCapture — ${project.name}`];
  const client = payload.clientName.trim() || project.clientName?.trim();
  if (client) lines.push(`Cliente: ${client}`);
  lines.push(`Levantamiento: ${payload.surveyDate}`);
  const notes = payload.executiveNotes.trim();
  if (notes) lines.push(notes.slice(0, 400));
  return lines.join("\n");
}

type ReportPageData = {
  project: LocalProject;
  main: LocalPolygon | undefined;
  vertices: LocalVertex[];
  subLayers: SubPolygonMapLayer[];
  pois: LocalPOI[];
  previewContext: {
    mainAreaM2?: number | null;
    mainPerimeterM?: number | null;
    vertexCount: number;
    poiCount: number;
    galleryPhotoCount: number;
    subPolygonCount: number;
  };
};

export default function ProjectReportPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";

  const data = useLiveQuery(
    async (): Promise<
      | (ReportPageData & {
          galleryItems: Awaited<
            ReturnType<typeof collectProjectGallery>
          >;
        })
      | undefined
    > => {
      if (typeof window === "undefined" || !localId) return undefined;
      const db = getDb();
      const project = await db.projects.get(localId);
      if (!project) {
        return undefined;
      }
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
      const galleryItems = await collectProjectGallery(localId);
      return {
        project,
        main,
        vertices,
        subLayers,
        pois,
        galleryItems,
        previewContext: {
          mainAreaM2: main?.areaM2 ?? null,
          mainPerimeterM: main?.perimeterM ?? null,
          vertexCount: vertices.length,
          poiCount: pois.length,
          galleryPhotoCount: galleryItems.length,
          subPolygonCount: subs.length,
        },
      };
    },
    [localId],
  );

  const [mapCaptureSession, setMapCaptureSession] = useState(0);
  const mapCaptureResolverRef = useRef<
    ((dataUrl: string) => void) | null
  >(null);
  const [pngExport, setPngExport] = useState<{
    id: number;
    input: TerrainReportPngInput;
  } | null>(null);
  const pngResolverRef = useRef<
    ((blob: Blob | null) => void) | null
  >(null);

  const handleGeneratePdf = useCallback(
    async (payload: ReportGenerationPayload) => {
      if (!data?.project) return;
      try {
        let mapImageDataUrl: string | null | undefined;
        if (payload.sections.map) {
          mapImageDataUrl = await new Promise<string>((resolve) => {
            const t = window.setTimeout(() => resolve(""), 60_000);
            mapCaptureResolverRef.current = (url: string) => {
              window.clearTimeout(t);
              resolve(url);
            };
            setMapCaptureSession((s) => s + 1);
          });
        }

        const input: TerrainReportPdfInput = {
          payload,
          project: data.project,
          mainPolygon: data.main ?? null,
          mainVertices: data.vertices,
          subLayers: data.subLayers,
          pois: data.pois,
          galleryItems: data.galleryItems,
          mapImageDataUrl: mapImageDataUrl ?? null,
        };
        await downloadTerrainReportPdf(input);
      } finally {
        setMapCaptureSession(0);
        mapCaptureResolverRef.current = null;
      }
    },
    [data],
  );

  const obtainTerrainReportPngBlob = useCallback(
    async (
      payload: ReportGenerationPayload,
    ): Promise<Blob | null> => {
      if (!data?.project) return null;

      let mapImageDataUrl: string | null | undefined;
      if (payload.sections.map) {
        mapImageDataUrl = await new Promise<string>((resolve) => {
          const t = window.setTimeout(() => resolve(""), 60_000);
          mapCaptureResolverRef.current = (url: string) => {
            window.clearTimeout(t);
            resolve(url);
          };
          setMapCaptureSession((s) => s + 1);
        });
      }
      setMapCaptureSession(0);
      mapCaptureResolverRef.current = null;

      let galleryImages: { src: string | null }[] = [
        { src: null },
        { src: null },
        { src: null },
        { src: null },
      ];
      if (payload.sections.gallery && data.galleryItems.length > 0) {
        const hydrated = await hydrateGalleryForPdf(data.galleryItems);
        const picked = hydrated
          .filter((h) => h.src != null)
          .slice(0, 4)
          .map((h) => ({ src: h.src }));
        galleryImages = [...picked];
        while (galleryImages.length < 4) galleryImages.push({ src: null });
      }

      const input: TerrainReportPngInput = {
        payload,
        project: data.project,
        mainAreaM2: data.main?.areaM2 ?? null,
        mainPerimeterM: data.main?.perimeterM ?? null,
        vertexCount: data.vertices.length,
        mapImageDataUrl: mapImageDataUrl ?? null,
        galleryImages,
      };

      return await new Promise<Blob | null>((resolve) => {
        pngResolverRef.current = resolve;
        setPngExport({ id: Date.now(), input });
      });
    },
    [data],
  );

  const handleGeneratePng = useCallback(
    async (payload: ReportGenerationPayload) => {
      try {
        const blob = await obtainTerrainReportPngBlob(payload);
        if (
          blob != null &&
          blob.size > 0 &&
          data?.project != null
        ) {
          triggerDownloadTerrainReportPng(
            blob,
            buildTerrainReportPngFilename(data.project.name, new Date()),
          );
        }
      } finally {
        setMapCaptureSession(0);
        mapCaptureResolverRef.current = null;
        setPngExport(null);
        pngResolverRef.current = null;
      }
    },
    [data?.project, obtainTerrainReportPngBlob],
  );

  const handleShare = useCallback(
    async (payload: ReportGenerationPayload) => {
      try {
        const blob = await obtainTerrainReportPngBlob(payload);
        if (
          blob != null &&
          blob.size > 0 &&
          data?.project != null
        ) {
          await shareReport(
            blob,
            buildTerrainReportPngFilename(data.project.name, new Date()),
            buildReportShareText(data.project, payload),
          );
        }
      } finally {
        setMapCaptureSession(0);
        mapCaptureResolverRef.current = null;
        setPngExport(null);
        pngResolverRef.current = null;
      }
    },
    [data?.project, obtainTerrainReportPngBlob],
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
      {mapCaptureSession > 0 ? (
        <ReportPdfMapHost
          sessionId={mapCaptureSession}
          vertices={data.vertices}
          polygonIsClosed={data.main?.isClosed ?? false}
          subLayers={data.subLayers}
          pois={data.pois}
          onCaptured={(url) => {
            mapCaptureResolverRef.current?.(url);
          }}
        />
      ) : null}

      {pngExport ? (
        <ReportPngExportHost
          key={pngExport.id}
          sessionKey={pngExport.id}
          input={pngExport.input}
          onDone={(blob) => {
            pngResolverRef.current?.(blob);
            pngResolverRef.current = null;
            setPngExport(null);
          }}
        />
      ) : null}

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
        mapPreview={{
          vertices: data.vertices,
          polygonIsClosed: data.main?.isClosed ?? false,
          subLayers: data.subLayers,
          pois: data.pois,
        }}
        onGeneratePdf={handleGeneratePdf}
        onGeneratePng={handleGeneratePng}
        onShare={handleShare}
      />
    </div>
  );
}

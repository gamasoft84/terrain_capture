"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { POIDetailSheet } from "@/components/project/POIDetailSheet";
import { PoiCaptureSheet } from "@/components/project/PoiCaptureSheet";
import {
  blobFromStored,
  thumbnailOrPhotoBlob,
} from "@/lib/db/blobFromStored";
import { deletePOI, listPoisByProject, updatePOI } from "@/lib/db/pois";
import { getDb } from "@/lib/db/schema";
import type { LocalPOI, LocalProject } from "@/lib/db/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathExtensionForImageBlob,
  uploadToProjectPhotosBucket,
} from "@/lib/supabase/storage";

type PoisPageData = {
  project: LocalProject | undefined;
  pois: LocalPOI[];
};

function PoiListThumb({ poi }: { poi: LocalPOI }) {
  const blobUrl = useMemo(() => {
    const b = thumbnailOrPhotoBlob(poi);
    return b ? URL.createObjectURL(b) : null;
  }, [poi]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const src = poi.photoUrl ?? blobUrl;

  return (
    <div className="border-border bg-muted/30 relative aspect-square w-full overflow-hidden rounded-md border">
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
          Sin foto
        </div>
      )}
    </div>
  );
}

export default function ProjectPoisPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";

  const [captureOpen, setCaptureOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<LocalPOI | null>(null);

  const data = useLiveQuery(
    async (): Promise<PoisPageData | undefined> => {
      if (typeof window === "undefined" || !localId) return undefined;
      const db = getDb();
      const project = await db.projects.get(localId);
      const pois = await listPoisByProject(localId);
      return { project, pois };
    },
    [localId],
  );

  const openDetail = useCallback((poi: LocalPOI) => {
    setSelectedPoi(poi);
    setDetailOpen(true);
  }, []);

  const onDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) setSelectedPoi(null);
  }, []);

  const selectedPoiForUi = useMemo(() => {
    if (!selectedPoi || !data?.pois) return null;
    return data.pois.find((p) => p.localId === selectedPoi.localId) ?? selectedPoi;
  }, [data, selectedPoi]);

  const handleDeletePoi = useCallback(async (id: string) => {
    await deletePOI(id);
  }, []);

  const handleSavePoi = useCallback(
    async (
      poiLocalId: string,
      input: {
        label: string;
        note: string | undefined;
        photoFile: File | null;
      },
    ) => {
      if (!data?.project) return;
      if (input.photoFile) {
        await updatePOI(poiLocalId, {
          label: input.label,
          note: input.note,
          photoBlob: input.photoFile,
        });
      } else {
        await updatePOI(poiLocalId, { label: input.label, note: input.note });
      }
      if (input.photoFile) {
        try {
          if (
            !process.env.NEXT_PUBLIC_SUPABASE_URL ||
            !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ) {
            return;
          }
          const row = await getDb().pois.get(poiLocalId);
          const uploadBlob = row ? blobFromStored(row) : undefined;
          if (!uploadBlob) return;
          const client = createBrowserSupabaseClient();
          const path = `${data.project.localId}/pois/${poiLocalId}.${pathExtensionForImageBlob(uploadBlob)}`;
          const { publicUrl } = await uploadToProjectPhotosBucket(
            client,
            path,
            uploadBlob,
            uploadBlob.type || "image/jpeg",
          );
          await getDb().pois.update(poiLocalId, { photoUrl: publicUrl });
        } catch {
          /* opcional */
        }
      }
    },
    [data],
  );

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
          <CardDescription>Vuelve al inicio.</CardDescription>
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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            POIs
          </h1>
          <p className="text-muted-foreground text-sm">{data.project.name}</p>
        </div>
        <Link
          href={`/projects/${localId}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Mapa
        </Link>
      </div>

      <Button type="button" className="w-full" onClick={() => setCaptureOpen(true)}>
        Nuevo POI
      </Button>

      {data.pois.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          No hay puntos de interés. Crea uno con GPS y foto, o captura desde el
          mapa del proyecto.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.pois.map((poi) => (
            <li key={poi.localId}>
              <button
                type="button"
                className="border-border hover:border-primary/50 w-full rounded-lg border bg-card p-2 text-left shadow-sm transition-colors"
                onClick={() => openDetail(poi)}
              >
                <PoiListThumb poi={poi} />
                <p className="mt-2 truncate text-sm font-medium">{poi.label}</p>
                {poi.note ? (
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {poi.note}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <PoiCaptureSheet
        projectLocalId={data.project.localId}
        open={captureOpen}
        onOpenChange={setCaptureOpen}
      />

      <POIDetailSheet
        poi={selectedPoiForUi}
        open={detailOpen}
        onOpenChange={onDetailOpenChange}
        onDelete={handleDeletePoi}
        onSave={handleSavePoi}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import { ProjectGalleryAddSheet } from "@/components/gallery/ProjectGalleryAddSheet";
import { PoiCaptureSheet } from "@/components/project/PoiCaptureSheet";
import {
  blobFromStored,
  thumbnailOrPhotoBlob,
} from "@/lib/db/blobFromStored";
import { collectProjectGallery } from "@/lib/gallery/collectProjectGallery";
import type { ProjectGalleryItem } from "@/lib/gallery/collectProjectGallery";
import { retryGalleryItemPhotoSync } from "@/lib/db/sync/conflictResolution";
import { getDb } from "@/lib/db/schema";
import type { LocalProject } from "@/lib/db/schema";

type GalleryFilter = "all" | "vertex" | "poi" | "extra";

function GalleryThumb({
  item,
  onOpen,
}: {
  item: ProjectGalleryItem;
  onOpen: () => void;
}) {
  const blobUrl = useMemo(() => {
    const b = thumbnailOrPhotoBlob(item);
    return b ? URL.createObjectURL(b) : null;
  }, [item]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const src = item.photoUrl ?? blobUrl;

  return (
    <button
      type="button"
      className="border-border hover:border-primary/50 w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors"
      onClick={onOpen}
    >
      <div className="bg-muted/40 aspect-square w-full">
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            —
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="text-muted-foreground line-clamp-2 text-[10px] leading-tight">
          {item.originLabel}
        </p>
        {item.caption?.trim() ? (
          <p className="text-muted-foreground line-clamp-2 text-[10px]">
            {item.caption.trim()}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export default function ProjectGalleryPage() {
  const params = useParams();
  const localId = typeof params.localId === "string" ? params.localId : "";

  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [poiCaptureOpen, setPoiCaptureOpen] = useState(false);
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState<string | null>(null);
  const [retryPhotoBusy, setRetryPhotoBusy] = useState(false);

  const data = useLiveQuery(
    async (): Promise<
      | { project: LocalProject | undefined; items: ProjectGalleryItem[] }
      | undefined
    > => {
      if (typeof window === "undefined" || !localId) return undefined;
      const project = await getDb().projects.get(localId);
      const items = await collectProjectGallery(localId);
      return { project, items };
    },
    [localId],
  );

  const filtered = useMemo(() => {
    const items = data?.items;
    if (!items) return [];
    if (filter === "all") return items;
    return items.filter((i) => i.origin === filter);
  }, [data, filter]);

  const lightboxIndex = useMemo(() => {
    if (!lightboxKey) return -1;
    return filtered.findIndex((i) => i.key === lightboxKey);
  }, [lightboxKey, filtered]);

  const lightboxItem =
    lightboxIndex >= 0 ? filtered[lightboxIndex]! : null;

  useEffect(() => {
    if (!lightboxKey) return;
    if (!filtered.some((i) => i.key === lightboxKey)) {
      setLightboxKey(null);
      setLightboxBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [lightboxKey, filtered]);

  useEffect(() => {
    if (!lightboxItem) {
      setLightboxBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setLightboxBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (lightboxItem.photoUrl?.trim()) return null;
      const b = blobFromStored(lightboxItem);
      return b ? URL.createObjectURL(b) : null;
    });
  }, [lightboxItem?.key, lightboxItem?.photoUrl]);

  const openLightbox = useCallback((item: ProjectGalleryItem) => {
    const idx = filtered.findIndex((i) => i.key === item.key);
    if (idx < 0) return;
    setLightboxKey(item.key);
  }, [filtered]);

  const closeLightbox = useCallback(() => {
    setLightboxKey(null);
    setLightboxBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const goLightboxPrev = useCallback(() => {
    setLightboxKey((k) => {
      if (!k) return null;
      const i = filtered.findIndex((x) => x.key === k);
      if (i <= 0) return k;
      return filtered[i - 1]!.key;
    });
  }, [filtered]);

  const goLightboxNext = useCallback(() => {
    setLightboxKey((k) => {
      if (!k) return null;
      const i = filtered.findIndex((x) => x.key === k);
      if (i < 0 || i >= filtered.length - 1) return k;
      return filtered[i + 1]!.key;
    });
  }, [filtered]);

  const lightboxSrc =
    lightboxItem?.photoUrl ?? lightboxBlobUrl ?? "";

  const lightboxMeta = useMemo(() => {
    if (!lightboxItem) return [];
    const lines: string[] = [];
    lines.push(
      `Fecha: ${format(lightboxItem.capturedAt, "PPp", { locale: es })}`,
    );
    lines.push(`Origen: ${lightboxItem.originLabel}`);
    if (
      lightboxItem.latitude != null &&
      lightboxItem.longitude != null &&
      Number.isFinite(lightboxItem.latitude) &&
      Number.isFinite(lightboxItem.longitude)
    ) {
      lines.push(
        `Ubicación: ${lightboxItem.latitude.toFixed(5)}, ${lightboxItem.longitude.toFixed(5)}`,
      );
    } else {
      lines.push("Ubicación: —");
    }
    if (lightboxItem.caption?.trim()) {
      lines.push(`Nota / descripción: ${lightboxItem.caption.trim()}`);
    }
    return lines;
  }, [lightboxItem]);

  const filterButtons: { id: GalleryFilter; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "vertex", label: "Vértices" },
    { id: "poi", label: "POIs" },
    { id: "extra", label: "Adicionales" },
  ];

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            Galería
          </h1>
          <p className="text-muted-foreground text-sm">{data.project.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${localId}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Mapa
          </Link>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            Añadir
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterButtons.map((b) => (
          <Button
            key={b.id}
            type="button"
            size="sm"
            variant={filter === b.id ? "default" : "outline"}
            onClick={() => setFilter(b.id)}
          >
            {b.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          {data.items.length === 0
            ? "No hay fotos en este proyecto todavía."
            : "Nada en este filtro."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((item) => (
            <li key={item.key}>
              <GalleryThumb item={item} onOpen={() => openLightbox(item)} />
              <p className="text-muted-foreground mt-1 px-0.5 text-[10px]">
                {format(item.capturedAt, "d MMM yyyy HH:mm", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ProjectGalleryAddSheet
        projectLocalId={data.project.localId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onRequestPoiCapture={() => setPoiCaptureOpen(true)}
      />

      <PoiCaptureSheet
        projectLocalId={data.project.localId}
        open={poiCaptureOpen}
        onOpenChange={setPoiCaptureOpen}
      />

      {lightboxItem && lightboxSrc ? (
        <GalleryLightbox
          open
          imageSrc={lightboxSrc}
          title={lightboxItem.originLabel}
          metaLines={lightboxMeta}
          onClose={closeLightbox}
          navigation={
            filtered.length > 1
              ? {
                  positionLabel: `${lightboxIndex + 1} / ${filtered.length}`,
                  hasPrevious: lightboxIndex > 0,
                  hasNext: lightboxIndex < filtered.length - 1,
                  onPrevious: goLightboxPrev,
                  onNext: goLightboxNext,
                }
              : undefined
          }
          photoUploadError={
            lightboxItem.syncStatus === "error" &&
            lightboxItem.syncErrorReason === "photo_upload"
          }
          retryPhotoBusy={retryPhotoBusy}
          onRetryPhotoUpload={() => {
            void (async () => {
              setRetryPhotoBusy(true);
              try {
                await retryGalleryItemPhotoSync(
                  lightboxItem.origin,
                  lightboxItem.entityLocalId,
                );
              } finally {
                setRetryPhotoBusy(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}

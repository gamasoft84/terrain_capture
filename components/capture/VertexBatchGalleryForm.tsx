"use client";

import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathExtensionForImageBlob,
  uploadProjectVertexPhoto,
} from "@/lib/supabase/storage";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { updatePolygon } from "@/lib/db/polygons";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { createVertex, listVerticesByPolygon, nextOrderIndexForPolygon } from "@/lib/db/vertices";
import { extractGpsFromImageFile, type ExifGpsPosition } from "@/lib/geo/exifGps";

type BatchItem = {
  id: string;
  file: File;
  previewUrl: string;
  exifGps: ExifGpsPosition | null;
};

const DND_MIME = "application/x-terraincapture-batch-index";

function reorderItems<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed!);
  return next;
}

async function uploadVertexPhotoInBackground(
  projectLocalId: string,
  vertexLocalId: string,
  blob: Blob,
): Promise<void> {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    const client = createBrowserSupabaseClient();
    const ext = pathExtensionForImageBlob(blob);
    const path = `${projectLocalId}/vertices/${vertexLocalId}.${ext}`;
    const { publicUrl } = await uploadProjectVertexPhoto(
      client,
      path,
      blob,
      blob.type || "image/jpeg",
    );
    await getDb().vertices.update(vertexLocalId, { photoUrl: publicUrl });
  } catch {
    /* Fase 1 */
  }
}

export interface VertexBatchGalleryFormProps {
  polygonLocalId: string;
  projectLocalId: string;
  polygonIsClosed: boolean;
  onCancel: () => void;
  onSaved: () => void;
}

export function VertexBatchGalleryForm({
  polygonLocalId,
  projectLocalId,
  polygonIsClosed,
  onCancel,
  onSaved,
}: VertexBatchGalleryFormProps) {
  const galleryInputId = useId();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const itemsRef = useRef<BatchItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.previewUrl);
      }
    };
  }, []);

  const revokeItem = useCallback((it: BatchItem) => {
    URL.revokeObjectURL(it.previewUrl);
  }, []);

  const handleGalleryChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      // Safari/iOS: vaciar `value` antes de copiar los File deja el FileList vacío.
      const files = input.files ? Array.from(input.files) : [];
      input.value = "";
      if (files.length === 0) return;
      setError(null);
      setReading(true);
      try {
        const newItems: BatchItem[] = [];
        for (const file of files) {
          const id = nanoid();
          const previewUrl = URL.createObjectURL(file);
          let exifGps: ExifGpsPosition | null = null;
          try {
            exifGps = await extractGpsFromImageFile(file);
          } catch {
            exifGps = null;
          }
          newItems.push({ id, file, previewUrl, exifGps });
        }
        setItems((prev) => [...prev, ...newItems]);
      } catch {
        setError("No se pudieron leer algunas fotos. Inténtalo de nuevo.");
      } finally {
        setReading(false);
      }
    },
    [],
  );

  const moveLeft = useCallback((index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      const t = next[index - 1]!;
      next[index - 1] = next[index]!;
      next[index] = t;
      return next;
    });
  }, []);

  const moveRight = useCallback((index: number) => {
    setItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const t = next[index + 1]!;
      next[index + 1] = next[index]!;
      next[index] = t;
      return next;
    });
  }, []);

  const removeAt = useCallback((index: number) => {
    setItems((prev) => {
      const it = prev[index];
      if (it) revokeItem(it);
      return prev.filter((_, i) => i !== index);
    });
  }, [revokeItem]);

  const clearDragUi = useCallback(() => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (submitting) return;
      const s = String(index);
      e.dataTransfer.setData(DND_MIME, s);
      e.dataTransfer.setData("text/plain", s);
      e.dataTransfer.effectAllowed = "move";
      setDragFromIndex(index);
      setDragOverIndex(null);
    },
    [submitting],
  );

  const handleDragEnd = useCallback(() => {
    clearDragUi();
  }, [clearDragUi]);

  const handleDragOverCard = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragFromIndex != null && dragFromIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragFromIndex],
  );

  const handleDragLeaveCard = useCallback(
    (e: React.DragEvent, index: number) => {
      const cur = e.currentTarget;
      const rel = e.relatedTarget as Node | null;
      if (rel && cur.contains(rel)) return;
      setDragOverIndex((v) => (v === index ? null : v));
    },
    [],
  );

  const handleDropOnCard = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const raw =
        e.dataTransfer.getData(DND_MIME) ||
        e.dataTransfer.getData("text/plain");
      const fromIndex = parseInt(raw, 10);
      clearDragUi();
      if (!Number.isFinite(fromIndex) || fromIndex === dropIndex) return;
      setItems((prev) => reorderItems(prev, fromIndex, dropIndex));
    },
    [clearDragUi],
  );

  const handleSave = useCallback(async () => {
    setError(null);
    if (items.length === 0) {
      setError("Elige al menos una foto de la galería.");
      return;
    }
    const missing = items.filter((i) => !i.exifGps);
    if (missing.length > 0) {
      setError(
        "Todas las fotos deben incluir GPS en EXIF. Quita las que marcan «Sin GPS» o elige otras.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const initialCount = (await listVerticesByPolygon(polygonLocalId))
        .length;
      const startOrder = await nextOrderIndexForPolygon(polygonLocalId);

      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        const g = it.exifGps!;
        const vertexLocalId = await createVertex({
          polygonLocalId,
          orderIndex: startOrder + i,
          latitude: g.latitude,
          longitude: g.longitude,
          captureMethod: "photo_exif",
          photoBlob: it.file,
        });

        const row = await getDb().vertices.get(vertexLocalId);
        const uploadBlob = row ? blobFromStored(row) : undefined;
        void uploadVertexPhotoInBackground(
          projectLocalId,
          vertexLocalId,
          uploadBlob ?? it.file,
        );
      }

      const newTotal = initialCount + items.length;
      const shouldAutoClose = !polygonIsClosed && newTotal > 3;
      if (shouldAutoClose) {
        await updatePolygon(polygonLocalId, { isClosed: true });
      }
      await refreshPolygonMetricsFromVertices(
        polygonLocalId,
        shouldAutoClose || polygonIsClosed,
      );

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(25);
      }

      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron guardar los vértices.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [items, onSaved, polygonIsClosed, polygonLocalId, projectLocalId]);

  const allHaveGps = items.length > 0 && items.every((i) => i.exifGps);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        Elige varias fotos con ubicación en EXIF. La primera a la izquierda será
        P1, la siguiente P2, etc. Puedes reordenar con las flechas o arrastrando
        desde el icono ⋮⋮ (en iPhone suele ir mejor con las flechas). Si al
        guardar hay más de tres vértices en total en este polígono, se cerrará
        automáticamente.
      </p>

      <input
        id={galleryInputId}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        multiple
        className="sr-only"
        disabled={reading || submitting}
        onChange={(e) => void handleGalleryChange(e)}
      />
      {/* label+htmlFor: en iOS abre Fotos de forma más fiable que programatic .click() */}
      <label
        htmlFor={galleryInputId}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "flex min-h-12 w-full cursor-pointer items-center justify-center px-3 text-center",
          (reading || submitting) && "pointer-events-none opacity-50",
        )}
      >
        {reading
          ? "Leyendo fotos…"
          : items.length
            ? "Añadir más fotos"
            : "Elegir fotos de la galería"}
      </label>

      {items.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
            Orden (izquierda = P1)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {items.map((it, idx) => (
              <div
                key={it.id}
                onDragOver={(e) => handleDragOverCard(e, idx)}
                onDragLeave={(e) => handleDragLeaveCard(e, idx)}
                onDrop={(e) => handleDropOnCard(e, idx)}
                className={cn(
                  "border-border flex w-[5.75rem] shrink-0 flex-col gap-1 rounded-lg border p-1.5 transition-[opacity,box-shadow]",
                  dragFromIndex === idx && "opacity-50",
                  dragOverIndex === idx &&
                    dragFromIndex !== idx &&
                    "ring-primary ring-2 ring-offset-1 ring-offset-background",
                )}
              >
                <span className="bg-muted text-center font-mono text-[10px] font-bold">
                  P{idx + 1}
                </span>
                <div
                  draggable={!submitting && items.length > 1}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground flex cursor-grab touch-none items-center justify-center rounded-md border py-0.5 active:cursor-grabbing",
                    (submitting || items.length <= 1) &&
                      "cursor-not-allowed opacity-40",
                  )}
                  aria-label="Arrastrar para reordenar"
                  title="Arrastrar para reordenar"
                >
                  <GripVertical className="size-4" aria-hidden />
                </div>
                <div className="border-border aspect-square w-full overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
                {it.exifGps ? (
                  <p className="text-muted-foreground line-clamp-2 text-center font-mono text-[9px] leading-tight">
                    {it.exifGps.latitude.toFixed(4)}
                    <br />
                    {it.exifGps.longitude.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-destructive text-center text-[9px] font-medium">
                    Sin GPS
                  </p>
                )}
                <div className="flex justify-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={idx === 0 || submitting}
                    aria-label="Mover a la izquierda"
                    onClick={() => moveLeft(idx)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={idx >= items.length - 1 || submitting}
                    aria-label="Mover a la derecha"
                    onClick={() => moveRight(idx)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive size-8 shrink-0"
                    disabled={submitting}
                    aria-label="Quitar foto"
                    onClick={() => removeAt(idx)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={submitting}
          onClick={onCancel}
        >
          Volver
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={submitting || !allHaveGps || items.length === 0}
          onClick={() => void handleSave()}
        >
          {submitting ? "Guardando…" : `Guardar ${items.length} vértice(s)`}
        </Button>
      </div>
    </div>
  );
}

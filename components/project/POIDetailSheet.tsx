"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { blobFromStored } from "@/lib/db/blobFromStored";
import type { LocalPOI } from "@/lib/db/schema";
import { retryPoiPhotoUploadSync } from "@/lib/db/sync/conflictResolution";

export interface POIDetailSheetProps {
  poi: LocalPOI | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (localId: string) => Promise<void>;
  onSave: (
    localId: string,
    input: {
      label: string;
      note: string | undefined;
      photoFile: File | null;
    },
  ) => Promise<void>;
}

function POIDetailSheetBody({
  poi,
  onOpenChange,
  onDelete,
  onSave,
}: {
  poi: LocalPOI;
  onOpenChange: (open: boolean) => void;
  onDelete: (localId: string) => Promise<void>;
  onSave: POIDetailSheetProps["onSave"];
}) {
  const labelId = useId();
  const noteId = useId();
  const fileId = useId();
  const [label, setLabel] = useState(poi.label);
  const [note, setNote] = useState(poi.note ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"delete" | "save" | "retryPhoto" | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blobPreview = useMemo(() => {
    const b = blobFromStored(poi);
    if (!b) return null;
    return URL.createObjectURL(b);
  }, [poi]);

  const previewFromNew = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  useEffect(() => {
    return () => {
      if (blobPreview) URL.revokeObjectURL(blobPreview);
    };
  }, [blobPreview]);

  useEffect(() => {
    return () => {
      if (previewFromNew) URL.revokeObjectURL(previewFromNew);
    };
  }, [previewFromNew]);

  const imageSrc = previewFromNew ?? poi.photoUrl ?? blobPreview;

  return (
    <SheetContent
      side="bottom"
      className="max-h-[min(88dvh,640px)] gap-0 overflow-y-auto rounded-t-xl p-0"
      showCloseButton
    >
      <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
        <SheetTitle>{poi.label}</SheetTitle>
        <SheetDescription className="text-left">
          Punto de interés · estimaciones GPS
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 py-4">
        {poi.syncStatus === "error" &&
        poi.syncErrorReason === "photo_upload" ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            <p className="font-medium">No se pudo subir la foto</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Tras varios intentos la subida al almacenamiento falló (red,
              espacio del bucket en Supabase o políticas). Podés reintentar con
              mejor señal; si persiste, revisa Storage y cuotas del proyecto.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={busy != null}
              onClick={() => {
                void (async () => {
                  setBusy("retryPhoto");
                  try {
                    await retryPoiPhotoUploadSync(poi.localId);
                  } finally {
                    setBusy(null);
                  }
                })();
              }}
            >
              {busy === "retryPhoto" ? "Encolando…" : "Reintentar subida"}
            </Button>
          </div>
        ) : null}

        {imageSrc ? (
          <div className="border-border relative aspect-video w-full max-h-52 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="" className="size-full object-cover" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Sin foto</p>
        )}

        <div className="space-y-2">
          <Label htmlFor={fileId}>Cambiar foto (opcional)</Label>
          <input
            ref={fileInputRef}
            id={fileId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPhotoFile(f ?? null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            {photoFile ? "Otra foto" : "Elegir nueva foto"}
          </Button>
        </div>

        <dl className="font-mono text-xs leading-relaxed sm:text-sm">
          <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1">
            <dt className="text-muted-foreground">Lat / Lng</dt>
            <dd>
              {poi.latitude.toFixed(6)}, {poi.longitude.toFixed(6)}
            </dd>
            <dt className="text-muted-foreground">Precisión</dt>
            <dd>
              {poi.gpsAccuracyM != null
                ? `±${poi.gpsAccuracyM.toFixed(1)} m`
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor={labelId}>Etiqueta</Label>
          <Input
            id={labelId}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={noteId}>Nota</Label>
          <Textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Nota…"
          />
        </div>
      </div>

      <SheetFooter className="border-border flex-col gap-2 border-t px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          className="w-full sm:w-auto"
          disabled={busy != null}
          onClick={() => {
            void (async () => {
              setBusy("delete");
              try {
                await onDelete(poi.localId);
                onOpenChange(false);
              } finally {
                setBusy(null);
              }
            })();
          }}
        >
          {busy === "delete" ? "Eliminando…" : "Eliminar POI"}
        </Button>
        <Button
          type="button"
          className="w-full sm:ml-auto sm:w-auto"
          disabled={busy != null}
          onClick={() => {
            void (async () => {
              const trimmedLabel = label.trim();
              if (!trimmedLabel) return;
              setBusy("save");
              try {
                const trimmedNote = note.trim();
                await onSave(poi.localId, {
                  label: trimmedLabel,
                  note: trimmedNote.length > 0 ? trimmedNote : undefined,
                  photoFile,
                });
                onOpenChange(false);
              } finally {
                setBusy(null);
              }
            })();
          }}
        >
          {busy === "save" ? "Guardando…" : "Guardar cambios"}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}

export function POIDetailSheet({
  poi,
  open,
  onOpenChange,
  onDelete,
  onSave,
}: POIDetailSheetProps) {
  return (
    <Sheet open={Boolean(poi) && open} onOpenChange={onOpenChange}>
      {poi ? (
        <POIDetailSheetBody
          key={poi.localId}
          poi={poi}
          onOpenChange={onOpenChange}
          onDelete={onDelete}
          onSave={onSave}
        />
      ) : null}
    </Sheet>
  );
}

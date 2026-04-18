"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { LocalVertex } from "@/lib/db/schema";

export interface VertexDetailSheetProps {
  vertex: LocalVertex | null;
  /** 1-based index for label P1, P2… */
  displayIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (localId: string) => Promise<void>;
  onSaveNote: (localId: string, note: string | undefined) => Promise<void>;
}

export function VertexDetailSheet({
  vertex,
  displayIndex,
  open,
  onOpenChange,
  onDelete,
  onSaveNote,
}: VertexDetailSheetProps) {
  const [note, setNote] = useState(() => vertex?.note ?? "");
  const [busy, setBusy] = useState<"delete" | "save" | null>(null);

  const photoBlob = vertex?.photoBlob;
  const blobPreview = useMemo(() => {
    if (!photoBlob) return null;
    return URL.createObjectURL(photoBlob);
  }, [photoBlob]);

  useEffect(() => {
    return () => {
      if (blobPreview) URL.revokeObjectURL(blobPreview);
    };
  }, [blobPreview]);

  const imageSrc = vertex?.photoUrl ?? blobPreview;

  if (!vertex) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(88dvh,640px)] gap-0 overflow-y-auto rounded-t-xl p-0"
        showCloseButton
      >
        <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
          <SheetTitle>P{displayIndex}</SheetTitle>
          <SheetDescription className="text-left">
            Vértice del polígono principal · estimaciones GPS
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 py-4">
          {imageSrc ? (
            <div className="border-border relative aspect-video w-full max-h-52 overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={`Foto vértice P${displayIndex}`}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin foto</p>
          )}

          <dl className="font-mono text-xs leading-relaxed sm:text-sm">
            <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1">
              <dt className="text-muted-foreground">Lat / Lng</dt>
              <dd>
                {vertex.latitude.toFixed(6)}, {vertex.longitude.toFixed(6)}
              </dd>
              <dt className="text-muted-foreground">Precisión</dt>
              <dd>
                {vertex.gpsAccuracyM != null
                  ? `±${vertex.gpsAccuracyM.toFixed(1)} m`
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Método</dt>
              <dd className="capitalize">
                {vertex.captureMethod.replaceAll("_", " ")}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="vertex-note">Nota</Label>
            <Textarea
              id="vertex-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Editar nota…"
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
                  await onDelete(vertex.localId);
                  onOpenChange(false);
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            {busy === "delete" ? "Eliminando…" : "Eliminar vértice"}
          </Button>
          <Button
            type="button"
            className="w-full sm:ml-auto sm:w-auto"
            disabled={busy != null}
            onClick={() => {
              void (async () => {
                setBusy("save");
                try {
                  const trimmed = note.trim();
                  await onSaveNote(
                    vertex.localId,
                    trimmed.length > 0 ? trimmed : undefined,
                  );
                  onOpenChange(false);
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            {busy === "save" ? "Guardando…" : "Guardar nota"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uploadToProjectPhotosBucket } from "@/lib/supabase/storage";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { createPOI } from "@/lib/db/pois";
import {
  accuracyLevelFromMeters,
  type GPSReading,
} from "@/lib/hooks/useGeolocation";

function accuracyColor(
  level: ReturnType<typeof accuracyLevelFromMeters>,
): string {
  switch (level) {
    case "excellent":
      return "var(--gps-excellent)";
    case "good":
      return "var(--gps-good)";
    case "fair":
      return "var(--gps-fair)";
    case "poor":
      return "var(--gps-poor)";
    default:
      return "var(--muted-foreground)";
  }
}

async function uploadPoiPhotoInBackground(
  projectLocalId: string,
  poiLocalId: string,
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
    const path = `${projectLocalId}/pois/${poiLocalId}.jpg`;
    const { publicUrl } = await uploadToProjectPhotosBucket(
      client,
      path,
      blob,
      blob.type || "image/jpeg",
    );
    await getDb().pois.update(poiLocalId, { photoUrl: publicUrl });
  } catch {
    /* Fase 1–2: no bloquear captura */
  }
}

export interface POIFormProps {
  gpsReading: GPSReading;
  projectLocalId: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function POIForm({
  gpsReading,
  projectLocalId,
  onCancel,
  onSaved,
}: POIFormProps) {
  const labelId = useId();
  const noteId = useId();
  const fileId = useId();
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setError(null);
  }, []);

  const level = accuracyLevelFromMeters(gpsReading.accuracy);

  async function handleSave() {
    setError(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setError("La etiqueta del punto es obligatoria.");
      return;
    }
    if (!file) {
      setError("La foto del punto es obligatoria.");
      return;
    }
    setSubmitting(true);
    try {
      const poiLocalId = await createPOI({
        projectLocalId,
        label: trimmed,
        latitude: gpsReading.latitude,
        longitude: gpsReading.longitude,
        gpsAccuracyM: gpsReading.accuracy,
        note: note.trim() || undefined,
        photoBlob: file,
      });

      const row = await getDb().pois.get(poiLocalId);
      const uploadBlob = row ? blobFromStored(row) : undefined;
      void uploadPoiPhotoInBackground(
        projectLocalId,
        poiLocalId,
        uploadBlob ?? file,
      );

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          Punto de interés — misma posición GPS que elegiste arriba.
        </p>
        <div className="font-mono text-sm leading-relaxed">
          <div>
            <span className="text-muted-foreground">Lat </span>
            {gpsReading.latitude.toFixed(6)}
          </div>
          <div>
            <span className="text-muted-foreground">Lng </span>
            {gpsReading.longitude.toFixed(6)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">Precisión</span>
            <span
              className="font-semibold"
              style={{ color: accuracyColor(level) }}
            >
              ±{gpsReading.accuracy.toFixed(1)} m
            </span>
            <span className="text-muted-foreground text-xs capitalize">
              ({level})
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={labelId}>Etiqueta</Label>
        <Input
          id={labelId}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Pozo, árbol, cisterna…"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={fileId}>Foto</Label>
        <input
          ref={fileInputRef}
          id={fileId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onPickFile}
        >
          {file ? "Cambiar foto" : "Tomar o elegir foto"}
        </Button>
        {previewUrl ? (
          <div className="border-border aspect-video max-h-48 w-full overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Vista previa POI"
              className="size-full object-cover"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={noteId}>Nota (opcional)</Label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Detalle visible en reporte"
        />
      </div>

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
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={submitting}
          onClick={() => void handleSave()}
        >
          {submitting ? "Guardando…" : "Guardar POI"}
        </Button>
      </div>
    </div>
  );
}

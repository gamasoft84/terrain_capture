"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uploadProjectVertexPhoto } from "@/lib/supabase/storage";
import { getDb } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { createVertex, nextOrderIndexForPolygon } from "@/lib/db/vertices";
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
    const path = `${projectLocalId}/vertices/${vertexLocalId}.jpg`;
    const { publicUrl } = await uploadProjectVertexPhoto(
      client,
      path,
      blob,
      blob.type || "image/jpeg",
    );
    await getDb().vertices.update(vertexLocalId, { photoUrl: publicUrl });
  } catch {
    // Fase 1: no bloquear captura si falla red o Storage
  }
}

export interface VertexFormProps {
  gpsReading: GPSReading;
  captureMethod: "gps_single" | "gps_averaged";
  polygonLocalId: string;
  projectLocalId: string;
  polygonIsClosed: boolean;
  onCancel: () => void;
  onSaved: () => void;
}

export function VertexForm({
  gpsReading,
  captureMethod,
  polygonLocalId,
  projectLocalId,
  polygonIsClosed,
  onCancel,
  onSaved,
}: VertexFormProps) {
  const noteId = useId();
  const fileId = useId();
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
    if (!file) {
      setError("La foto del vértice es obligatoria.");
      return;
    }
    setSubmitting(true);
    try {
      const orderIndex = await nextOrderIndexForPolygon(polygonLocalId);
      const vertexLocalId = await createVertex({
        polygonLocalId,
        orderIndex,
        latitude: gpsReading.latitude,
        longitude: gpsReading.longitude,
        gpsAccuracyM: gpsReading.accuracy,
        altitudeM: gpsReading.altitude ?? undefined,
        captureMethod,
        photoBlob: file,
        note: note.trim() || undefined,
      });

      await refreshPolygonMetricsFromVertices(
        polygonLocalId,
        polygonIsClosed,
      );

      void uploadVertexPhotoInBackground(projectLocalId, vertexLocalId, file);

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
          Coordenadas (estimación GPS, no replanteo geodésico).
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
        <Label htmlFor={fileId}>Foto del vértice</Label>
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
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL local */}
            <img
              src={previewUrl}
              alt="Vista previa vértice"
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
          placeholder="Terreno, referencia, etc."
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
          {submitting ? "Guardando…" : "Guardar vértice"}
        </Button>
      </div>
    </div>
  );
}

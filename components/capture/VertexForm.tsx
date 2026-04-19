"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathExtensionForImageBlob,
  uploadProjectVertexPhoto,
} from "@/lib/supabase/storage";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { refreshPolygonMetricsFromVertices } from "@/lib/db/refreshPolygonMetrics";
import { createVertex, nextOrderIndexForPolygon } from "@/lib/db/vertices";
import { extractGpsFromImageFile } from "@/lib/geo/exifGps";
import { PhotoSourceInputs } from "@/components/capture/PhotoSourceInputs";
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
  const photoGroupLabelId = useId();
  const cameraInputId = useId();
  const galleryInputId = useId();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [exifGps, setExifGps] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [exifBusy, setExifBusy] = useState(false);
  const [preferExif, setPreferExif] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileSelected = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setExifBusy(true);
    try {
      const g = await extractGpsFromImageFile(f);
      setExifGps(g);
      setPreferExif(Boolean(g));
    } finally {
      setExifBusy(false);
    }
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
      const useExif = Boolean(exifGps && preferExif);
      const orderIndex = await nextOrderIndexForPolygon(polygonLocalId);
      const vertexLocalId = await createVertex({
        polygonLocalId,
        orderIndex,
        latitude: useExif ? exifGps!.latitude : gpsReading.latitude,
        longitude: useExif ? exifGps!.longitude : gpsReading.longitude,
        gpsAccuracyM: useExif ? undefined : gpsReading.accuracy,
        altitudeM: useExif ? undefined : (gpsReading.altitude ?? undefined),
        captureMethod: useExif ? "photo_exif" : captureMethod,
        photoBlob: file,
        note: note.trim() || undefined,
      });

      await refreshPolygonMetricsFromVertices(
        polygonLocalId,
        polygonIsClosed,
      );

      const row = await getDb().vertices.get(vertexLocalId);
      const uploadBlob = row ? blobFromStored(row) : undefined;
      void uploadVertexPhotoInBackground(
        projectLocalId,
        vertexLocalId,
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
        <p id={photoGroupLabelId} className="text-sm leading-none font-medium">
          Foto del vértice
        </p>
        <PhotoSourceInputs
          cameraInputId={cameraInputId}
          galleryInputId={galleryInputId}
          labelledBy={photoGroupLabelId}
          hasFile={Boolean(file)}
          disabled={submitting}
          onFileSelected={(f) => void onFileSelected(f)}
        />
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
        {file && exifBusy ? (
          <p className="text-muted-foreground text-xs">
            Leyendo ubicación en la foto…
          </p>
        ) : null}
        {file && !exifBusy && exifGps ? (
          <div className="border-border space-y-2 rounded-md border p-3 text-xs">
            <p className="text-muted-foreground">Ubicación en el archivo (EXIF)</p>
            <p className="font-mono text-sm">
              <span className="text-muted-foreground">Lat </span>
              {exifGps.latitude.toFixed(6)}
              <br />
              <span className="text-muted-foreground">Lng </span>
              {exifGps.longitude.toFixed(6)}
            </p>
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Fuente de coordenadas al guardar</legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="vertex-coord-src"
                  className="accent-primary"
                  checked={preferExif}
                  onChange={() => setPreferExif(true)}
                />
                Guardar con ubicación EXIF
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="vertex-coord-src"
                  className="accent-primary"
                  checked={!preferExif}
                  onChange={() => setPreferExif(false)}
                />
                Guardar con GPS en vivo (arriba)
              </label>
            </fieldset>
          </div>
        ) : null}
        {file && !exifBusy && !exifGps ? (
          <p className="text-muted-foreground text-xs">
            Esta imagen no incluye coordenadas GPS en EXIF; se usará el GPS en
            vivo.
          </p>
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

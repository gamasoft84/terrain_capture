"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoSourceInputs } from "@/components/capture/PhotoSourceInputs";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uploadToProjectPhotosBucket } from "@/lib/supabase/storage";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { createProjectPhoto } from "@/lib/db/projectPhotos";
import { extractGpsFromImageFile } from "@/lib/geo/exifGps";
import type { GPSReading } from "@/lib/hooks/useGeolocation";

async function uploadGalleryPhotoInBackground(
  projectLocalId: string,
  photoLocalId: string,
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
    const path = `${projectLocalId}/gallery/${photoLocalId}.jpg`;
    const { publicUrl } = await uploadToProjectPhotosBucket(
      client,
      path,
      blob,
      blob.type || "image/jpeg",
    );
    await getDb().projectPhotos.update(photoLocalId, { photoUrl: publicUrl });
  } catch {
    /* Fase 1–2 */
  }
}

export interface ProjectPhotoQuickFormProps {
  projectLocalId: string;
  requestGpsReading: () => Promise<GPSReading>;
  onCancel: () => void;
  onSaved: () => void;
}

export function ProjectPhotoQuickForm({
  projectLocalId,
  requestGpsReading,
  onCancel,
  onSaved,
}: ProjectPhotoQuickFormProps) {
  const captionId = useId();
  const photoGroupLabelId = useId();
  const cameraInputId = useId();
  const galleryInputId = useId();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [exifGps, setExifGps] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [exifBusy, setExifBusy] = useState(false);
  const [preferExif, setPreferExif] = useState(true);
  const [gpsExtra, setGpsExtra] = useState<GPSReading | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
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

  const attachGps = useCallback(async () => {
    setGpsErr(null);
    setGpsBusy(true);
    try {
      const r = await requestGpsReading();
      setGpsExtra(r);
    } catch {
      setGpsErr("No se pudo leer el GPS. Puedes guardar la foto sin ubicación.");
    } finally {
      setGpsBusy(false);
    }
  }, [requestGpsReading]);

  async function handleSave() {
    setError(null);
    if (!file) {
      setError("Elige una foto.");
      return;
    }
    setSubmitting(true);
    try {
      const useExif =
        exifGps != null && (gpsExtra == null || preferExif);
      const photoLocalId = await createProjectPhoto({
        projectLocalId,
        photoBlob: file,
        caption: caption.trim() || undefined,
        latitude: useExif ? exifGps.latitude : gpsExtra?.latitude,
        longitude: useExif ? exifGps.longitude : gpsExtra?.longitude,
      });

      const row = await getDb().projectPhotos.get(photoLocalId);
      const uploadBlob = row ? blobFromStored(row) : undefined;
      void uploadGalleryPhotoInBackground(
        projectLocalId,
        photoLocalId,
        uploadBlob ?? file,
      );

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15);
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
      <p className="text-muted-foreground text-xs">
        Foto de contexto del proyecto. La ubicación GPS es opcional.
      </p>

      <div className="space-y-2">
        <p id={photoGroupLabelId} className="text-sm leading-none font-medium">
          Foto
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Vista previa"
              className="size-full object-cover"
            />
          </div>
        ) : null}
        {file && exifBusy ? (
          <p className="text-muted-foreground text-xs">
            Leyendo ubicación en la foto…
          </p>
        ) : null}
        {file && !exifBusy && !exifGps ? (
          <p className="text-muted-foreground text-xs">
            Esta imagen no incluye coordenadas GPS en EXIF. Puedes añadir GPS
            actual abajo.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={captionId}>Descripción (opcional)</Label>
        <Textarea
          id={captionId}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder="Contexto de la foto"
        />
      </div>

      <div className="border-border space-y-2 rounded-lg border p-3">
        <p className="text-muted-foreground text-xs">Ubicación (opcional)</p>
        {exifGps ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
              EXIF (foto)
            </p>
            <p className="font-mono text-xs">
              {exifGps.latitude.toFixed(6)}, {exifGps.longitude.toFixed(6)}
            </p>
          </div>
        ) : null}
        {gpsExtra ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
              GPS de ahora
            </p>
            <p className="font-mono text-xs">
              {gpsExtra.latitude.toFixed(6)}, {gpsExtra.longitude.toFixed(6)}{" "}
              <span className="text-muted-foreground">
                ±{gpsExtra.accuracy.toFixed(0)} m
              </span>
            </p>
          </div>
        ) : null}
        {exifGps && gpsExtra ? (
          <fieldset className="space-y-1.5 text-xs">
            <legend className="sr-only">Prioridad de ubicación al guardar</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="gallery-coord-src"
                className="accent-primary"
                checked={preferExif}
                onChange={() => setPreferExif(true)}
              />
              Guardar con EXIF de la foto
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="gallery-coord-src"
                className="accent-primary"
                checked={!preferExif}
                onChange={() => setPreferExif(false)}
              />
              Guardar con GPS de ahora
            </label>
          </fieldset>
        ) : null}
        {gpsErr ? (
          <p className="text-destructive text-xs" role="alert">
            {gpsErr}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={gpsBusy}
          onClick={() => void attachGps()}
        >
          {gpsBusy ? "Leyendo GPS…" : gpsExtra ? "Actualizar GPS" : "Añadir GPS de ahora"}
        </Button>
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
          {submitting ? "Guardando…" : "Guardar foto"}
        </Button>
      </div>
    </div>
  );
}

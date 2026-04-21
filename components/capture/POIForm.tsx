"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathExtensionForImageBlob,
  uploadToProjectPhotosBucket,
} from "@/lib/supabase/storage";
import { blobFromStored } from "@/lib/db/blobFromStored";
import { getDb } from "@/lib/db/schema";
import { createPOI } from "@/lib/db/pois";
import { confirmIfOutsideMexicoRegion } from "@/lib/geo/mexicoBounds";
import { extractGpsFromImageFile } from "@/lib/geo/exifGps";
import { CopyableLatLng } from "@/components/geo/CopyableLatLng";
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
    const ext = pathExtensionForImageBlob(blob);
    const path = `${projectLocalId}/pois/${poiLocalId}.${ext}`;
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
  const photoGroupLabelId = useId();
  const cameraInputId = useId();
  const galleryInputId = useId();
  const [label, setLabel] = useState("");
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
    const trimmed = label.trim();
    if (!trimmed) {
      setError("La etiqueta del punto es obligatoria.");
      return;
    }
    if (!file) {
      setError("La foto del punto es obligatoria.");
      return;
    }
    const useExif = Boolean(exifGps && preferExif);
    const lat = useExif ? exifGps!.latitude : gpsReading.latitude;
    const lng = useExif ? exifGps!.longitude : gpsReading.longitude;
    if (!confirmIfOutsideMexicoRegion(lat, lng)) return;

    setSubmitting(true);
    try {
      const poiLocalId = await createPOI({
        projectLocalId,
        label: trimmed,
        latitude: lat,
        longitude: lng,
        gpsAccuracyM: useExif ? undefined : gpsReading.accuracy,
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
        <div className="text-sm leading-relaxed">
          <CopyableLatLng
            latitude={gpsReading.latitude}
            longitude={gpsReading.longitude}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono">
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
              alt="Vista previa POI"
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
            <CopyableLatLng
              className="text-sm"
              copyLabel="Copiar EXIF"
              latitude={exifGps.latitude}
              longitude={exifGps.longitude}
            />
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Fuente de coordenadas al guardar</legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="poi-coord-src"
                  className="accent-primary"
                  checked={preferExif}
                  onChange={() => setPreferExif(true)}
                />
                Guardar con ubicación EXIF
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="poi-coord-src"
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { POIForm } from "@/components/capture/POIForm";
import {
  useGeolocation,
  type GPSReading,
} from "@/lib/hooks/useGeolocation";
import { useGPSAveraged } from "@/lib/hooks/useGPSAveraged";

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return "Permiso de ubicación denegado.";
    case 2:
      return "Posición no disponible.";
    case 3:
      return "Tiempo de espera agotado.";
    default:
      return err.message || "Error de GPS.";
  }
}

type Phase = "menu" | "quick" | "avg" | "form";

export interface PoiCaptureSheetProps {
  projectLocalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function PoiCaptureSheet({
  projectLocalId,
  open,
  onOpenChange,
  onCreated,
}: PoiCaptureSheetProps) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);

  const geo = useGeolocation({
    watch: phase === "avg",
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 20_000,
    requestReadingOverrides: {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 90_000,
    },
  });

  const averaged = useGPSAveraged({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15_000,
  });

  const reset = useCallback(() => {
    setPhase("menu");
    setGeoError(null);
    setGpsReading(null);
    averaged.cancelAveraging();
  }, [averaged]);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) reset();
    prevOpen.current = open;
  }, [open, reset]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) reset();
    },
    [onOpenChange, reset],
  );

  const startQuick = useCallback(() => {
    setGeoError(null);
    setPhase("quick");
    void geo
      .requestReading()
      .then((r) => {
        setGpsReading(r);
        setPhase("form");
      })
      .catch((e: unknown) => {
        if (e && typeof e === "object" && "code" in e) {
          setGeoError(geoErrorMessage(e as GeolocationPositionError));
        } else {
          setGeoError("No se pudo obtener la posición.");
        }
        setPhase("menu");
      });
  }, [geo]);

  const startAveraged = useCallback(() => {
    setGeoError(null);
    setPhase("avg");
    averaged.startAveraging(5, 45_000);
  }, [averaged]);

  useEffect(() => {
    if (phase !== "avg") return;
    if (averaged.isAveraging) return;
    const reading = averaged.averagedReading;
    queueMicrotask(() => {
      if (reading) {
        setGpsReading(reading);
        setPhase("form");
        return;
      }
      setGeoError(
        "No se obtuvieron lecturas GPS. Reintenta o usa captura rápida.",
      );
      setPhase("menu");
    });
  }, [phase, averaged.isAveraging, averaged.averagedReading]);

  const onSaved = useCallback(() => {
    onCreated?.();
    handleOpenChange(false);
  }, [handleOpenChange, onCreated]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,720px)] gap-0 overflow-y-auto rounded-t-xl p-0"
        showCloseButton
      >
        <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
          <SheetTitle>
            {phase === "menu"
              ? "Nuevo POI"
              : phase === "form"
                ? "Datos del POI"
                : phase === "quick"
                  ? "Leyendo GPS…"
                  : "Captura precisa"}
          </SheetTitle>
          <SheetDescription className="text-left">
            {phase === "menu"
              ? "Elige cómo fijar la posición GPS."
              : phase === "avg"
                ? "Promediando lecturas…"
                : null}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-4">
          {geoError ? (
            <p className="text-destructive mb-4 text-sm" role="alert">
              {geoError}
            </p>
          ) : null}

          {phase === "menu" ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                className="h-12 w-full text-base"
                onClick={startQuick}
              >
                Captura rápida
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full text-base"
                onClick={startAveraged}
              >
                Captura precisa
              </Button>
            </div>
          ) : null}

          {phase === "quick" ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
              <span className="border-primary size-10 animate-spin rounded-full border-2 border-t-transparent" />
              <p>Leyendo GPS…</p>
            </div>
          ) : null}

          {phase === "avg" ? (
            <div className="space-y-4 py-2">
              <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  Lecturas:{" "}
                  <span className="text-foreground font-mono font-medium">
                    {averaged.readingsCount}
                  </span>{" "}
                  / 5
                </span>
                <span>
                  Precisión:{" "}
                  <span className="text-foreground font-mono">
                    {geo.reading
                      ? `±${geo.reading.accuracy.toFixed(1)} m`
                      : "—"}
                  </span>
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-[width] duration-150"
                  style={{
                    width: `${Math.round(averaged.progress * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {phase === "form" && gpsReading ? (
            <POIForm
              gpsReading={gpsReading}
              projectLocalId={projectLocalId}
              onCancel={() => {
                setPhase("menu");
                setGpsReading(null);
              }}
              onSaved={onSaved}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  useGeolocation,
  type GPSReading,
} from "@/lib/hooks/useGeolocation";
import { useGPSAveraged } from "@/lib/hooks/useGPSAveraged";
import { VertexForm } from "@/components/capture/VertexForm";

export interface CaptureButtonProps {
  polygonLocalId: string;
  projectLocalId: string;
  polygonIsClosed: boolean;
  disabled?: boolean;
  className?: string;
  /** Sheet controlado desde el padre (p. ej. botón en panel 1.10). */
  captureSheetOpen?: boolean;
  onCaptureSheetOpenChange?: (open: boolean) => void;
  /** Si false, no se muestra el FAB (solo el sheet con control externo). @default true */
  showFab?: boolean;
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return "Permiso de ubicación denegado.";
    case 2:
      return "Posición no disponible.";
    case 3:
      return "Tiempo de espera agotado. En Mac/interior el GPS por red puede tardar: activa ubicación precisa en Ajustes o prueba al aire libre / iPhone.";
    default:
      return err.message || "Error de GPS.";
  }
}

type Phase = "menu" | "quick" | "avg" | "form";

export function CaptureButton({
  polygonLocalId,
  projectLocalId,
  polygonIsClosed,
  disabled,
  className,
  captureSheetOpen: captureSheetOpenProp,
  onCaptureSheetOpenChange,
  showFab = true,
}: CaptureButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled =
    captureSheetOpenProp !== undefined &&
    onCaptureSheetOpenChange !== undefined;
  const open = controlled ? captureSheetOpenProp : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) {
        onCaptureSheetOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [controlled, onCaptureSheetOpenChange],
  );
  const [phase, setPhase] = useState<Phase>("menu");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [captureMethod, setCaptureMethod] = useState<
    "gps_single" | "gps_averaged"
  >("gps_single");
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);

  const geo = useGeolocation({
    watch: phase === "avg",
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 20_000,
    // Lectura puntual: en escritorio Wi‑Fi/cell responde mejor sin high accuracy forzado
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

  const resetFlow = useCallback(() => {
    setPhase("menu");
    setGeoError(null);
    setGpsReading(null);
    averaged.cancelAveraging();
  }, [averaged]);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetFlow();
    }
    prevOpenRef.current = open;
  }, [open, resetFlow]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetFlow();
    },
    [resetFlow, setOpen],
  );

  const startQuick = useCallback(() => {
    setGeoError(null);
    setCaptureMethod("gps_single");
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
    setCaptureMethod("gps_averaged");
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
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <>
      {showFab ? (
        <Button
          type="button"
          size="icon-lg"
          disabled={disabled}
          className={cn(
            "border-background fixed bottom-24 left-1/2 z-[35] size-16 -translate-x-1/2 rounded-full border-2 shadow-xl md:bottom-28",
            className,
          )}
          aria-label="Capturar vértice"
          onClick={() => setOpen(true)}
        >
          <Camera className="size-8" />
        </Button>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[min(92dvh,720px)] gap-0 overflow-y-auto rounded-t-xl p-0"
          showCloseButton
        >
          <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
            <SheetTitle>
              {phase === "menu"
                ? "Captura de vértice"
                : phase === "form"
                  ? "Confirmar vértice"
                  : phase === "quick"
                    ? "Captura rápida"
                    : "Captura precisa"}
            </SheetTitle>
            <SheetDescription className="text-left">
              {phase === "menu"
                ? "Elige cómo registrar la posición GPS de este vértice."
                : phase === "avg"
                  ? "Promediando lecturas con peso 1/precisión²."
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
                    Precisión actual:{" "}
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
                {averaged.isAveraging ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Mantén el teléfono estable hasta completar el promedio.
                  </p>
                ) : null}
              </div>
            ) : null}

            {phase === "form" && gpsReading ? (
              <VertexForm
                gpsReading={gpsReading}
                captureMethod={captureMethod}
                polygonLocalId={polygonLocalId}
                projectLocalId={projectLocalId}
                polygonIsClosed={polygonIsClosed}
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
    </>
  );
}

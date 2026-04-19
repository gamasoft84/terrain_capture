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
import { formatGeolocationUserMessage } from "@/lib/geo/permissionCopy";
import { useHighAccuracyGpsDesired } from "@/lib/hooks/useBatterySaver";
import {
  useGeolocation,
  type GPSReading,
} from "@/lib/hooks/useGeolocation";
import { useGPSAveraged } from "@/lib/hooks/useGPSAveraged";
import { VertexBatchGalleryForm } from "@/components/capture/VertexBatchGalleryForm";
import { VertexForm } from "@/components/capture/VertexForm";

export interface CaptureButtonProps {
  /** Polígono al que se añaden vértices (principal o sub-área). */
  polygonLocalId: string;
  projectLocalId: string;
  polygonIsClosed: boolean;
  disabled?: boolean;
  className?: string;
  captureSheetOpen?: boolean;
  onCaptureSheetOpenChange?: (open: boolean) => void;
  showFab?: boolean;
  /** Texto bajo el título en el menú GPS (p. ej. «Sub-área: Cabaña»). */
  captureTargetHint?: string;
}

type CapturePhase = "menu" | "quick" | "avg" | "form" | "vertexBatch";

export function CaptureButton({
  polygonLocalId,
  projectLocalId,
  polygonIsClosed,
  disabled,
  className,
  captureSheetOpen: captureSheetOpenProp,
  onCaptureSheetOpenChange,
  showFab = true,
  captureTargetHint,
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

  const [phase, setPhase] = useState<CapturePhase>("menu");

  const [geoError, setGeoError] = useState<string | null>(null);
  const [captureMethod, setCaptureMethod] = useState<
    "gps_single" | "gps_averaged"
  >("gps_single");
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);

  const highAccuracyGps = useHighAccuracyGpsDesired();

  const geo = useGeolocation({
    watch: phase === "avg",
    enableHighAccuracy: highAccuracyGps,
    maximumAge: 5_000,
    timeout: 20_000,
    requestReadingOverrides: {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 90_000,
    },
  });

  const averaged = useGPSAveraged({
    enableHighAccuracy: highAccuracyGps,
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
      queueMicrotask(() => {
        setGeoError(null);
        setGpsReading(null);
        averaged.cancelAveraging();
        setPhase("menu");
      });
    }
    prevOpenRef.current = open;
  }, [open, averaged]);

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
          setGeoError(
            formatGeolocationUserMessage(e as GeolocationPositionError),
          );
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

  const sheetTitle = (() => {
    switch (phase) {
      case "vertexBatch":
        return "Vértices desde galería";
      case "form":
        return "Confirmar vértice";
      case "quick":
        return "Captura rápida";
      case "avg":
        return "Captura precisa";
      default:
        return "Capturar vértice";
    }
  })();

  const sheetDescription = (() => {
    switch (phase) {
      case "menu":
        return captureTargetHint
          ? `${captureTargetHint}. Elegí cómo leer el GPS abajo.`
          : "Terreno principal. POI y foto adicional: pestaña Galería. Elegí cómo leer el GPS.";
      case "vertexBatch":
        return "Varias fotos con GPS en EXIF. Orden de izquierda a derecha: P1, P2…";
      case "avg":
        return "Promediando lecturas con peso 1/precisión².";
      default:
        return null;
    }
  })();

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
          aria-label="Capturar"
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
            <SheetTitle>{sheetTitle}</SheetTitle>
            {sheetDescription ? (
              <SheetDescription className="text-left">
                {sheetDescription}
              </SheetDescription>
            ) : null}
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
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => handleOpenChange(false)}
                >
                  ← Cerrar
                </Button>
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
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full text-base"
                  onClick={() => setPhase("vertexBatch")}
                >
                  Varias fotos (galería)
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
                key={polygonLocalId}
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

            {phase === "vertexBatch" ? (
              <VertexBatchGalleryForm
                key={polygonLocalId}
                polygonLocalId={polygonLocalId}
                projectLocalId={projectLocalId}
                polygonIsClosed={polygonIsClosed}
                onCancel={() => setPhase("menu")}
                onSaved={onSaved}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

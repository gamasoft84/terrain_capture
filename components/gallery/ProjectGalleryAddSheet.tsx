"use client";

import { ImagePlus, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProjectPhotoQuickForm } from "@/components/capture/ProjectPhotoQuickForm";
import { useHighAccuracyGpsDesired } from "@/lib/hooks/useBatterySaver";
import { useGeolocation } from "@/lib/hooks/useGeolocation";

export interface ProjectGalleryAddSheetProps {
  projectLocalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Al elegir POI se cierra este sheet; el padre abre `PoiCaptureSheet`. */
  onRequestPoiCapture?: () => void;
}

type AddStep = "choose" | "photo";

export function ProjectGalleryAddSheet({
  projectLocalId,
  open,
  onOpenChange,
  onRequestPoiCapture,
}: ProjectGalleryAddSheetProps) {
  const [step, setStep] = useState<AddStep>("choose");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setStep("choose");
    });
  }, [open]);

  const highAccuracyGps = useHighAccuracyGpsDesired();
  const geo = useGeolocation({
    watch: false,
    enableHighAccuracy: highAccuracyGps,
    maximumAge: 5_000,
    timeout: 20_000,
    requestReadingOverrides: {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 90_000,
    },
  });

  const handlePoi = useCallback(() => {
    onOpenChange(false);
    onRequestPoiCapture?.();
  }, [onOpenChange, onRequestPoiCapture]);

  const title =
    step === "choose"
      ? "Añadir a la galería"
      : "Foto adicional";

  const description =
    step === "choose"
      ? "POI con GPS o foto sin polígono. Aparecen en esta galería."
      : "Sin GPS obligatorio. Aparecerá con el origen «Adicional».";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,720px)] gap-0 overflow-y-auto rounded-t-xl p-0"
        showCloseButton
      >
        <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="text-left">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-4">
          {step === "choose" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                onClick={() => setStep("photo")}
              >
                <ImagePlus className="size-5 shrink-0" aria-hidden />
                <span className="text-sm font-medium">Foto adicional</span>
                <span className="text-muted-foreground text-xs font-normal">
                  Sin GPS obligatorio
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                onClick={handlePoi}
                disabled={!onRequestPoiCapture}
              >
                <MapPin className="size-5 shrink-0 text-amber-600" aria-hidden />
                <span className="text-sm font-medium">Punto de interés (POI)</span>
                <span className="text-muted-foreground text-xs font-normal">
                  Etiqueta + foto con GPS
                </span>
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground mb-3"
                onClick={() => setStep("choose")}
              >
                ← Otras opciones
              </Button>
              <ProjectPhotoQuickForm
                projectLocalId={projectLocalId}
                requestGpsReading={() => geo.requestReading()}
                onCancel={() => onOpenChange(false)}
                onSaved={() => onOpenChange(false)}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

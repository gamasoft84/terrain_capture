"use client";

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
}

export function ProjectGalleryAddSheet({
  projectLocalId,
  open,
  onOpenChange,
}: ProjectGalleryAddSheetProps) {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,720px)] gap-0 overflow-y-auto rounded-t-xl p-0"
        showCloseButton
      >
        <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
          <SheetTitle>Foto adicional</SheetTitle>
          <SheetDescription className="text-left">
            Sin GPS obligatorio. Aparecerá en esta galería con el origen
            &quot;Adicional&quot;.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-4">
          <ProjectPhotoQuickForm
            projectLocalId={projectLocalId}
            requestGpsReading={() => geo.requestReading()}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

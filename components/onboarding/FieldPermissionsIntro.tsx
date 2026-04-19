"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  readFieldPermissionsIntroDone,
  readWelcomeTourDone,
  writeFieldPermissionsIntroDone,
} from "@/lib/settings/onboarding";

/**
 * Una sola vez: antes de que el sistema pida ubicación/cámara al capturar,
 * explica qué esperar (especialmente en iPhone / Safari).
 */
export function FieldPermissionsIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function tryOpen() {
      if (readFieldPermissionsIntroDone()) return;
      if (!readWelcomeTourDone()) return;
      setOpen(true);
    }
    tryOpen();
    window.addEventListener("terraincapture:welcomeTourFinished", tryOpen);
    return () =>
      window.removeEventListener(
        "terraincapture:welcomeTourFinished",
        tryOpen,
      );
  }, []);

  function finish() {
    writeFieldPermissionsIntroDone();
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && finish()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-[90] w-[min(calc(100vw-2rem),24rem)] max-h-[min(90dvh,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-xl outline-none",
          )}
        >
          <div className="bg-primary/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-xl">
            <Shield className="text-primary size-7" aria-hidden />
          </div>
          <Dialog.Title className="text-foreground text-center text-lg font-semibold tracking-tight">
            Ubicación y cámara
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-3 text-center text-sm leading-relaxed">
            Cuando pulses capturar, el navegador puede pedir permisos de ubicación y
            de cámara.
          </Dialog.Description>
          <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
            <p>
              Para registrar vértices y fotos, TerrainCapture usará tu{" "}
              <strong className="text-foreground font-medium">ubicación</strong> y la{" "}
              <strong className="text-foreground font-medium">cámara</strong> solo en
              esos momentos (no antes).
            </p>
            <p>
              <strong className="text-foreground font-medium">iPhone (Safari):</strong>{" "}
              Ajustes → Privacidad y seguridad → Ubicación → Safari → al menos{" "}
              <span className="font-mono text-xs">Al usar la app</span>. Si falla la
              cámara, revisa también los permisos de Cámara para Safari.
            </p>
            <p className="text-muted-foreground text-xs">
              Puedes cambiar permisos después en Ajustes del sistema.
            </p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="button" size="sm" onClick={finish}>
              Entendido, continuar
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

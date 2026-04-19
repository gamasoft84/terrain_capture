"use client";

import { Dialog } from "@base-ui/react/dialog";
import { MapPin, Share2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  readWelcomeTourDone,
  writeWelcomeTourDone,
} from "@/lib/settings/onboarding";

const STEPS = [
  {
    title: "Captura en campo",
    body: "Camina el terreno y registra vértices con GPS. En cada punto puedes guardar fotos georreferenciadas y notas.",
    icon: MapPin,
  },
  {
    title: "Offline primero",
    body: "Los proyectos viven en tu teléfono (IndexedDB). Sin datos puedes seguir capturando; al recuperar la red, la sincronización corre en segundo plano.",
    icon: WifiOff,
  },
  {
    title: "Informes para clientes",
    body: "Desde cada proyecto genera PDF o imagen para WhatsApp: mapa, datos y galería en un formato profesional.",
    icon: Share2,
  },
];

/** Tour de 3 pantallas en el primer uso de la app (localStorage). */
export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (readWelcomeTourDone()) return;
    setOpen(true);
  }, []);

  function finish() {
    writeWelcomeTourDone();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("terraincapture:welcomeTourFinished"));
    }
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) finish();
  }

  const last = step >= STEPS.length - 1;
  const Icon = STEPS[step]?.icon ?? MapPin;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/45 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-[100] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-xl outline-none",
          )}
        >
          <div className="bg-primary/10 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
            <Icon className="text-primary size-8" aria-hidden />
          </div>
          <Dialog.Title className="text-foreground text-center text-lg font-semibold tracking-tight">
            {STEPS[step]?.title}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-3 text-center text-sm leading-relaxed">
            {STEPS[step]?.body}
          </Dialog.Description>

          <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === step ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={finish}>
              Omitir
            </Button>
            {last ? (
              <Button type="button" size="sm" onClick={finish}>
                Empezar
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
              >
                Siguiente
              </Button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

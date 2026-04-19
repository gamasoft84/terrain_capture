"use client";

import Link from "next/link";
import { Camera, MapPin, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estado vacío del listado de proyectos: ilustración ligera + CTA claro. */
export function EmptyProjectsHero() {
  return (
    <div className="border-border bg-card/50 relative overflow-hidden rounded-xl border">
      <div className="from-primary/8 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-amber-500/10" />
      <div className="relative flex flex-col items-center gap-6 px-6 py-12 text-center">
        <div className="flex items-center justify-center gap-4">
          <span className="border-border bg-background/90 flex size-16 items-center justify-center rounded-2xl border shadow-sm">
            <MapPin className="text-primary size-8" aria-hidden />
          </span>
          <span className="border-border bg-background/90 flex size-16 items-center justify-center rounded-2xl border shadow-sm">
            <Camera className="text-primary size-8" aria-hidden />
          </span>
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            Aún no hay levantamientos
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Crea un proyecto para guardar polígonos, fotos por vértice y POIs.
            Todo queda en este dispositivo hasta que sincronices con red.
          </p>
        </div>
        <Link
          href="/projects/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "gap-2 shadow-md",
          )}
        >
          <Plus className="size-5" aria-hidden />
          Crear primer proyecto
        </Link>
        <p className="text-muted-foreground max-w-xs text-xs leading-snug">
          El botón flotante <span className="font-mono">+</span> también crea un
          proyecto desde cualquier pantalla.
        </p>
      </div>
    </div>
  );
}

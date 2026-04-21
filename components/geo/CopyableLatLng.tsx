"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CopyableLatLngProps = {
  latitude: number;
  longitude: number;
  decimals?: number;
  className?: string;
  /** Texto accesible / botón (por defecto «Copiar Lat/Lng»). */
  copyLabel?: string;
};

export function CopyableLatLng({
  latitude,
  longitude,
  decimals = 6,
  className,
  copyLabel = "Copiar Lat/Lng",
}: CopyableLatLngProps) {
  const text = `${latitude.toFixed(decimals)}, ${longitude.toFixed(decimals)}`;
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("err");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }, [text]);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2",
        className,
      )}
    >
      <span className="text-foreground font-mono text-xs break-all sm:text-sm">
        {text}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-fit shrink-0"
        onClick={() => void onCopy()}
      >
        {state === "ok" ? (
          <>
            <Check className="mr-1 size-3.5" aria-hidden />
            Copiado
          </>
        ) : state === "err" ? (
          "Portapapeles no disponible"
        ) : (
          <>
            <Copy className="mr-1 size-3.5" aria-hidden />
            {copyLabel}
          </>
        )}
      </Button>
    </div>
  );
}

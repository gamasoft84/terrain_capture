"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const MINUTES_KEY = "terraincapture:fieldRouteMinutes";
const DISMISSED_KEY = "terraincapture:brightnessHintDismissed";

function isFieldRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/capture") return true;
  return pathname.startsWith("/projects/");
}

/** Tras ~15 min en rutas de campo con la pestaña visible, sugiere bajar brillo (ahorro de batería). */
export function FieldBatteryHint() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isFieldRoute(pathname)) {
      setShow(false);
      return;
    }
    if (sessionStorage.getItem(DISMISSED_KEY) === "1") return;

    const existing = Number(sessionStorage.getItem(MINUTES_KEY) || "0");
    if (existing >= 15) setShow(true);

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      if (!isFieldRoute(path)) return;
      const prev = Number(sessionStorage.getItem(MINUTES_KEY) || "0");
      const next = prev + 1;
      sessionStorage.setItem(MINUTES_KEY, String(next));
      if (next >= 15 && sessionStorage.getItem(DISMISSED_KEY) !== "1") {
        setShow(true);
      }
    }, 60_000);

    return () => window.clearInterval(id);
  }, [pathname]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="border-border bg-amber-500/10 text-foreground flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs sm:text-sm"
    >
      <p className="min-w-0 flex-1 leading-snug">
        Llevas un buen rato en campo. Si puedes,{" "}
        <strong className="font-medium">baja el brillo de la pantalla</strong>{" "}
        para alargar la batería del teléfono.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          sessionStorage.setItem(DISMISSED_KEY, "1");
          setShow(false);
        }}
      >
        Entendido
      </Button>
    </div>
  );
}

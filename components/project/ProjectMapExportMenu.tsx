"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadProjectMapExportInput,
  runProjectMapExport,
  type ProjectMapExportFormat,
} from "@/lib/geo/projectMapExport";

const FORMAT_ORDER: ProjectMapExportFormat[] = ["kml", "geojson", "csv", "zip"];

const LABELS: Record<ProjectMapExportFormat, string> = {
  kml: "KML",
  geojson: "GeoJSON",
  csv: "CSV",
  zip: "ZIP (incluye fotos)",
};

export function ProjectMapExportMenu({
  projectLocalId,
}: {
  projectLocalId: string;
}) {
  const [open, setOpen] = useState(false);
  const [busyFormat, setBusyFormat] =
    useState<ProjectMapExportFormat | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const disableAll = busyFormat !== null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onExport = useCallback(
    (format: ProjectMapExportFormat) => {
      void (async () => {
        setBusyFormat(format);
        setOpen(false);
        try {
          const input = await loadProjectMapExportInput(projectLocalId);
          if (input) await runProjectMapExport(format, input);
        } finally {
          setBusyFormat(null);
        }
      })();
    },
    [projectLocalId],
  );

  return (
    <div ref={rootRef} className="relative z-[60]">
      <button
        type="button"
        disabled={disableAll}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Exportar mapa: KML, GeoJSON o CSV"
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "shadow-md gap-1",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {busyFormat ? "Exportando…" : "Export"}
        <ChevronDown
          className={cn(
            "size-3.5 opacity-70 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            "border-border bg-popover text-popover-foreground absolute right-0 top-full z-[70] mt-1 min-w-[11rem] rounded-lg border py-1 shadow-lg",
          )}
        >
          {FORMAT_ORDER.map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled={disableAll}
              className={cn(
                "hover:bg-accent hover:text-accent-foreground flex w-full px-3 py-2 text-left text-sm outline-none disabled:opacity-50",
              )}
              onClick={() => onExport(format)}
            >
              {busyFormat === format ? "Exportando…" : LABELS[format]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { LocalPolygon } from "@/lib/db/schema";
import { SubPolygonManager } from "./SubPolygonManager";

export interface SubPolygonWorkflowProps {
  projectLocalId: string;
  subPolygons: LocalPolygon[];
  selectedSubPolygonLocalId: string | null;
  onSelectSubPolygon: (localId: string | null) => void;
  /** Cuando está en false solo se muestra la opción para activar sub-áreas. */
  workflowEnabled: boolean;
  onWorkflowEnabledChange: (enabled: boolean) => void;
  /** Captura de vértices por GPS para una sub-área (botón en cada fila). */
  onRequestSubVertexCapture?: (polygon: LocalPolygon) => void;
}

export function SubPolygonWorkflow({
  projectLocalId,
  subPolygons,
  selectedSubPolygonLocalId,
  onSelectSubPolygon,
  workflowEnabled,
  onWorkflowEnabledChange,
  onRequestSubVertexCapture,
}: SubPolygonWorkflowProps) {
  const checkboxId = useId();
  const hasSubs = subPolygons.length > 0;

  const handleToggle = useCallback(
    (next: boolean) => {
      onWorkflowEnabledChange(next);
      if (!next) {
        onSelectSubPolygon(null);
      }
    },
    [onSelectSubPolygon, onWorkflowEnabledChange],
  );

  return (
    <div className="border-border bg-muted/10 space-y-2 rounded-lg border p-2.5">
      <div className="flex gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={workflowEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
          <span className="text-foreground block text-sm font-medium leading-snug">
            Sub-áreas dentro del terreno
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            Solo si necesitas otra zona (cabaña, aljibe…). Desactivado ahorra
            espacio en el panel.
          </span>
        </label>
      </div>

      {!workflowEnabled && hasSubs ? (
        <p className="text-muted-foreground border-border rounded-md border border-dashed bg-background/60 px-2 py-1.5 text-xs">
          Este proyecto ya tiene{" "}
          <span className="text-foreground font-mono font-medium">
            {subPolygons.length}
          </span>{" "}
          sub-área(s). Activá la opción de arriba para gestionarlas o usar
          «GPS» en cada sub-área.
        </p>
      ) : null}

      {workflowEnabled ? (
        <SubPolygonManager
          projectLocalId={projectLocalId}
          subPolygons={subPolygons}
          selectedSubPolygonLocalId={selectedSubPolygonLocalId}
          onSelectSubPolygon={onSelectSubPolygon}
          onRequestSubVertexCapture={onRequestSubVertexCapture}
        />
      ) : null}
    </div>
  );
}

/** Primera carga con datos: si ya hay sub-áreas, conviene mostrar el flujo. */
export function useSeedSubAreasWorkflow(
  subLayerCount: number | undefined,
  setWorkflowEnabled: (v: boolean) => void,
): void {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || subLayerCount === undefined) return;
    seededRef.current = true;
    if (subLayerCount > 0) {
      setWorkflowEnabled(true);
    }
  }, [subLayerCount, setWorkflowEnabled]);
}

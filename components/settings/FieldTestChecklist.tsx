"use client";

import { Button } from "@/components/ui/button";
import {
  FIELD_TEST_ITEMS,
  type FieldTestItemId,
  useFieldTestChecklist,
} from "@/lib/hooks/useFieldTestChecklist";

export function FieldTestChecklist() {
  const { checked, toggle, reset, hydrated, doneCount, total } =
    useFieldTestChecklist();

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-base font-medium">Testing en campo (Fase 5.5)</p>
        <p className="text-muted-foreground text-sm leading-snug">
          Lista de verificación para Huatulco: marca cada ítem cuando lo completes.
          Los datos se guardan solo en este dispositivo.
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          Progreso: {hydrated ? `${doneCount} / ${total}` : "…"}
        </p>
      </div>

      <ul className="space-y-3">
        {FIELD_TEST_ITEMS.map((item) => (
          <li key={item.id} className="flex gap-3">
            <input
              id={`field-test-${item.id}`}
              type="checkbox"
              checked={Boolean(checked[item.id])}
              onChange={() => toggle(item.id as FieldTestItemId)}
              disabled={!hydrated}
              className="border-input text-primary focus-visible:ring-ring mt-0.5 size-5 shrink-0 rounded border shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            />
            <label
              htmlFor={`field-test-${item.id}`}
              className="min-w-0 cursor-pointer space-y-0.5 leading-snug"
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-muted-foreground block text-xs">
                {item.hint}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={!hydrated || doneCount === 0}
        onClick={() => {
          if (
            typeof window !== "undefined" &&
            window.confirm(
              "¿Borrar todas las marcas de la checklist en este dispositivo?",
            )
          ) {
            reset();
          }
        }}
      >
        Limpiar checklist
      </Button>
    </div>
  );
}

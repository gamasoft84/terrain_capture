"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SUB_POLYGON_COLOR_OPTIONS } from "@/lib/constants/subPolygonColors";
import {
  createPolygon,
  deletePolygonCascade,
  updatePolygon,
} from "@/lib/db/polygons";
import type { LocalPolygon } from "@/lib/db/schema";

export interface SubPolygonManagerProps {
  projectLocalId: string;
  subPolygons: LocalPolygon[];
  selectedSubPolygonLocalId: string | null;
  onSelectSubPolygon: (localId: string | null) => void;
}

export function SubPolygonManager({
  projectLocalId,
  subPolygons,
  selectedSubPolygonLocalId,
  onSelectSubPolygon,
}: SubPolygonManagerProps) {
  const [createName, setCreateName] = useState("Sub-área");
  const [createColor, setCreateColor] = useState<string>(
    SUB_POLYGON_COLOR_OPTIONS[0],
  );
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(
    SUB_POLYGON_COLOR_OPTIONS[0],
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = useCallback((p: LocalPolygon) => {
    setEditingId(p.localId);
    setEditName(p.name);
    setEditColor(p.color);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editName.trim() || "Sub-área";
    setSavingEdit(true);
    try {
      await updatePolygon(editingId, { name, color: editColor });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  }, [editColor, editName, editingId]);

  const handleCreate = useCallback(async () => {
    const name = createName.trim() || "Sub-área";
    setCreating(true);
    try {
      await createPolygon({
        projectLocalId,
        name,
        type: "sub",
        color: createColor,
        isClosed: false,
      });
      setCreateName("Sub-área");
      setCreateColor(SUB_POLYGON_COLOR_OPTIONS[0]);
    } finally {
      setCreating(false);
    }
  }, [createColor, createName, projectLocalId]);

  const handleDelete = useCallback(
    async (p: LocalPolygon) => {
      const ok = window.confirm(
        `¿Eliminar “${p.name}” y todos sus vértices? Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
      if (selectedSubPolygonLocalId === p.localId) {
        onSelectSubPolygon(null);
      }
      await deletePolygonCascade(p.localId);
    },
    [onSelectSubPolygon, selectedSubPolygonLocalId],
  );

  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Sub-áreas
        </p>
        {selectedSubPolygonLocalId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 text-[11px]"
            onClick={() => onSelectSubPolygon(null)}
          >
            Quitar resaltado
          </Button>
        ) : null}
      </div>

      <div className="border-border space-y-2 rounded-md border bg-background/80 p-2">
        <Label htmlFor="sub-new-name" className="text-[11px]">
          Nueva sub-área
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            id="sub-new-name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Nombre"
            className="h-9 flex-1 text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {SUB_POLYGON_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "size-7 rounded-full border-2 transition-transform",
                  createColor === c
                    ? "border-foreground scale-105"
                    : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                onClick={() => setCreateColor(c)}
              />
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "…" : "Añadir"}
          </Button>
        </div>
      </div>

      {subPolygons.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No hay sub-áreas. Crea una para cabaña, aljibe, etc., y captura sus
          vértices desde Capturar → Vértice de sub-área.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]">
          {subPolygons.map((p) => {
            const selected = p.localId === selectedSubPolygonLocalId;
            const editing = editingId === p.localId;
            return (
              <li key={p.localId}>
                {editing ? (
                  <div className="border-border space-y-2 rounded-md border p-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      {SUB_POLYGON_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={cn(
                            "size-7 rounded-full border-2",
                            editColor === c
                              ? "border-foreground"
                              : "border-transparent",
                          )}
                          style={{ backgroundColor: c }}
                          aria-label={`Color ${c}`}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={savingEdit}
                        onClick={cancelEdit}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        disabled={savingEdit}
                        onClick={() => void saveEdit()}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() =>
                        onSelectSubPolygon(selected ? null : p.localId)
                      }
                    >
                      <span
                        className="size-3 shrink-0 rounded-full border shadow-sm"
                        style={{ backgroundColor: p.color }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                      {p.isClosed ? (
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          cerrado
                        </span>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-8 shrink-0 px-2 text-xs"
                      onClick={() => startEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 shrink-0 px-2 text-xs"
                      onClick={() => void handleDelete(p)}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

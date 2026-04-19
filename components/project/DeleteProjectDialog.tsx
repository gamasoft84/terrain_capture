"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/db/projects";
import { syncManager } from "@/lib/db/sync";
import { clearLastProjectLocalIdIfMatch } from "@/lib/settings/lastProjectLocalId";
import { cn } from "@/lib/utils";

export type DeleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectLocalId: string;
  projectName: string;
  onDeleted?: () => void;
};

/** Confirmación antes de borrar proyecto y todo lo asociado en el dispositivo (y cola de sync). */
export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectLocalId,
  projectName,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && busy) return;
      if (!next) setError(null);
      onOpenChange(next);
    },
    [busy, onOpenChange],
  );

  const runDelete = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteProject(projectLocalId);
      clearLastProjectLocalIdIfMatch(projectLocalId);
      void syncManager.processQueue();
      onDeleted?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }, [onDeleted, onOpenChange, projectLocalId]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/45 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-[200] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-xl outline-none",
          )}
        >
          <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
            ¿Eliminar proyecto?
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Se borrarán en este dispositivo{" "}
            <span className="text-foreground font-medium">{projectName}</span>:
            polígonos, vértices, POIs, fotos y la cola de sincronización pendiente.
            Si ya estaba en la nube, se encolará el borrado del proyecto (en
            Supabase las tablas hijas tienen{" "}
            <span className="text-foreground/90">ON DELETE CASCADE</span>).
          </Dialog.Description>
          {error ? (
            <p className="text-destructive mt-3 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void runDelete()}
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

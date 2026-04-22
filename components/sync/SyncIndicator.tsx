"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  Cloud,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSyncQueueContext } from "@/components/sync/SyncQueueProvider";
import { getDb } from "@/lib/db/schema";
import type { SyncQueueEntry } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";
import { cn } from "@/lib/utils";

function statusLabel(s: SyncQueueEntry["status"]): string {
  switch (s) {
    case "pending":
      return "pendiente";
    case "processing":
      return "procesando";
    case "completed":
      return "completado";
    case "failed":
      return "error";
    default:
      return s;
  }
}

function QueueRows() {
  const raw = useLiveQuery(() => getDb().syncQueue.toArray(), [], []);
  const rows = useMemo(() => {
    const list = [...(raw ?? [])];
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list;
  }, [raw]);

  if (!rows.length) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        La cola está vacía.
      </p>
    );
  }

  return (
    <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
      {rows.map((row) => (
        <li
          key={row.id ?? `${row.entityLocalId}-${row.createdAt.getTime()}`}
          className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono font-medium">
              {row.entityType} · {row.action}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  row.status === "failed" && "bg-destructive/20 text-destructive",
                  row.status === "pending" && "bg-primary/15 text-primary",
                  row.status === "processing" && "bg-muted text-foreground",
                )}
              >
                {statusLabel(row.status)}
              </span>
              {row.id != null ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center rounded p-1 transition-colors"
                  onClick={() => void syncManager.deleteQueueEntry(row.id as number)}
                  aria-label="Eliminar de la cola"
                  title="Eliminar de la cola"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground mt-1 break-all font-mono text-[11px]">
            {row.entityLocalId}
          </p>
          {row.attemptCount > 0 ? (
            <p className="text-muted-foreground mt-0.5">
              Intentos: {row.attemptCount}
            </p>
          ) : null}
          {row.errorMessage ? (
            <p className="text-destructive mt-1 text-[11px] leading-snug">
              {row.errorMessage}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SyncIndicator() {
  const {
    pendingCount,
    failedCount,
    isSyncing,
    lastSync,
    syncNow,
    lastPull,
    lastPullError,
    pullNow,
    online,
  } = useSyncQueueContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  const showWarning = failedCount > 0;
  const showPending = pendingCount > 0;
  const showSyncedTick =
    online && !showWarning && !showPending && !isSyncing;

  let title = "Sincronización";
  if (!online) title = "Sin red";
  else if (showWarning) title = "Errores de sincronización";
  else if (isSyncing) title = "Sincronizando…";
  else if (showPending) title = "Cambios pendientes de subir";
  else title = "Todo sincronizado";

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "border-border bg-background/80 hover:bg-muted/80 relative flex min-h-9 min-w-9 items-center justify-center rounded-lg border shadow-sm transition-colors",
          showWarning && "border-amber-500/50 ring-1 ring-amber-500/30",
        )}
        aria-label={title}
        title={title}
      >
        <span className="relative inline-flex items-center justify-center">
          {isSyncing ? (
            <Loader2
              className="text-primary size-5 animate-spin"
              aria-hidden
            />
          ) : (
            <>
              <Cloud
                className={cn(
                  "size-5",
                  !online && "text-muted-foreground",
                  online && showWarning && "text-amber-500",
                  online && !showWarning && "text-primary",
                )}
                aria-hidden
              />
              {showWarning ? (
                <AlertTriangle
                  className="text-amber-500 absolute -right-1.5 -bottom-1 size-3.5"
                  aria-hidden
                />
              ) : showPending ? (
                <span className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              ) : showSyncedTick ? (
                <Check
                  className="text-primary absolute -right-1 -bottom-1 size-3.5 stroke-[3]"
                  aria-hidden
                />
              ) : null}
            </>
          )}
        </span>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0">
          <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
            <SheetTitle>Cola de sincronización</SheetTitle>
            <SheetDescription className="text-left">
              {online
                ? "Operaciones pendientes de enviar a Supabase desde este dispositivo."
                : "Sin red: la cola se procesará al reconectar."}
              {lastSync ? (
                <span className="mt-1 block text-xs">
                  Último ciclo:{" "}
                  {formatDistanceToNow(lastSync, {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              ) : null}
              {lastPull ? (
                <span className="mt-1 block text-xs">
                  Última descarga (pull):{" "}
                  {formatDistanceToNow(lastPull, { addSuffix: true, locale: es })}
                </span>
              ) : null}
              {lastPullError ? (
                <span className="text-destructive mt-1 block text-xs leading-snug">
                  Error en descarga (pull): {lastPullError}
                </span>
              ) : null}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-3">
            <QueueRows />
          </div>
          <SheetFooter className="border-border flex-col gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={!online || isSyncing}
                onClick={() => void pullNow()}
              >
                Descargar (pull)
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                disabled={!online || isSyncing}
                onClick={() => void syncNow()}
              >
                <RefreshCw
                  className={cn("mr-2 size-4", isSyncing && "animate-spin")}
                  aria-hidden
                />
                Sincronizar ahora
              </Button>
              {failedCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={!online || isSyncing}
                  onClick={() => {
                    void (async () => {
                      await syncManager.retryFailed();
                      await syncNow();
                    })();
                  }}
                >
                  Reintentar fallidos
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled={isSyncing}
                onClick={() => void syncManager.clearQueue()}
              >
                Vaciar cola
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

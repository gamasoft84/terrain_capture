"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncQueueContext } from "@/components/sync/SyncQueueProvider";
import { syncManager } from "@/lib/db/sync";
import { cn } from "@/lib/utils";

function supabasePublicEnvReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    typeof url === "string" &&
    url.length > 0 &&
    typeof key === "string" &&
    key.length > 0
  );
}

export function SyncSettingsActions() {
  const {
    pendingCount,
    failedCount,
    isSyncing,
    lastSync,
    lastPull,
    lastPullError,
    syncNow,
    pullNow,
    online,
  } = useSyncQueueContext();

  const envOk = supabasePublicEnvReady();

  return (
    <div className="space-y-4">
      {!envOk ? (
        <p className="text-amber-600 dark:text-amber-400 text-sm leading-snug">
          No hay URL o anon key de Supabase en el build (
          <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_*</span>
          ). La sincronización no puede ejecutarse hasta configurarlas en{" "}
          <span className="font-mono text-xs">.env.local</span> y reiniciar el
          servidor de desarrollo.
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm leading-snug">
        Con red, cada ciclo <strong>descarga</strong> desde Supabase lo que haya en la nube
        (mismo proyecto y anon key) y luego <strong>sube</strong> la cola local. Si el
        servidor tiene una versión más reciente (<span className="font-mono text-xs">updated_at</span>
        ), sustituye el proyecto o el polígono afectado en este dispositivo.
      </p>

      <ul className="text-muted-foreground space-y-1 text-sm">
        <li>
          Estado red:{" "}
          <span className="text-foreground font-medium">
            {online ? "en línea" : "sin red"}
          </span>
        </li>
        <li>
          Pendientes en cola:{" "}
          <span className="text-foreground font-medium">{pendingCount}</span>
        </li>
        {failedCount > 0 ? (
          <li className="text-destructive">
            Entradas con error (revisar panel de la nube en la barra superior):{" "}
            <span className="font-semibold">{failedCount}</span>
          </li>
        ) : null}
        {lastSync ? (
          <li className="text-xs">
            Último ciclo manual/automático:{" "}
            {formatDistanceToNow(lastSync, { addSuffix: true, locale: es })}
          </li>
        ) : (
          <li className="text-xs">Aún no se ha completado un ciclo en esta sesión.</li>
        )}
        {lastPull ? (
          <li className="text-xs">
            Última descarga (pull):{" "}
            {formatDistanceToNow(lastPull, { addSuffix: true, locale: es })}
          </li>
        ) : null}
        {lastPullError ? (
          <li className="text-destructive text-xs leading-snug">
            Error en descarga (pull): {lastPullError}
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!envOk || !online || isSyncing}
          onClick={() => void pullNow()}
        >
          Descargar todo de Supabase
        </Button>
        <Button
          type="button"
          disabled={!envOk || !online || isSyncing}
          onClick={() => void syncNow()}
        >
          <RefreshCw
            className={cn("mr-2 size-4", isSyncing && "animate-spin")}
            aria-hidden
          />
          {isSyncing ? "Sincronizando…" : "Sincronizar con Supabase"}
        </Button>
        {failedCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={!envOk || !online || isSyncing}
            onClick={() => {
              void (async () => {
                await syncManager.retryFailed();
                await syncNow();
              })();
            }}
          >
            {isSyncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            Reintentar fallidos
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs leading-snug">
        También puedes abrir la cola detallada con el icono de nube en la barra
        superior.
      </p>
    </div>
  );
}

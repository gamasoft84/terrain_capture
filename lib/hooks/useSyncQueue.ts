"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedOnlineStatus } from "@/lib/context/OnlineStatusBridge";
import { getDb } from "@/lib/db/schema";
import { syncManager } from "@/lib/db/sync";

const RETRY_INTERVAL_MS = 30_000;

export type UseSyncQueueResult = {
  /** Hay trabajo en cola (`pending` o `processing`). */
  pendingCount: number;
  /** Filas en error permanente tras máximo de reintentos. */
  failedCount: number;
  /** `syncManager.processQueue` en curso. */
  isSyncing: boolean;
  /** Última ejecución completa de `processQueue` (éxito al volver del await). */
  lastSync: Date | null;
  /** Fuerza un ciclo de sincronización si hay red. */
  syncNow: () => Promise<void>;
  /** Resultado combinado de `useOnlineStatus`. */
  online: boolean;
};

/**
 * Auto-sync cuando hay red: al montar / al recuperar conexión, y cada 30s si hay pendientes.
 */
export function useSyncQueue(): UseSyncQueueResult {
  const { online } = useSharedOnlineStatus();

  const pendingEntries = useLiveQuery(
    () =>
      getDb()
        .syncQueue.filter(
          (r) => r.status === "pending" || r.status === "processing",
        )
        .toArray(),
    [],
    [],
  );

  const failedEntries = useLiveQuery(
    () =>
      getDb().syncQueue.where("status").equals("failed").toArray(),
    [],
    [],
  );

  const pendingCount = pendingEntries?.length ?? 0;
  const failedCount = failedEntries?.length ?? 0;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const lockRef = useRef(false);
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const unsub = syncManager.subscribe((s) => {
      setIsSyncing(s.phase === "running");
    });
    return unsub;
  }, []);

  const syncNow = useCallback(async () => {
    if (!online || lockRef.current) return;
    lockRef.current = true;
    try {
      // Manual: fuerza reintento aunque haya backoff tras fallos previos.
      await syncManager.processQueue({ force: true });
      setLastSync(new Date());
    } finally {
      lockRef.current = false;
    }
  }, [online]);

  useEffect(() => {
    if (!online) {
      wasOnlineRef.current = false;
      return;
    }
    const prev = wasOnlineRef.current;
    wasOnlineRef.current = true;
    if (prev === null || prev === false) {
      void syncNow();
    }
  }, [online, syncNow]);

  useEffect(() => {
    if (!online || pendingCount === 0) return;
    const id = window.setInterval(() => void syncNow(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [online, pendingCount, syncNow]);

  /** iOS/Android: al volver a primer plano, iOS suele aplazar timers; forzamos un ciclo. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!online || pendingCount === 0) return;
      void syncNow();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [online, pendingCount, syncNow]);

  return {
    pendingCount,
    failedCount,
    isSyncing,
    lastSync,
    syncNow,
    online,
  };
}

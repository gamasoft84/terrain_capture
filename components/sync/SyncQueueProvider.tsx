"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
  useSyncQueue,
  type UseSyncQueueResult,
} from "@/lib/hooks/useSyncQueue";

const SyncQueueContext = createContext<UseSyncQueueResult | null>(null);

/** Una sola instancia de `useSyncQueue` (auto-sync + estado compartido). */
export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const value = useSyncQueue();
  return (
    <SyncQueueContext.Provider value={value}>
      {children}
    </SyncQueueContext.Provider>
  );
}

export function useSyncQueueContext(): UseSyncQueueResult {
  const ctx = useContext(SyncQueueContext);
  if (!ctx) {
    throw new Error(
      "useSyncQueueContext requiere <SyncQueueProvider> en un layout padre",
    );
  }
  return ctx;
}

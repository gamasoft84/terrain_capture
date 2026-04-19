"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
  useOnlineStatus,
  type OnlineStatusDetail,
} from "@/lib/hooks/useOnlineStatus";

const OnlineStatusContext = createContext<OnlineStatusDetail | null>(null);

export function OnlineStatusBridge({
  children,
  pollMs,
}: {
  children: ReactNode;
  pollMs?: number;
}) {
  const detail = useOnlineStatus(pollMs);
  return (
    <OnlineStatusContext.Provider value={detail}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

/** Lee el estado compartido creado por `OnlineStatusBridge` (un solo sondeo activo). */
export function useSharedOnlineStatus(): OnlineStatusDetail {
  const ctx = useContext(OnlineStatusContext);
  if (!ctx) {
    throw new Error("useSharedOnlineStatus requiere <OnlineStatusBridge> en un layout padre");
  }
  return ctx;
}

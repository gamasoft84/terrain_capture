"use client";

import { useSyncQueue } from "@/lib/hooks/useSyncQueue";

/** Monta la lógica de auto-sync (sin UI). Debe vivir solo en cliente. */
export function AutoSync() {
  useSyncQueue();
  return null;
}

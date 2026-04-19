"use client";

import { useSharedOnlineStatus } from "@/lib/context/OnlineStatusBridge";

/** Franja visible solo sin red (encima del contenido, bajo la TopBar). */
export function OfflineBanner() {
  const { online } = useSharedOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-amber-500/35 bg-amber-500/15 text-amber-100 border-b px-4 py-2 text-center text-sm leading-snug"
    >
      Sin conexión: los datos siguen guardándose en este dispositivo; la subida a la
      nube se hará cuando vuelva la señal.
    </div>
  );
}

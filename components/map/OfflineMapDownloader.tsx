"use client";

/**
 * Antes: vista previa MapLibre + descarga de teselas ESRI a Dexie para uso offline.
 * Con Mapbox el mapa principal usa la API de Mapbox (requiere red); no hay caché
 * local de teselas compatible con este motor en el flujo actual.
 */
export function OfflineMapDownloader() {
  return (
    <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4 text-sm leading-snug">
      <p className="text-foreground font-medium">Mapa offline (satélite)</p>
      <p className="text-muted-foreground">
        El mapa del proyecto usa <strong>Mapbox</strong> (satélite + calles).
        Eso implica conexión para cargar fondo y un access token válido. La descarga de
        teselas satelitales en caché local (flujo anterior con ESRI + Dexie) no
        aplica con el proveedor actual.
      </p>
      <p className="text-muted-foreground text-xs">
        Si necesitas trabajo totalmente sin datos, conserva capturas y vértices en
        la app; el fondo del mapa puede no verse hasta recuperar señal.
      </p>
    </div>
  );
}

"use client";

/**
 * Antes: vista previa MapLibre + descarga de teselas ESRI a Dexie para uso offline.
 * Según el motor elegido en Ajustes (Mapbox, Google o MapLibre+ESRI), el fondo
 * suele requerir red y claves; el flujo anterior de teselas ESRI en Dexie no está
 * conectado a la vista del mapa en este código.
 */
export function OfflineMapDownloader() {
  return (
    <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4 text-sm leading-snug">
      <p className="text-foreground font-medium">Mapa offline (satélite)</p>
      <p className="text-muted-foreground">
        En <strong>Ajustes</strong> puedes elegir Mapbox, Google Maps o el modo{" "}
        <strong>MapLibre + ESRI</strong> (imagen satelital pública, sin token de
        pago). En todos los casos hace falta conexión para el fondo salvo que
        implementes otra capa offline. La descarga de teselas en caché local
        (flujo anterior con ESRI + Dexie) no está enlazada al motor actual.
      </p>
      <p className="text-muted-foreground text-xs">
        Si necesitas trabajo totalmente sin datos, conserva capturas y vértices en
        la app; el fondo del mapa puede no verse hasta recuperar señal.
      </p>
    </div>
  );
}

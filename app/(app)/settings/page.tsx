"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OfflineMapDownloader } from "@/components/map/OfflineMapDownloader";
import { SyncSettingsActions } from "@/components/settings/SyncSettingsActions";
import { useMapEngine } from "@/components/providers/MapEnginePreference";
import { useMapVertexDrag } from "@/components/providers/MapVertexDragPreference";
import { useBatterySaverControls } from "@/lib/hooks/useBatterySaver";
import type { MapEngineId } from "@/lib/settings/mapEngine";

const MAP_ENGINE_OPTIONS: { id: MapEngineId; title: string; detail: string }[] =
  [
    {
      id: "mapbox",
      title: "Mapbox",
      detail:
        "Satélite + calles (estilo Mapbox). Requiere NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.",
    },
    {
      id: "google",
      title: "Google Maps",
      detail:
        "Vista híbrida (satélite + etiquetas). Requiere NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
    },
    {
      id: "maplibre",
      title: "MapLibre + ESRI (inicial del spec)",
      detail:
        "Solo imagen satelital pública; no hace falta clave de pago. Alineado con el enfoque original del proyecto.",
    },
  ];

export default function SettingsPage() {
  const { mapEngine, setMapEngine } = useMapEngine();
  const { allowVertexMapDrag, setAllowVertexMapDrag } = useMapVertexDrag();
  const { batterySaverEnabled, setBatterySaverEnabled } =
    useBatterySaverControls();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Sincronización con Supabase</CardTitle>
          <CardDescription>
            Envío de la cola local al servidor; mismo control que el icono de nube
            arriba a la derecha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncSettingsActions />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
          <CardDescription>
            Preferencias almacenadas localmente en este dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-border space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-base font-medium">Motor del mapa</p>
              <p className="text-muted-foreground text-sm leading-snug">
                Elige el proveedor para la vista de proyecto y el mapa del
                informe PDF. Los cambios se aplican al instante.
              </p>
            </div>
            <div className="space-y-2">
              {MAP_ENGINE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="border-border hover:bg-muted/40 flex cursor-pointer gap-3 rounded-lg border p-3"
                >
                  <input
                    type="radio"
                    name="map-engine"
                    checked={mapEngine === opt.id}
                    onChange={() => setMapEngine(opt.id)}
                    className="border-input text-primary focus-visible:ring-ring mt-1 size-4 shrink-0"
                  />
                  <span>
                    <span className="text-foreground font-medium">
                      {opt.title}
                    </span>
                    <span className="text-muted-foreground block text-xs leading-snug">
                      {opt.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-border space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label
                htmlFor="battery-saver"
                className="text-base font-medium"
              >
                Ahorro de batería (GPS)
              </Label>
              <p className="text-muted-foreground text-sm leading-snug">
                Usa señal de ubicación menos precisa (
                <span className="font-mono text-xs">enableHighAccuracy: false</span>
                ): menos consumo en capturas largas. Desactívalo cuando necesites
                máxima precisión en el vértice.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="battery-saver"
                type="checkbox"
                checked={batterySaverEnabled}
                onChange={(e) => setBatterySaverEnabled(e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring size-5 shrink-0 rounded border shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
              <span className="text-sm">
                {batterySaverEnabled
                  ? "Activado: GPS optimizado para autonomía."
                  : "Desactivado: máxima precisión GPS cuando la app la solicita."}
              </span>
            </div>
          </div>

          <div className="border-border space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label
                htmlFor="vertex-map-drag"
                className="text-base font-medium"
              >
                Mover vértices y POIs en el mapa
              </Label>
              <p className="text-muted-foreground text-sm leading-snug">
                Solo para pruebas: en la vista de proyecto podrás arrastrar
                vértices (P1, P2…) y marcadores de POI; la posición se guarda en
                Dexie. Los vértices usan método{" "}
                <span className="font-mono text-xs">manual_map</span>. Por
                defecto desactivado para no mover puntos por error en campo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="vertex-map-drag"
                type="checkbox"
                checked={allowVertexMapDrag}
                onChange={(e) => setAllowVertexMapDrag(e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring size-5 shrink-0 rounded border shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
              <span className="text-sm">
                {allowVertexMapDrag
                  ? "Activado: vértices y POIs con anillo ámbar y arrastre."
                  : "Desactivado"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapa offline (satélite)</CardTitle>
          <CardDescription>
            Descarga teselas de la vista actual para usar el fondo ESRI sin conexión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfflineMapDownloader />
        </CardContent>
      </Card>
    </div>
  );
}

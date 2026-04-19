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
import { FieldTestChecklist } from "@/components/settings/FieldTestChecklist";
import { SyncSettingsActions } from "@/components/settings/SyncSettingsActions";
import { useMapVertexDrag } from "@/components/providers/MapVertexDragPreference";
import { useBatterySaverControls } from "@/lib/hooks/useBatterySaver";

export default function SettingsPage() {
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

          <FieldTestChecklist />
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

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useMapVertexDrag } from "@/components/providers/MapVertexDragPreference";

export default function SettingsPage() {
  const { allowVertexMapDrag, setAllowVertexMapDrag } = useMapVertexDrag();

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
          <CardDescription>
            Preferencias locales en este dispositivo (Dexie no aplica aquí).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
    </div>
  );
}

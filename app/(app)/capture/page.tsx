"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHighAccuracyGpsDesired } from "@/lib/hooks/useBatterySaver";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useGPSAveraged } from "@/lib/hooks/useGPSAveraged";

function errorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return "Permiso denegado";
    case 2:
      return "Posición no disponible";
    case 3:
      return "Tiempo de espera agotado (en Mac prueba con Wi‑Fi y ubicación activa).";
    default:
      return err.message || "Error de geolocalización";
  }
}

export default function CapturePage() {
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const [captureTabVisible, setCaptureTabVisible] = useState(true);
  const highAccuracyGps = useHighAccuracyGpsDesired();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () =>
      setCaptureTabVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const geo = useGeolocation({
    watch: captureTabVisible,
    enableHighAccuracy: highAccuracyGps,
    maximumAge: 5_000,
    timeout: 20_000,
    requestReadingOverrides: {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 90_000,
    },
  });

  const averaged = useGPSAveraged({
    enableHighAccuracy: highAccuracyGps,
    maximumAge: 0,
    timeout: 15_000,
  });

  async function handleRequestReading() {
    setLastRequest(null);
    try {
      const r = await geo.requestReading();
      setLastRequest(
        `Lectura puntual OK (${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)})`,
      );
    } catch {
      setLastRequest("Lectura puntual falló (ver error abajo)");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Capturar</CardTitle>
          <CardDescription>
            Verificación tarea 1.6 (<code>useGeolocation</code>). Flujo de
            vértices: 1.8–1.9.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Cargando:{" "}
              <span className="text-foreground font-medium">
                {geo.isLoading ? "sí" : "no"}
              </span>
            </span>
            <span>
              Nivel precisión:{" "}
              <span className="text-foreground font-mono font-medium capitalize">
                {geo.accuracyLevel}
              </span>
            </span>
          </div>

          {geo.error ? (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage(geo.error)}
            </p>
          ) : null}

          {geo.reading ? (
            <dl className="font-mono text-xs leading-relaxed sm:text-sm">
              <div className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">Lat / Lng</dt>
                <dd>
                  {geo.reading.latitude.toFixed(6)},{" "}
                  {geo.reading.longitude.toFixed(6)}
                </dd>
                <dt className="text-muted-foreground">Precisión ±m</dt>
                <dd>{geo.reading.accuracy.toFixed(1)}</dd>
                <dt className="text-muted-foreground">Altitud (m)</dt>
                <dd>
                  {geo.reading.altitude != null
                    ? geo.reading.altitude.toFixed(1)
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Rumbo / Vel.</dt>
                <dd>
                  {geo.reading.heading != null
                    ? `${geo.reading.heading.toFixed(0)}°`
                    : "—"}{" "}
                  /{" "}
                  {geo.reading.speed != null
                    ? `${geo.reading.speed.toFixed(2)} m/s`
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : !geo.error ? (
            <p className="text-muted-foreground">
              Esperando señal GPS… (o permiso de ubicación)
            </p>
          ) : null}

          <Button type="button" onClick={() => void handleRequestReading()}>
            Forzar lectura puntual
          </Button>
          {lastRequest ? (
            <p className="text-muted-foreground text-xs">{lastRequest}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promediado GPS (1.7)</CardTitle>
          <CardDescription>
            <code>useGPSAveraged</code>: peso 1/accuracy². Objetivo 5 lecturas o
            tope 45 s (lo que ocurra primero).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Promediando:{" "}
              <span className="text-foreground font-medium">
                {averaged.isAveraging ? "sí" : "no"}
              </span>
            </span>
            <span>
              Lecturas:{" "}
              <span className="text-foreground font-mono font-medium">
                {averaged.readingsCount}
              </span>
            </span>
            <span>
              Progreso:{" "}
              <span className="text-foreground font-mono font-medium">
                {(averaged.progress * 100).toFixed(0)}%
              </span>
            </span>
          </div>

          <div
            className="bg-muted h-2 w-full overflow-hidden rounded-full"
            aria-hidden
          >
            <div
              className="bg-primary h-2 rounded-full transition-[width] duration-150"
              style={{ width: `${Math.round(averaged.progress * 100)}%` }}
            />
          </div>

          <Button
            type="button"
            disabled={averaged.isAveraging}
            onClick={() => averaged.startAveraging(5, 45_000)}
          >
            Iniciar promediado (5 / 45s)
          </Button>

          {averaged.averagedReading ? (
            <dl className="font-mono text-xs leading-relaxed sm:text-sm">
              <div className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">
                Resultado ponderado
              </div>
              <div className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1">
                <dt className="text-muted-foreground">Lat / Lng</dt>
                <dd>
                  {averaged.averagedReading.latitude.toFixed(6)},{" "}
                  {averaged.averagedReading.longitude.toFixed(6)}
                </dd>
                <dt className="text-muted-foreground">Precisión ±m</dt>
                <dd>{averaged.averagedReading.accuracy.toFixed(1)}</dd>
              </div>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MapPin, Wifi, WifiOff } from "lucide-react";

function accuracyLevel(
  m: number | null,
): "excellent" | "good" | "fair" | "poor" | "unknown" {
  if (m == null || Number.isNaN(m)) return "unknown";
  if (m < 3) return "excellent";
  if (m < 5) return "good";
  if (m < 10) return "fair";
  return "poor";
}

function accuracyColor(
  level: ReturnType<typeof accuracyLevel>,
): string {
  switch (level) {
    case "excellent":
      return "var(--gps-excellent)";
    case "good":
      return "var(--gps-good)";
    case "fair":
      return "var(--gps-fair)";
    case "poor":
      return "var(--gps-poor)";
    default:
      return "var(--muted-foreground)";
  }
}

export function TopBar() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracyM(pos.coords.accuracy ?? null);
      },
      () => setAccuracyM(null),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };
    if (!nav.getBattery) return;
    let cancelled = false;
    nav.getBattery().then((b) => {
      if (cancelled) return;
      setBatteryPct(Math.round(b.level * 100));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const level = accuracyLevel(accuracyM);

  return (
    <header className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <MapPin className="text-primary size-6 shrink-0" aria-hidden />
        <span className="text-foreground font-semibold tracking-tight">
          TerrainCapture
        </span>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1" title="Conexión (placeholder)">
          {online ? (
            <Wifi className="text-primary size-4" aria-hidden />
          ) : (
            <WifiOff className="size-4 text-[var(--gps-fair)]" aria-hidden />
          )}
          <span className="hidden sm:inline">{online ? "En línea" : "Sin red"}</span>
        </span>
        <span
          className="flex items-center gap-1 font-mono"
          style={{ color: accuracyColor(level) }}
          title="Precisión GPS estimada"
        >
          GPS{" "}
          {accuracyM != null ? `±${accuracyM.toFixed(0)} m` : "—"}
        </span>
        {batteryPct != null ? (
          <span className="font-mono" title="Batería">
            {batteryPct}%
          </span>
        ) : null}
      </div>
    </header>
  );
}

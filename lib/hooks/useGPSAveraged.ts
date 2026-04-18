"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { positionToReading, type GPSReading } from "./useGeolocation";

const MIN_SIGMA_M = 0.5;

function weightFromAccuracy(accuracyM: number): number {
  const sigma = Math.max(accuracyM, MIN_SIGMA_M);
  return 1 / (sigma * sigma);
}

/** Promedio ponderado con peso 1/σ²; precisión estimada 1/√(Σ 1/σ²). */
export function computeWeightedGpsAverage(readings: GPSReading[]): GPSReading {
  if (readings.length === 0) {
    throw new Error("computeWeightedGpsAverage: se requiere al menos una lectura");
  }
  if (readings.length === 1) {
    const only = readings[0];
    return { ...only, timestamp: Date.now() };
  }

  let wSum = 0;
  let latW = 0;
  let lngW = 0;
  let altWsum = 0;
  let altWeight = 0;
  let invVarSum = 0;

  for (const r of readings) {
    const w = weightFromAccuracy(r.accuracy);
    wSum += w;
    latW += r.latitude * w;
    lngW += r.longitude * w;
    const sigma = Math.max(r.accuracy, MIN_SIGMA_M);
    invVarSum += 1 / (sigma * sigma);
    if (r.altitude != null && Number.isFinite(r.altitude)) {
      altWsum += r.altitude * w;
      altWeight += w;
    }
  }

  const combinedAccuracy =
    invVarSum > 0 ? 1 / Math.sqrt(invVarSum) : readings[readings.length - 1].accuracy;

  return {
    latitude: latW / wSum,
    longitude: lngW / wSum,
    accuracy: combinedAccuracy,
    altitude: altWeight > 0 ? altWsum / altWeight : null,
    heading: null,
    speed: null,
    timestamp: Date.now(),
  };
}

type AveragingSession = {
  targetReadings: number;
  maxDurationMs: number;
  startedAt: number;
  readings: GPSReading[];
  watchId: number;
  deadlineId: ReturnType<typeof setTimeout>;
};

export interface UseGPSAveragedOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

export interface UseGPSAveragedReturn {
  isAveraging: boolean;
  progress: number;
  readingsCount: number;
  startAveraging: (targetReadings: number, maxDurationMs: number) => void;
  averagedReading: GPSReading | null;
}

function progressForSession(
  readingsLen: number,
  targetReadings: number,
  elapsedMs: number,
  maxDurationMs: number,
): number {
  const byReadings =
    targetReadings > 0 ? readingsLen / targetReadings : 0;
  const byTime = maxDurationMs > 0 ? elapsedMs / maxDurationMs : 0;
  return Math.min(1, Math.max(byReadings, byTime));
}

export function useGPSAveraged(
  options: UseGPSAveragedOptions = {},
): UseGPSAveragedReturn {
  const positionOptions = useMemo<PositionOptions>(
    () => ({
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: options.maximumAge ?? 0,
      timeout: options.timeout ?? 15_000,
    }),
    [options.enableHighAccuracy, options.maximumAge, options.timeout],
  );

  const [isAveraging, setIsAveraging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readingsCount, setReadingsCount] = useState(0);
  const [averagedReading, setAveragedReading] = useState<GPSReading | null>(null);

  const sessionRef = useRef<AveragingSession | null>(null);

  const stopSession = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(s.watchId);
    }
    clearTimeout(s.deadlineId);
    sessionRef.current = null;
  }, []);

  const finalizeSession = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;

    const list = s.readings.slice();
    stopSession();

    setIsAveraging(false);
    setProgress(1);
    setReadingsCount(list.length);

    if (list.length === 0) {
      setAveragedReading(null);
      setProgress(0);
      return;
    }
    setAveragedReading(computeWeightedGpsAverage(list));
  }, [stopSession]);

  const startAveraging = useCallback(
    (targetReadings: number, maxDurationMs: number) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setAveragedReading(null);
        setIsAveraging(false);
        setProgress(0);
        setReadingsCount(0);
        return;
      }

      const safeTarget = Math.max(1, Math.floor(targetReadings));
      const safeDuration = Math.max(1, Math.floor(maxDurationMs));

      stopSession();
      setAveragedReading(null);
      setIsAveraging(true);
      setProgress(0);
      setReadingsCount(0);

      const startedAt = performance.now();
      const readings: GPSReading[] = [];

      const deadlineId = setTimeout(() => {
        finalizeSession();
      }, safeDuration);

      const session: AveragingSession = {
        targetReadings: safeTarget,
        maxDurationMs: safeDuration,
        startedAt,
        readings,
        watchId: 0,
        deadlineId,
      };
      sessionRef.current = session;

      session.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const cur = sessionRef.current;
          if (!cur) return;

          const next = positionToReading(position);
          cur.readings.push(next);

          const elapsed = performance.now() - cur.startedAt;
          setReadingsCount(cur.readings.length);
          setProgress(
            progressForSession(
              cur.readings.length,
              cur.targetReadings,
              elapsed,
              cur.maxDurationMs,
            ),
          );

          if (cur.readings.length >= cur.targetReadings) {
            clearTimeout(cur.deadlineId);
            finalizeSession();
          }
        },
        () => {
          finalizeSession();
        },
        positionOptions,
      );
    },
    [finalizeSession, positionOptions, stopSession],
  );

  useEffect(() => () => stopSession(), [stopSession]);

  return {
    isAveraging,
    progress,
    readingsCount,
    startAveraging,
    averagedReading,
  };
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface GPSReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  /** `watchPosition` continuo vs solo lecturas bajo demanda */
  watch?: boolean;
  /**
   * Solo aplica a `requestReading` / `getCurrentPosition`.
   * En escritorio conviene `enableHighAccuracy: false` y `maximumAge` mayor (Wi‑Fi / caché).
   */
  requestReadingOverrides?: Partial<
    Pick<PositionOptions, "enableHighAccuracy" | "maximumAge" | "timeout">
  >;
}

export interface UseGeolocationReturn {
  reading: GPSReading | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
  accuracyLevel: "excellent" | "good" | "fair" | "poor" | "unknown";
  requestReading: () => Promise<GPSReading>;
}

export function positionToReading(position: GeolocationPosition): GPSReading {
  const c = position.coords;
  const heading =
    c.heading != null && Number.isFinite(c.heading) ? c.heading : null;
  const speed = c.speed != null && Number.isFinite(c.speed) ? c.speed : null;
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy,
    altitude: c.altitude ?? null,
    heading,
    speed,
    timestamp: position.timestamp,
  };
}

/** Umbrales alineados con PROJECT_SPEC.md (design system GPS). */
export function accuracyLevelFromMeters(
  m: number | null | undefined,
): UseGeolocationReturn["accuracyLevel"] {
  if (m == null || !Number.isFinite(m) || m <= 0) return "unknown";
  if (m < 3) return "excellent";
  if (m < 5) return "good";
  if (m < 10) return "fair";
  return "poor";
}

function syntheticPositionError(
  code: 1 | 2 | 3,
  message: string,
): GeolocationPositionError {
  return { code, message } as GeolocationPositionError;
}

function mergePositionOptions(
  opts: UseGeolocationOptions,
): PositionOptions {
  return {
    enableHighAccuracy: opts.enableHighAccuracy ?? true,
    maximumAge: opts.maximumAge ?? 0,
    timeout: opts.timeout ?? 15_000,
  };
}

function mergeRequestReadingOptions(opts: UseGeolocationOptions): PositionOptions {
  return {
    ...mergePositionOptions(opts),
    ...opts.requestReadingOverrides,
  };
}

export function useGeolocation(
  options: UseGeolocationOptions = {},
): UseGeolocationReturn {
  const { watch = false } = options;
  const positionOptions = useMemo(
    () => mergePositionOptions(options),
    [options.enableHighAccuracy, options.maximumAge, options.timeout],
  );

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [reading, setReading] = useState<GPSReading | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(watch));

  const requestReading = useCallback((): Promise<GPSReading> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        const err = syntheticPositionError(
          2,
          "Geolocation no disponible en este entorno",
        );
        setError(err);
        setIsLoading(false);
        reject(err);
        return;
      }

      setIsLoading(true);
      const readOpts = mergeRequestReadingOptions(optionsRef.current);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = positionToReading(position);
          setReading(next);
          setError(null);
          setIsLoading(false);
          resolve(next);
        },
        (err) => {
          setError(err);
          setIsLoading(false);
          reject(err);
        },
        readOpts,
      );
    });
  }, []);

  /** Permisos: en iOS Safari `permissions.query({ name: 'geolocation' })` suele fallar — no bloquear el flujo. */
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const geo = navigator.geolocation;
    if (!geo) {
      setError(
        syntheticPositionError(2, "Este navegador no expone Geolocation API"),
      );
      setIsLoading(false);
      return;
    }

    const permissions = navigator.permissions;
    if (!permissions?.query) return;

    let cancelled = false;
    let status: PermissionStatus | undefined;

    const applyPermissionState = () => {
      if (cancelled || !status) return;
      if (status.state === "denied") {
        setError(
          syntheticPositionError(
            1,
            "Permiso de ubicación denegado. Actívalo en Ajustes del sistema.",
          ),
        );
        setIsLoading(false);
      } else if (status.state === "granted") {
        setError(null);
      }
    };

    void (async () => {
      try {
        status = await permissions.query({
          name: "geolocation" as PermissionName,
        });
      } catch {
        // iOS / navegadores que no soportan query para geolocation
        return;
      }
      if (cancelled || !status) return;

      applyPermissionState();
      if (cancelled) return;
      status.addEventListener("change", applyPermissionState);
    })();

    return () => {
      cancelled = true;
      status?.removeEventListener("change", applyPermissionState);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    if (!watch) {
      return;
    }

    setIsLoading(true);
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setReading(positionToReading(position));
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        // TIMEOUT / POSITION_UNAVAILABLE en iOS a veces llega sin UI de permisos
        setError(err);
        setIsLoading(false);
      },
      positionOptions,
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, [watch, positionOptions]);

  const accuracyLevel = accuracyLevelFromMeters(reading?.accuracy);

  return {
    reading,
    error,
    isLoading,
    accuracyLevel,
    requestReading,
  };
}

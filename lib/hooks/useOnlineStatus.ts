"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Redes móviles lentas o al volver de segundo plano: evita falsos “sin Supabase”. */
const ACTIVE_TIMEOUT_MS = 6000;

function restProbeUrl(baseUrl: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  return `${b}/rest/v1/projects?select=id&limit=1`;
}

async function probeSupabaseReachable(): Promise<boolean> {
  const url =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : "";
  const anon =
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : "";
  if (!url || !anon) return navigator.onLine;

  const probeUrl = restProbeUrl(url);
  const headers: HeadersInit = {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    Accept: "application/json",
  };

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), ACTIVE_TIMEOUT_MS);
  try {
    const res = await fetch(probeUrl, {
      method: "GET",
      headers,
      signal: ac.signal,
      cache: "no-store",
    });
    /**
     * Cualquier respuesta HTTP indica que el host de Supabase es alcanzable.
     * Con RLS estricta, 401/403/404 son habituales; antes `res.ok` marcaba
     * “offline” y bloqueaba toda la cola de sync en móvil y escritorio.
     */
    await res.arrayBuffer();
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export type OnlineStatusDetail = {
  online: boolean;
  browserOnline: boolean;
  probing: boolean;
  lastActiveCheckAt: Date | null;
};

/**
 * `navigator.onLine` + comprobación activa a Supabase REST (timeout 3s).
 */
export function useOnlineStatus(activePollMs = 25_000): OnlineStatusDetail {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [activeOnline, setActiveOnline] = useState<boolean | null>(null);
  const [probing, setProbing] = useState(false);
  const [lastActiveCheckAt, setLastActiveCheckAt] = useState<Date | null>(null);

  const runProbe = useCallback(async () => {
    setProbing(true);
    try {
      const ok = await probeSupabaseReachable();
      setActiveOnline(ok);
      setLastActiveCheckAt(new Date());
    } finally {
      setProbing(false);
    }
  }, []);

  const envConfigured = useMemo(() => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return !!(u && k);
  }, []);

  useEffect(() => {
    const syncBrowser = () => setBrowserOnline(navigator.onLine);
    syncBrowser();
    window.addEventListener("online", syncBrowser);
    window.addEventListener("offline", syncBrowser);
    void runProbe();
    const poll = window.setInterval(() => void runProbe(), activePollMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void runProbe();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", syncBrowser);
      window.removeEventListener("offline", syncBrowser);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, [runProbe, activePollMs]);

  useEffect(() => {
    if (!browserOnline) {
      setActiveOnline(false);
      return;
    }
    if (envConfigured) void runProbe();
  }, [browserOnline, envConfigured, runProbe]);

  const online =
    browserOnline && (!envConfigured || activeOnline !== false);

  return {
    online,
    browserOnline,
    probing,
    lastActiveCheckAt,
  };
}

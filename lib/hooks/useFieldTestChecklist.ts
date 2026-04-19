"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "terrain_capture_field_test_v1";

/** Coincide con PROJECT_SPEC 5.5 — pruebas en campo (Huatulco). */
export const FIELD_TEST_ITEMS = [
  {
    id: "terrain_500sqm_signal",
    title: "Capturar un terreno de ~500 m² con señal",
    hint: "Validar GPS, fotos y cierre del polígono con datos.",
  },
  {
    id: "terrain_2ha_offline",
    title: "Capturar un terreno de ~2 hectáreas sin señal",
    hint: "Modo offline real: Dexie + cola de sync al volver cobertura.",
  },
  {
    id: "tape_accuracy",
    title: "Verificar precisión con cinta en un lado conocido",
    hint: "Comparar distancia calculada vs medición física.",
  },
  {
    id: "precache_capture_sync",
    title: "Pre-cachear zona, capturar sin datos, volver y verificar sync",
    hint: "Mapa offline + subidas pendientes resueltas.",
  },
  {
    id: "pdf_real_client",
    title: "Generar PDF del reporte y enviarlo a un cliente real",
    hint: "Flujo completo hasta compartir / correo / WhatsApp.",
  },
  {
    id: "battery_30min",
    title: "Medir consumo de batería en ~30 min de captura continua",
    hint: "Opcional: comparar con y sin ahorro de batería GPS.",
  },
  {
    id: "sunlight_ui",
    title: "Probar legibilidad bajo sol directo",
    hint: "Contraste, brillo de pantalla, lectura al aire libre.",
  },
] as const;

export type FieldTestItemId = (typeof FIELD_TEST_ITEMS)[number]["id"];

export function useFieldTestChecklist() {
  const [checked, setChecked] = useState<Partial<Record<FieldTestItemId, boolean>>>(
    {},
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
        setChecked(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Partial<Record<FieldTestItemId, boolean>>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }, []);

  const toggle = useCallback(
    (id: FieldTestItemId) => {
      setChecked((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setChecked({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const doneCount = FIELD_TEST_ITEMS.filter((item) => checked[item.id]).length;
  const total = FIELD_TEST_ITEMS.length;

  return { checked, toggle, reset, hydrated, doneCount, total };
}

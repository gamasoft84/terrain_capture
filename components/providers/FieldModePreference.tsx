"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getFieldModeServerSnapshot,
  getFieldModeSnapshot,
  subscribeFieldMode,
  writeFieldModeEnabled,
} from "@/lib/settings/fieldMode";

type Ctx = {
  fieldModeEnabled: boolean;
  setFieldModeEnabled: (value: boolean) => void;
};

const FieldModeContext = createContext<Ctx | null>(null);

export function FieldModePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const fieldModeEnabled = useSyncExternalStore(
    subscribeFieldMode,
    getFieldModeSnapshot,
    getFieldModeServerSnapshot,
  );

  const setFieldModeEnabled = useCallback((value: boolean) => {
    writeFieldModeEnabled(value);
  }, []);

  const value = useMemo(
    () => ({ fieldModeEnabled, setFieldModeEnabled }),
    [fieldModeEnabled, setFieldModeEnabled],
  );

  return (
    <FieldModeContext.Provider value={value}>
      {children}
    </FieldModeContext.Provider>
  );
}

export function useFieldMode(): Ctx {
  const ctx = useContext(FieldModeContext);
  if (!ctx) {
    throw new Error(
      "useFieldMode debe usarse dentro de FieldModePreferenceProvider",
    );
  }
  return ctx;
}


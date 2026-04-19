"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getDb } from "@/lib/db/schema";
import type { SyncEntityType } from "@/lib/db/sync";
import { recreateAfterRemoteDeletion } from "@/lib/db/sync/conflictResolution";

type ConflictItem = { entityType: SyncEntityType; localId: string };

const PRIORITY: SyncEntityType[] = [
  "project",
  "polygon",
  "vertex",
  "poi",
  "photo",
];

function entityLabel(t: SyncEntityType): string {
  switch (t) {
    case "project":
      return "proyecto";
    case "polygon":
      return "polígono";
    case "vertex":
      return "vértice";
    case "poi":
      return "punto de interés";
    case "photo":
      return "foto de galería";
    default:
      return "registro";
  }
}

function pickFirstConflict(
  projects: { localId: string }[] | undefined,
  polygons: { localId: string }[] | undefined,
  vertices: { localId: string }[] | undefined,
  pois: { localId: string }[] | undefined,
  photos: { localId: string }[] | undefined,
): ConflictItem | null {
  const map: Record<SyncEntityType, { localId: string }[]> = {
    project: projects ?? [],
    polygon: polygons ?? [],
    vertex: vertices ?? [],
    poi: pois ?? [],
    photo: photos ?? [],
  };
  for (const t of PRIORITY) {
    const row = map[t][0];
    if (row) return { entityType: t, localId: row.localId };
  }
  return null;
}

export function SyncConflictGate() {
  const [busy, setBusy] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const projects = useLiveQuery(
    () =>
      getDb()
        .projects.filter((p) => p.syncConflict === "remote_deleted")
        .toArray(),
    [],
  );
  const polygons = useLiveQuery(
    () =>
      getDb()
        .polygons.filter((p) => p.syncConflict === "remote_deleted")
        .toArray(),
    [],
  );
  const vertices = useLiveQuery(
    () =>
      getDb()
        .vertices.filter((v) => v.syncConflict === "remote_deleted")
        .toArray(),
    [],
  );
  const pois = useLiveQuery(
    () =>
      getDb().pois.filter((p) => p.syncConflict === "remote_deleted").toArray(),
    [],
  );
  const photos = useLiveQuery(
    () =>
      getDb()
        .projectPhotos.filter((p) => p.syncConflict === "remote_deleted")
        .toArray(),
    [],
  );

  const first = pickFirstConflict(projects, polygons, vertices, pois, photos);
  const firstKey = first ? `${first.entityType}:${first.localId}` : null;

  const open =
    first != null &&
    firstKey != null &&
    dismissedKey !== firstKey;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy && firstKey) setDismissedKey(firstKey);
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[min(88dvh,520px)] gap-0 rounded-t-xl"
        showCloseButton
      >
        {first ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>Sincronización: cambió en el servidor</SheetTitle>
              <SheetDescription className="text-left">
                Este {entityLabel(first.entityType)} ya no existe en el servidor
                (p. ej. fue borrado en otro lugar). Podés volver a crearlo como
                registro nuevo con los datos locales, o cerrar y decidir más
                tarde.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => {
                  if (firstKey) setDismissedKey(firstKey);
                }}
              >
                Ahora no
              </Button>
              <Button
                type="button"
                className="w-full sm:ml-auto sm:w-auto"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await recreateAfterRemoteDeletion(
                        first.entityType,
                        first.localId,
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {busy ? "Enviando…" : "Crear de nuevo en el servidor"}
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Camera, Hexagon, ImagePlus, Layers, MapPin } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useHighAccuracyGpsDesired } from "@/lib/hooks/useBatterySaver";
import {
  useGeolocation,
  type GPSReading,
} from "@/lib/hooks/useGeolocation";
import { useGPSAveraged } from "@/lib/hooks/useGPSAveraged";
import {
  createPolygon,
  listSubPolygonsByProject,
} from "@/lib/db/polygons";
import type { LocalPolygon } from "@/lib/db/schema";
import { SUB_POLYGON_COLOR_OPTIONS } from "@/lib/constants/subPolygonColors";
import { POIForm } from "@/components/capture/POIForm";
import { ProjectPhotoQuickForm } from "@/components/capture/ProjectPhotoQuickForm";
import { VertexBatchGalleryForm } from "@/components/capture/VertexBatchGalleryForm";
import { VertexForm } from "@/components/capture/VertexForm";

export interface CaptureButtonProps {
  /** Polígono principal (vértices del terreno). */
  polygonLocalId: string;
  projectLocalId: string;
  polygonIsClosed: boolean;
  disabled?: boolean;
  className?: string;
  captureSheetOpen?: boolean;
  onCaptureSheetOpenChange?: (open: boolean) => void;
  showFab?: boolean;
  /** Si es false, se oculta capturar vértice de sub-área (panel principal desactivó sub-áreas). */
  enableSubPolygonCapture?: boolean;
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return "Permiso de ubicación denegado.";
    case 2:
      return "Posición no disponible.";
    case 3:
      return "Tiempo de espera agotado. En Mac/interior el GPS por red puede tardar: activa ubicación precisa en Ajustes o prueba al aire libre / iPhone.";
    default:
      return err.message || "Error de GPS.";
  }
}

type CapturePhase =
  | "entity"
  | "subPick"
  | "subCreate"
  | "menu"
  | "quick"
  | "avg"
  | "form"
  | "photoForm"
  | "vertexBatch";

type CaptureEntity = "main_vertex" | "sub_vertex" | "poi" | "project_photo";

export function CaptureButton({
  polygonLocalId,
  projectLocalId,
  polygonIsClosed,
  disabled,
  className,
  captureSheetOpen: captureSheetOpenProp,
  onCaptureSheetOpenChange,
  showFab = true,
  enableSubPolygonCapture = true,
}: CaptureButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled =
    captureSheetOpenProp !== undefined &&
    onCaptureSheetOpenChange !== undefined;
  const open = controlled ? captureSheetOpenProp : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) {
        onCaptureSheetOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [controlled, onCaptureSheetOpenChange],
  );

  const [phase, setPhase] = useState<CapturePhase>("entity");
  const [captureEntity, setCaptureEntity] = useState<CaptureEntity | null>(
    null,
  );
  const [effectivePolygonLocalId, setEffectivePolygonLocalId] = useState<
    string | null
  >(null);
  const [effectivePolygonIsClosed, setEffectivePolygonIsClosed] =
    useState(false);
  const [subCreateName, setSubCreateName] = useState("Sub-área");
  const [subCreateColor, setSubCreateColor] = useState<string>(
    SUB_POLYGON_COLOR_OPTIONS[0],
  );

  const [geoError, setGeoError] = useState<string | null>(null);
  const [captureMethod, setCaptureMethod] = useState<
    "gps_single" | "gps_averaged"
  >("gps_single");
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);

  const subPolygons = useLiveQuery(
    async () => {
      if (typeof window === "undefined" || !open || !projectLocalId) {
        return [] as LocalPolygon[];
      }
      return listSubPolygonsByProject(projectLocalId);
    },
    [open, projectLocalId],
  );

  const highAccuracyGps = useHighAccuracyGpsDesired();

  const geo = useGeolocation({
    watch: phase === "avg",
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

  const resetFlow = useCallback(() => {
    setPhase("entity");
    setCaptureEntity(null);
    setEffectivePolygonLocalId(null);
    setEffectivePolygonIsClosed(false);
    setSubCreateName("Sub-área");
    setSubCreateColor(SUB_POLYGON_COLOR_OPTIONS[0]);
    setGeoError(null);
    setGpsReading(null);
    averaged.cancelAveraging();
  }, [averaged]);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      resetFlow();
    }
    prevOpenRef.current = open;
  }, [open, resetFlow]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetFlow();
    },
    [resetFlow, setOpen],
  );

  const startQuick = useCallback(() => {
    setGeoError(null);
    setCaptureMethod("gps_single");
    setPhase("quick");
    void geo
      .requestReading()
      .then((r) => {
        setGpsReading(r);
        setPhase("form");
      })
      .catch((e: unknown) => {
        if (e && typeof e === "object" && "code" in e) {
          setGeoError(geoErrorMessage(e as GeolocationPositionError));
        } else {
          setGeoError("No se pudo obtener la posición.");
        }
        setPhase("menu");
      });
  }, [geo]);

  const startAveraged = useCallback(() => {
    setGeoError(null);
    setCaptureMethod("gps_averaged");
    setPhase("avg");
    averaged.startAveraging(5, 45_000);
  }, [averaged]);

  useEffect(() => {
    if (phase !== "avg") return;
    if (averaged.isAveraging) return;
    const reading = averaged.averagedReading;
    queueMicrotask(() => {
      if (reading) {
        setGpsReading(reading);
        setPhase("form");
        return;
      }
      setGeoError(
        "No se obtuvieron lecturas GPS. Reintenta o usa captura rápida.",
      );
      setPhase("menu");
    });
  }, [phase, averaged.isAveraging, averaged.averagedReading]);

  const onSaved = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const pickMainVertex = useCallback(() => {
    setCaptureEntity("main_vertex");
    setEffectivePolygonLocalId(polygonLocalId);
    setEffectivePolygonIsClosed(polygonIsClosed);
    setPhase("menu");
  }, [polygonIsClosed, polygonLocalId]);

  const pickSubVertex = useCallback(() => {
    setCaptureEntity("sub_vertex");
    setPhase("subPick");
  }, []);

  const pickSubPolygon = useCallback((p: LocalPolygon) => {
    setEffectivePolygonLocalId(p.localId);
    setEffectivePolygonIsClosed(p.isClosed);
    setPhase("menu");
  }, []);

  const goSubCreate = useCallback(() => {
    setPhase("subCreate");
  }, []);

  const submitSubCreate = useCallback(async () => {
    const name = subCreateName.trim() || "Sub-área";
    try {
      const id = await createPolygon({
        projectLocalId,
        name,
        type: "sub",
        color: subCreateColor,
        isClosed: false,
      });
      setEffectivePolygonLocalId(id);
      setEffectivePolygonIsClosed(false);
      setPhase("menu");
    } catch {
      setGeoError("No se pudo crear el sub-polígono.");
    }
  }, [projectLocalId, subCreateColor, subCreateName]);

  const pickPoi = useCallback(() => {
    setCaptureEntity("poi");
    setPhase("menu");
  }, []);

  const pickProjectPhoto = useCallback(() => {
    setCaptureEntity("project_photo");
    setPhase("photoForm");
  }, []);

  const sheetTitle = (() => {
    switch (phase) {
      case "entity":
        return "¿Qué vas a capturar?";
      case "subPick":
        return "Sub-área";
      case "subCreate":
        return "Nuevo sub-polígono";
      case "photoForm":
        return "Foto adicional";
      case "vertexBatch":
        return "Vértices desde galería";
      case "form":
        return captureEntity === "poi"
          ? "Confirmar POI"
          : "Confirmar vértice";
      case "quick":
        return "Captura rápida";
      case "avg":
        return "Captura precisa";
      default:
        return "Posición GPS";
    }
  })();

  const sheetDescription = (() => {
    switch (phase) {
      case "entity":
        return "Elige el tipo de dato antes de leer el GPS (si aplica).";
      case "subPick":
        return "Selecciona un sub-polígono existente o crea uno nuevo.";
      case "subCreate":
        return "Nombre y color para dibujar luego sus vértices en el mapa.";
      case "photoForm":
        return "Sin obligación de GPS. Puedes añadir ubicación si quieres.";
      case "vertexBatch":
        return "Varias fotos con GPS en EXIF. Orden de izquierda a derecha: P1, P2…";
      case "avg":
        return "Promediando lecturas con peso 1/precisión².";
      default:
        return null;
    }
  })();

  const vertexTargetId =
    effectivePolygonLocalId ?? polygonLocalId;

  return (
    <>
      {showFab ? (
        <Button
          type="button"
          size="icon-lg"
          disabled={disabled}
          className={cn(
            "border-background fixed bottom-24 left-1/2 z-[35] size-16 -translate-x-1/2 rounded-full border-2 shadow-xl md:bottom-28",
            className,
          )}
          aria-label="Capturar"
          onClick={() => setOpen(true)}
        >
          <Camera className="size-8" />
        </Button>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[min(92dvh,720px)] gap-0 overflow-y-auto rounded-t-xl p-0"
          showCloseButton
        >
          <SheetHeader className="border-border border-b px-4 pt-4 pb-3 text-left">
            <SheetTitle>{sheetTitle}</SheetTitle>
            {sheetDescription ? (
              <SheetDescription className="text-left">
                {sheetDescription}
              </SheetDescription>
            ) : null}
          </SheetHeader>

          <div className="px-4 py-4">
            {geoError ? (
              <p className="text-destructive mb-4 text-sm" role="alert">
                {geoError}
              </p>
            ) : null}

            {phase === "entity" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                  onClick={pickMainVertex}
                >
                  <Hexagon className="size-5 shrink-0" aria-hidden />
                  <span className="text-sm font-medium">Vértice terreno principal</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Polígono del proyecto
                  </span>
                </Button>
                {enableSubPolygonCapture ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                    onClick={pickSubVertex}
                  >
                    <Layers className="size-5 shrink-0" aria-hidden />
                    <span className="text-sm font-medium">
                      Vértice de sub-área
                    </span>
                    <span className="text-muted-foreground text-xs font-normal">
                      Cabaña, pozo, etc.
                    </span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                  onClick={pickPoi}
                >
                  <MapPin className="size-5 shrink-0 text-amber-600" aria-hidden />
                  <span className="text-sm font-medium">Punto de interés (POI)</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Etiqueta libre + foto
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[4.5rem] flex-col gap-1 py-3 text-left"
                  onClick={pickProjectPhoto}
                >
                  <ImagePlus className="size-5 shrink-0" aria-hidden />
                  <span className="text-sm font-medium">Foto adicional</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Sin GPS obligatorio
                  </span>
                </Button>
              </div>
            ) : null}

            {phase === "subPick" ? (
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => setPhase("entity")}
                >
                  ← Cambiar tipo de captura
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={goSubCreate}
                >
                  Crear nuevo sub-polígono
                </Button>
                <div className="text-muted-foreground text-xs">
                  Sub-áreas existentes
                </div>
                {subPolygons === undefined ? (
                  <p className="text-muted-foreground text-sm">Cargando…</p>
                ) : subPolygons.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No hay sub-áreas todavía. Crea una con el botón de arriba.
                  </p>
                ) : (
                  <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                    {subPolygons.map((p) => (
                      <li key={p.localId}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-start gap-2 py-3"
                          onClick={() => pickSubPolygon(p)}
                        >
                          <span
                            className="size-3 shrink-0 rounded-full border"
                            style={{ backgroundColor: p.color }}
                            aria-hidden
                          />
                          <span className="truncate text-left">{p.name}</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {phase === "subCreate" ? (
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => setPhase("subPick")}
                >
                  ← Volver a la lista
                </Button>
                <div className="space-y-2">
                  <Label htmlFor="sub-create-name">Nombre</Label>
                  <Input
                    id="sub-create-name"
                    value={subCreateName}
                    onChange={(e) => setSubCreateName(e.target.value)}
                    placeholder="Cabaña, aljibe…"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Color</span>
                  <div className="flex flex-wrap gap-2">
                    {SUB_POLYGON_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "size-9 rounded-full border-2 transition-transform",
                          subCreateColor === c
                            ? "border-foreground scale-110"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                        onClick={() => setSubCreateColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void submitSubCreate()}
                >
                  Crear y continuar
                </Button>
              </div>
            ) : null}

            {phase === "menu" ? (
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground"
                  onClick={() => setPhase("entity")}
                >
                  ← Cambiar tipo de captura
                </Button>
                <Button
                  type="button"
                  className="h-12 w-full text-base"
                  onClick={startQuick}
                >
                  Captura rápida
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full text-base"
                  onClick={startAveraged}
                >
                  Captura precisa
                </Button>
                {captureEntity === "main_vertex" ||
                captureEntity === "sub_vertex" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full text-base"
                    onClick={() => setPhase("vertexBatch")}
                  >
                    Varias fotos (galería)
                  </Button>
                ) : null}
              </div>
            ) : null}

            {phase === "quick" ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
                <span className="border-primary size-10 animate-spin rounded-full border-2 border-t-transparent" />
                <p>Leyendo GPS…</p>
              </div>
            ) : null}

            {phase === "avg" ? (
              <div className="space-y-4 py-2">
                <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    Lecturas:{" "}
                    <span className="text-foreground font-mono font-medium">
                      {averaged.readingsCount}
                    </span>{" "}
                    / 5
                  </span>
                  <span>
                    Precisión actual:{" "}
                    <span className="text-foreground font-mono">
                      {geo.reading
                        ? `±${geo.reading.accuracy.toFixed(1)} m`
                        : "—"}
                    </span>
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-2 rounded-full transition-[width] duration-150"
                    style={{
                      width: `${Math.round(averaged.progress * 100)}%`,
                    }}
                  />
                </div>
                {averaged.isAveraging ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Mantén el teléfono estable hasta completar el promedio.
                  </p>
                ) : null}
              </div>
            ) : null}

            {phase === "form" && gpsReading ? (
              captureEntity === "poi" ? (
                <POIForm
                  gpsReading={gpsReading}
                  projectLocalId={projectLocalId}
                  onCancel={() => {
                    setPhase("menu");
                    setGpsReading(null);
                  }}
                  onSaved={onSaved}
                />
              ) : (
                <VertexForm
                  gpsReading={gpsReading}
                  captureMethod={captureMethod}
                  polygonLocalId={vertexTargetId}
                  projectLocalId={projectLocalId}
                  polygonIsClosed={effectivePolygonIsClosed}
                  onCancel={() => {
                    setPhase("menu");
                    setGpsReading(null);
                  }}
                  onSaved={onSaved}
                />
              )
            ) : null}

            {phase === "photoForm" ? (
              <ProjectPhotoQuickForm
                projectLocalId={projectLocalId}
                requestGpsReading={() => geo.requestReading()}
                onCancel={() => setPhase("entity")}
                onSaved={onSaved}
              />
            ) : null}

            {phase === "vertexBatch" ? (
              <VertexBatchGalleryForm
                polygonLocalId={vertexTargetId}
                projectLocalId={projectLocalId}
                polygonIsClosed={effectivePolygonIsClosed}
                onCancel={() => setPhase("menu")}
                onSaved={onSaved}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

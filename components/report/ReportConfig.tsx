"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LocalProject } from "@/lib/db/schema";
import {
  GAMASOFT_FOOTER_LINES,
  LEGAL_DISCLAIMER_ES,
  REPORT_SECTION_IDS,
  REPORT_SECTION_LABELS,
  type ReportGenerationPayload,
  type ReportSectionId,
  type ReportSectionsState,
  defaultReportSections,
} from "@/lib/report/config";

export type ReportPreviewContext = {
  mainAreaM2?: number | null;
  mainPerimeterM?: number | null;
  vertexCount?: number;
  poiCount?: number;
  galleryPhotoCount?: number;
  subPolygonCount?: number;
};

export interface ReportConfigProps {
  project: LocalProject;
  previewContext?: ReportPreviewContext;
  /** Si se definen, los botones dejan de estar deshabilitados (p. ej. al implementar 4.5–4.7). */
  onGeneratePdf?: (payload: ReportGenerationPayload) => void | Promise<void>;
  onGeneratePng?: (payload: ReportGenerationPayload) => void | Promise<void>;
  onShare?: (payload: ReportGenerationPayload) => void | Promise<void>;
}

function SectionToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: ReportSectionId;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const inputId = `report-section-${id}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="border-input text-primary focus-visible:ring-ring mt-1 size-4 shrink-0 rounded border shadow-xs focus-visible:ring-2 focus-visible:outline-none"
      />
      <Label htmlFor={inputId} className="cursor-pointer leading-snug font-normal">
        {label}
      </Label>
    </div>
  );
}

function ReportPreview({
  project,
  sections,
  clientName,
  surveyDate,
  executiveNotes,
  previewContext,
}: {
  project: LocalProject;
  sections: ReportSectionsState;
  clientName: string;
  surveyDate: string;
  executiveNotes: string;
  previewContext?: ReportPreviewContext;
}) {
  const activeList = useMemo(
    () =>
      REPORT_SECTION_IDS.filter((id) => sections[id]).map(
        (id) => REPORT_SECTION_LABELS[id],
      ),
    [sections],
  );

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Vista previa</CardTitle>
        <CardDescription>
          Resumen de lo que incluirá el informe (modo claro en PDF).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {sections.cover ? (
          <div className="bg-background border-border rounded-lg border p-4 shadow-sm">
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wide">
              Portada
            </div>
            <div className="mb-2 flex items-center gap-2">
              <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-md text-xs font-bold">
                G
              </div>
              <div>
                <p className="font-semibold">{project.name}</p>
                {project.locationLabel ? (
                  <p className="text-muted-foreground text-xs">
                    {project.locationLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">Logo Gamasoft · informe generado</p>
          </div>
        ) : null}

        {sections.client ? (
          <div className="rounded-md border bg-white p-3 text-gray-900 shadow-sm dark:bg-white dark:text-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Cliente
            </p>
            <p className="font-medium">
              {clientName.trim() || "— (sin nombre)"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Fecha del levantamiento: {surveyDate}
            </p>
          </div>
        ) : null}

        {executiveNotes.trim() ? (
          <div className="rounded-md border border-amber-200/80 bg-amber-50/90 p-3 text-gray-900 dark:bg-amber-50">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
              Notas ejecutivas
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">
              {executiveNotes.trim()}
            </p>
          </div>
        ) : null}

        {sections.map ? (
          <div className="rounded-md border bg-white p-3 text-gray-900 shadow-sm dark:bg-white dark:text-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Mapa
            </p>
            <div className="bg-muted/40 mt-2 flex aspect-[16/9] items-center justify-center rounded text-xs text-gray-500">
              Captura del mapa con polígono
            </div>
          </div>
        ) : null}

        {sections.stats ? (
          <div className="rounded-md border bg-white p-3 text-gray-900 shadow-sm dark:bg-white dark:text-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Estadísticas
            </p>
            <ul className="mt-2 grid gap-1 font-mono text-xs">
              <li>
                Área:{" "}
                {previewContext?.mainAreaM2 != null
                  ? `${previewContext.mainAreaM2.toFixed(1)} m²`
                  : "—"}
              </li>
              <li>
                Perímetro:{" "}
                {previewContext?.mainPerimeterM != null
                  ? `${previewContext.mainPerimeterM.toFixed(1)} m`
                  : "—"}
              </li>
              <li>
                Vértices:{" "}
                {previewContext?.vertexCount ?? "—"}
              </li>
            </ul>
          </div>
        ) : null}

        {sections.vertexTable ? (
          <p className="text-muted-foreground text-xs">
            Tabla de coordenadas de todos los vértices del polígono principal (y sub-polígonos si aplica).
          </p>
        ) : null}

        {sections.gallery ? (
          <p className="text-muted-foreground text-xs">
            Galería:{" "}
            {previewContext?.galleryPhotoCount != null
              ? `${previewContext.galleryPhotoCount} foto(s) con notas`
              : "fotos del proyecto con notas"}
          </p>
        ) : null}

        {sections.pois ? (
          <p className="text-muted-foreground text-xs">
            POIs:{" "}
            {previewContext?.poiCount != null
              ? `${previewContext.poiCount} punto(s) con foto y coordenadas`
              : "lista con foto y coordenadas"}
          </p>
        ) : null}

        {sections.subPolygons ? (
          <p className="text-muted-foreground text-xs">
            Sub-polígonos:{" "}
            {previewContext?.subPolygonCount != null
              ? `${previewContext.subPolygonCount} área(s) adicional(es)`
              : "datos por sub-área"}
          </p>
        ) : null}

        {sections.disclaimer ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-50 dark:text-gray-800">
            <p className="font-medium text-gray-900">Disclaimer</p>
            <p className="mt-1 leading-relaxed">{LEGAL_DISCLAIMER_ES}</p>
          </div>
        ) : null}

        {sections.footer ? (
          <div className="text-muted-foreground border-t pt-3 text-center text-[11px] leading-relaxed">
            {GAMASOFT_FOOTER_LINES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}

        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wide">
            Secciones incluidas ({activeList.length})
          </p>
          <ul className="text-muted-foreground max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-xs">
            {activeList.length > 0 ? (
              activeList.map((t) => <li key={t}>{t}</li>)
            ) : (
              <li>Ninguna — activá al menos una sección</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportConfig({
  project,
  previewContext,
  onGeneratePdf,
  onGeneratePng,
  onShare,
}: ReportConfigProps) {
  const [sections, setSections] = useState<ReportSectionsState>(
    defaultReportSections,
  );
  const [clientName, setClientName] = useState(
    () => project.clientName ?? "",
  );
  const [surveyDate, setSurveyDate] = useState(() =>
    format(project.updatedAt, "yyyy-MM-dd"),
  );
  const [executiveNotes, setExecutiveNotes] = useState("");
  const [actionBusy, setActionBusy] = useState<
    "pdf" | "png" | "share" | null
  >(null);

  const payload: ReportGenerationPayload = useMemo(
    () => ({
      sections,
      clientName,
      surveyDate,
      executiveNotes,
    }),
    [sections, clientName, surveyDate, executiveNotes],
  );

  const pdfReady = typeof onGeneratePdf === "function";
  const pngReady = typeof onGeneratePng === "function";
  const shareReady = typeof onShare === "function";

  const runAction = async (
    kind: "pdf" | "png" | "share",
    fn?: (p: ReportGenerationPayload) => void | Promise<void>,
  ) => {
    if (!fn) return;
    setActionBusy(kind);
    try {
      await fn(payload);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:items-start",
      )}
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Secciones del informe</CardTitle>
            <CardDescription>
              Elegí qué incluir en el PDF o PNG para el cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REPORT_SECTION_IDS.map((id) => (
              <SectionToggle
                key={id}
                id={id}
                label={REPORT_SECTION_LABELS[id]}
                checked={sections[id]}
                onCheckedChange={(next) =>
                  setSections((s) => ({ ...s, [id]: next }))
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos del encabezado</CardTitle>
            <CardDescription>
              Prellenados desde el proyecto; podés editarlos solo para este
              informe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-client">Nombre del cliente</Label>
              <Input
                id="report-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Cliente o razón social"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-date">Fecha del levantamiento</Label>
              <Input
                id="report-date"
                type="date"
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-notes">Notas ejecutivas</Label>
              <Textarea
                id="report-notes"
                value={executiveNotes}
                onChange={(e) => setExecutiveNotes(e.target.value)}
                placeholder="Contexto para el cliente, alcance del levantamiento…"
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!pdfReady || actionBusy != null}
              onClick={() => void runAction("pdf", onGeneratePdf)}
            >
              {actionBusy === "pdf"
                ? "Generando…"
                : "Generar PDF"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!pngReady || actionBusy != null}
              onClick={() => void runAction("png", onGeneratePng)}
            >
              {actionBusy === "png"
                ? "Generando…"
                : "Generar PNG"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!shareReady || actionBusy != null}
              onClick={() => void runAction("share", onShare)}
            >
              {actionBusy === "share"
                ? "Compartiendo…"
                : "Compartir"}
            </Button>
          </div>
          {!pdfReady && !pngReady && !shareReady ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Los botones se habilitan al conectar la generación de PDF (4.5), PNG
              (4.6) y compartir (4.7). La configuración ya queda lista para
              exportar.
            </p>
          ) : null}
        </div>
      </div>

      <div className="lg:sticky lg:top-20">
        <ReportPreview
          project={project}
          sections={sections}
          clientName={clientName}
          surveyDate={surveyDate}
          executiveNotes={executiveNotes}
          previewContext={previewContext}
        />
      </div>
    </div>
  );
}

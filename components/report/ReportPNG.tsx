"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useRef } from "react";
import type { LocalProject } from "@/lib/db/schema";
import {
  GAMASOFT_FOOTER_LINES,
  LEGAL_DISCLAIMER_ES,
  type ReportGenerationPayload,
} from "@/lib/report/config";

const W = 1080;
const H = 1920;
const MAP_H = Math.round(H * 0.4);

const COLORS = {
  jungle: "#022c22",
  emerald: "#059669",
  emeraldDeep: "#047857",
  amber: "#fbbf24",
  amberDeep: "#d97706",
  cream: "#fffbeb",
  ink: "#14532d",
  muted: "#6ee7b7",
};

export type TerrainReportPngInput = {
  payload: ReportGenerationPayload;
  project: LocalProject;
  mainAreaM2: number | null;
  mainPerimeterM: number | null;
  vertexCount: number;
  mapImageDataUrl: string | null;
  /** Cuatro miniaturas (null = hueco). */
  galleryImages: readonly { src: string | null }[];
};

function formatMxNumber(n: number | null, suffix: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${suffix}`;
}

function formatSurveyLabel(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "d MMMM yyyy", { locale: es });
  } catch {
    return isoDate;
  }
}

/** Tarjeta vertical 1080×1920 para captura html-to-image (historia WhatsApp). */
export function TerrainReportPngTemplate({
  input,
}: {
  input: TerrainReportPngInput;
}) {
  const { payload, project } = input;
  const s = payload.sections;
  const client =
    payload.clientName.trim() || project.clientName?.trim() || "Cliente";
  const gallery = [...input.galleryImages].slice(0, 4);
  while (gallery.length < 4) gallery.push({ src: null });

  const areaBig =
    s.stats && input.mainAreaM2 != null && Number.isFinite(input.mainAreaM2)
      ? input.mainAreaM2.toLocaleString("es-MX", {
          maximumFractionDigits: 1,
        })
      : null;
  const perimeterLabel = s.stats
    ? formatMxNumber(input.mainPerimeterM, "m")
    : "—";
  const vertexLabel = s.stats ? String(input.vertexCount) : "—";

  const mapSrc = s.map ? input.mapImageDataUrl : null;

  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        background: `linear-gradient(165deg, ${COLORS.emeraldDeep} 0%, ${COLORS.jungle} 55%, #03150f 100%)`,
        color: "#ecfdf5",
      }}
    >
      <div
        style={{
          height: MAP_H,
          width: "100%",
          flexShrink: 0,
          position: "relative",
          backgroundColor: COLORS.jungle,
        }}
      >
        {mapSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs / URLs para PNG estático
          <img
            alt=""
            src={mapSrc}
            width={W}
            height={MAP_H}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${COLORS.emerald} 0%, ${COLORS.jungle} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 48,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: COLORS.amber,
                textShadow: "0 2px 12px rgba(0,0,0,0.35)",
              }}
            >
              {s.map ? "Mapa no disponible" : "Mapa no incluido"}
            </span>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background:
              "linear-gradient(to top, rgba(3,21,15,0.92), transparent)",
            pointerEvents: "none",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          padding: "36px 44px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          minHeight: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: COLORS.amber,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            TerrainCapture
          </div>
          <div
            style={{
              fontSize: 46,
              fontWeight: 900,
              lineHeight: 1.1,
              color: "#fff",
              textShadow: "0 2px 18px rgba(0,0,0,0.35)",
            }}
          >
            {project.name}
          </div>
          {project.locationLabel ? (
            <div style={{ marginTop: 10, fontSize: 26, color: COLORS.muted }}>
              {project.locationLabel}
            </div>
          ) : null}
          <div style={{ marginTop: 14, fontSize: 24, color: "#d1fae5" }}>
            {client}
            {" · "}
            {formatSurveyLabel(payload.surveyDate)}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: "28px 24px",
            borderRadius: 20,
            background: `linear-gradient(135deg, ${COLORS.cream} 0%, #fde68a 100%)`,
            border: `4px solid ${COLORS.amber}`,
            boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: COLORS.ink,
              letterSpacing: 2,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            ÁREA TOTAL
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: COLORS.emeraldDeep,
              textAlign: "center",
              lineHeight: 1,
              textShadow: "0 2px 0 rgba(255,255,255,0.4)",
            }}
          >
            {areaBig ?? "—"}
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: areaBig ? 32 : 26,
              fontWeight: 800,
              color: COLORS.amberDeep,
              marginTop: 8,
            }}
          >
            {areaBig ? "m²" : "—"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 16,
            justifyContent: "space-between",
          }}
        >
          {[
            { k: "Vértices", v: vertexLabel },
            { k: "Perímetro", v: perimeterLabel },
          ].map(({ k, v }) => (
            <div
              key={k}
              style={{
                flex: 1,
                padding: "18px 14px",
                borderRadius: 16,
                backgroundColor: "rgba(6,95,70,0.55)",
                border: "2px solid rgba(251,191,36,0.65)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18, color: COLORS.amber, fontWeight: 700 }}>
                {k}
              </div>
              <div
                style={{
                  fontSize: k === "Vértices" ? 40 : 28,
                  fontWeight: 900,
                  marginTop: 8,
                  color: "#fff",
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 4, flex: 1, minHeight: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: COLORS.amber,
              marginBottom: 12,
              letterSpacing: 1,
            }}
          >
            GALERÍA
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 14,
              height: 340,
            }}
          >
            {gallery.map((g, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "rgba(0,0,0,0.25)",
                  border: "2px solid rgba(251,191,36,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.gallery && g.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    src={g.src}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 22, color: COLORS.muted }}>
                    {s.gallery ? "—" : "No incl."}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {s.disclaimer ? (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.35,
              color: "rgba(236,253,245,0.78)",
              marginTop: 4,
            }}
          >
            {LEGAL_DISCLAIMER_ES}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "2px solid rgba(251,191,36,0.35)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.amber} 0%, ${COLORS.amberDeep} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: COLORS.ink,
              flexShrink: 0,
            }}
          >
            G
          </div>
          <div style={{ flex: 1 }}>
            {s.footer ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                  {GAMASOFT_FOOTER_LINES[0]}
                </div>
                <div style={{ fontSize: 18, color: COLORS.muted }}>
                  {GAMASOFT_FOOTER_LINES[1]}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.muted }}>
                TerrainCapture
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function buildTerrainReportPngFilename(
  projectName: string,
  date: Date,
): string {
  const safe = projectName
    .trim()
    .replaceAll(/[/\\?%*:|"<>]/g, "_")
    .replaceAll(/\s+/g, "_")
    .slice(0, 72);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const base = safe.length > 0 ? safe : "reporte";
  return `${base}_${y}-${m}-${d}_whatsapp.png`;
}

export function triggerDownloadTerrainReportPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Monta la plantilla fuera de pantalla y devuelve un PNG (Blob) vía html-to-image.
 */
export function ReportPngExportHost({
  sessionKey,
  input,
  onDone,
}: {
  sessionKey: number;
  input: TerrainReportPngInput;
  onDone: (blob: Blob | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;

    const finish = (blob: Blob | null) => {
      if (!cancelled) onDoneRef.current(blob);
    };

    (async () => {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      await new Promise<void>((r) => setTimeout(r, 220));
      const el = wrapRef.current;
      if (!el) {
        finish(null);
        return;
      }
      const imgs = [...el.querySelectorAll("img")];
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            }),
        ),
      );
      try {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(el, {
          pixelRatio: 1,
          cacheBust: true,
          backgroundColor: COLORS.jungle,
          width: W,
          height: H,
        });
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        finish(blob);
      } catch {
        finish(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  return (
    <div
      className="pointer-events-none fixed top-0 left-[-99999px] z-[401] overflow-hidden"
      aria-hidden
    >
      <div ref={wrapRef}>
        <TerrainReportPngTemplate input={input} />
      </div>
    </div>
  );
}

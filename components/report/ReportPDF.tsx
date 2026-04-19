import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { JSX } from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { SubPolygonMapLayer } from "@/components/map/MapCanvas";
import type {
  LocalPOI,
  LocalPolygon,
  LocalProject,
  LocalVertex,
} from "@/lib/db/schema";
import type { ProjectGalleryItem } from "@/lib/gallery/collectProjectGallery";
import {
  GAMASOFT_FOOTER_LINES,
  LEGAL_DISCLAIMER_ES,
  type ReportGenerationPayload,
} from "@/lib/report/config";
import {
  hydrateGalleryForPdf,
  type HydratedGalleryItem,
} from "@/lib/report/pdfHydrate";

const COLORS = {
  forest: "#14532d",
  amber: "#b45309",
  ink: "#1c1917",
  muted: "#78716c",
  border: "#e7e5e4",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.ink,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: COLORS.forest,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.forest,
    marginBottom: 10,
    marginTop: 4,
  },
  brandBox: {
    display: "flex",
    width: 44,
    height: 44,
    backgroundColor: "#dcfce7",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brandLetter: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.forest,
  },
  mapImage: {
    width: "100%",
    maxHeight: 320,
    objectFit: "contain",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.forest,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  cellSm: { width: "12%", fontSize: 8 },
  cellMd: { width: "22%", fontSize: 8 },
  cellGrow: { flex: 1, fontSize: 8 },
  galleryGrid: {
    marginTop: 8,
    width: "100%",
  },
  galleryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 14,
  },
  galleryCell: {
    width: "48%",
  },
  galleryImg: {
    width: "100%",
    height: 100,
    objectFit: "cover",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  caption: {
    fontSize: 7,
    color: COLORS.muted,
    lineHeight: 1.25,
  },
  footerAbs: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  footerLine: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
  },
  footerCompany: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 9,
    lineHeight: 1.45,
    color: COLORS.ink,
    backgroundColor: "#fafaf9",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

export type TerrainReportPdfInput = {
  payload: ReportGenerationPayload;
  project: LocalProject;
  mainPolygon: LocalPolygon | null;
  mainVertices: LocalVertex[];
  subLayers: SubPolygonMapLayer[];
  pois: LocalPOI[];
  galleryItems: ProjectGalleryItem[];
  /** PNG data URL del mapa (opcional si sección map desactivada o falló captura). */
  mapImageDataUrl?: string | null;
};

type VertexRow = {
  polygon: string;
  vi: number;
  lat: number;
  lng: number;
  acc?: number;
  alt?: number;
  note?: string;
};

function buildVertexRows(
  mainPolygon: LocalPolygon | null,
  mainVertices: LocalVertex[],
  subLayers: SubPolygonMapLayer[],
): VertexRow[] {
  const rows: VertexRow[] = [];
  if (mainPolygon) {
    const sorted = [...mainVertices].sort((a, b) => a.orderIndex - b.orderIndex);
    sorted.forEach((v, i) => {
      rows.push({
        polygon:
          mainPolygon.type === "main"
            ? "Principal"
            : mainPolygon.name,
        vi: i + 1,
        lat: v.latitude,
        lng: v.longitude,
        acc: v.gpsAccuracyM,
        alt: v.altitudeM,
        note: v.note,
      });
    });
  }
  for (const layer of subLayers) {
    const sorted = [...layer.vertices].sort((a, b) => a.orderIndex - b.orderIndex);
    sorted.forEach((v, i) => {
      rows.push({
        polygon: layer.polygon.name,
        vi: i + 1,
        lat: v.latitude,
        lng: v.longitude,
        acc: v.gpsAccuracyM,
        alt: v.altitudeM,
        note: v.note,
      });
    });
  }
  return rows;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Dos columnas por fila: flexWrap + % en @react-pdf suele recortar o perder filas. */
function chunkPairs<T>(arr: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    rows.push(arr.slice(i, i + 2));
  }
  return rows;
}

function Footer({
  showFooterSection,
}: {
  showFooterSection: boolean;
}) {
  return (
    <View style={styles.footerAbs} fixed>
      <Text
        style={styles.footerLine}
        render={({ pageNumber, totalPages }) =>
          `TerrainCapture · ${pageNumber} / ${totalPages}`
        }
      />
      {showFooterSection
        ? GAMASOFT_FOOTER_LINES.map((line) => (
            <Text key={line} style={styles.footerCompany}>
              {line}
            </Text>
          ))
        : null}
    </View>
  );
}

function TerrainReportDocumentInner({
  input,
  hydratedGallery,
}: {
  input: TerrainReportPdfInput;
  hydratedGallery: HydratedGalleryItem[];
}) {
  const { payload, project, mainPolygon, mainVertices, subLayers, pois } =
    input;
  const s = payload.sections;

  let surveyLabel = payload.surveyDate;
  try {
    surveyLabel = format(parseISO(payload.surveyDate), "PPP", {
      locale: es,
    });
  } catch {
    /* fecha manual inválida */
  }

  const vertexRows = buildVertexRows(
    mainPolygon,
    mainVertices,
    subLayers,
  );
  const vertexPages = chunk(vertexRows, 24);
  const galleryChunks =
    s.gallery && hydratedGallery.length > 0
      ? chunk(hydratedGallery, 6)
      : [];

  const pages: JSX.Element[] = [];

  if (s.cover) {
    pages.push(
      <Page key="cover" size="A4" style={styles.page}>
        <View style={styles.brandBox}>
          <Text style={styles.brandLetter}>G</Text>
        </View>
        <Text style={styles.title}>{project.name}</Text>
        {project.locationLabel ? (
          <Text style={styles.subtitle}>{project.locationLabel}</Text>
        ) : null}
        <Text style={styles.subtitle}>Informe · {surveyLabel}</Text>
        {payload.executiveNotes.trim() ? (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>
              Notas ejecutivas
            </Text>
            <Text style={{ fontSize: 10, lineHeight: 1.45 }}>
              {payload.executiveNotes.trim()}
            </Text>
          </View>
        ) : null}
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.client) {
    pages.push(
      <Page key="client" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Datos del cliente</Text>
        <Text style={{ marginBottom: 4 }}>
          Cliente: {payload.clientName.trim() || "—"}
        </Text>
        <Text style={styles.subtitle}>Levantamiento: {surveyLabel}</Text>
        {project.clientContact ? (
          <Text style={{ marginTop: 8, fontSize: 9 }}>
            Contacto (proyecto): {project.clientContact}
          </Text>
        ) : null}
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.map) {
    pages.push(
      <Page key="map" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Mapa del levantamiento</Text>
        {input.mapImageDataUrl ? (
          <Image src={input.mapImageDataUrl} style={styles.mapImage} />
        ) : (
          <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
            Captura de mapa no disponible (sin tile o error al generar imagen).
          </Text>
        )}
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.stats) {
    pages.push(
      <Page key="stats" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View>
          <Text style={{ marginBottom: 6 }}>
            Área (principal):{" "}
            {mainPolygon?.areaM2 != null
              ? `${mainPolygon.areaM2.toFixed(1)} m²`
              : "—"}
          </Text>
          <Text style={{ marginBottom: 6 }}>
            Perímetro (principal):{" "}
            {mainPolygon?.perimeterM != null
              ? `${mainPolygon.perimeterM.toFixed(1)} m`
              : "—"}
          </Text>
          <Text style={{ marginBottom: 6 }}>
            Vértices (levantados): {vertexRows.length}
          </Text>
          <Text style={{ marginBottom: 6 }}>
            Puntos de interés: {pois.length}
          </Text>
          <Text style={{ marginBottom: 6 }}>
            Sub-polígonos: {subLayers.length}
          </Text>
        </View>
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.vertexTable) {
    if (vertexPages.length === 0) {
      pages.push(
        <Page key="vertices-empty" size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Coordenadas de vértices</Text>
          <Text style={{ color: COLORS.muted }}>Sin vértices registrados.</Text>
          <Footer showFooterSection={s.footer} />
        </Page>,
      );
    }
    vertexPages.forEach((part, pi) => {
      pages.push(
        <Page key={`vert-${pi}`} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>
            Coordenadas de vértices
            {vertexPages.length > 1 ? ` (${pi + 1}/${vertexPages.length})` : ""}
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.cellSm, { fontFamily: "Helvetica-Bold" }]}>
              Polígono
            </Text>
            <Text style={[styles.cellSm, { fontFamily: "Helvetica-Bold" }]}>
              P#
            </Text>
            <Text style={[styles.cellMd, { fontFamily: "Helvetica-Bold" }]}>
              Lat
            </Text>
            <Text style={[styles.cellMd, { fontFamily: "Helvetica-Bold" }]}>
              Lng
            </Text>
            <Text style={[styles.cellSm, { fontFamily: "Helvetica-Bold" }]}>
              ±m
            </Text>
            <Text style={[styles.cellSm, { fontFamily: "Helvetica-Bold" }]}>
              Alt
            </Text>
            <Text style={[styles.cellGrow, { fontFamily: "Helvetica-Bold" }]}>
              Nota
            </Text>
          </View>
          {part.map((r, i) => (
            <View
              key={`${r.polygon}-${r.vi}-${i}`}
              style={styles.tableRow}
              wrap={false}
            >
              <Text style={styles.cellSm}>{r.polygon}</Text>
              <Text style={styles.cellSm}>{r.vi}</Text>
              <Text style={styles.cellMd}>{r.lat.toFixed(6)}</Text>
              <Text style={styles.cellMd}>{r.lng.toFixed(6)}</Text>
              <Text style={styles.cellSm}>
                {r.acc != null ? r.acc.toFixed(1) : "—"}
              </Text>
              <Text style={styles.cellSm}>
                {r.alt != null ? r.alt.toFixed(1) : "—"}
              </Text>
              <Text style={styles.cellGrow}>{r.note ?? ""}</Text>
            </View>
          ))}
          <Footer showFooterSection={s.footer} />
        </Page>,
      );
    });
  }

  if (s.gallery) {
    if (galleryChunks.length === 0) {
      pages.push(
        <Page key="gallery-empty" size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Galería</Text>
          <Text style={{ color: COLORS.muted }}>Sin fotos en el proyecto.</Text>
          <Footer showFooterSection={s.footer} />
        </Page>,
      );
    } else {
      galleryChunks.forEach((part, gi) => {
        pages.push(
          <Page key={`gal-${gi}`} size="A4" style={styles.page}>
            <Text style={styles.sectionTitle}>
              Galería
              {galleryChunks.length > 1
                ? ` (${gi + 1}/${galleryChunks.length})`
                : ""}
            </Text>
            <View style={styles.galleryGrid}>
              {chunkPairs(part).map((row, ri) => (
                <View
                  key={`gallery-row-${gi}-${ri}`}
                  style={styles.galleryRow}
                  wrap={false}
                >
                  {row.map((g, idx) => (
                    <View
                      key={`gal-${gi}-${ri}-${idx}-${g.originLabel}`}
                      style={styles.galleryCell}
                      wrap={false}
                    >
                      {g.src ? (
                        <Image src={g.src} style={styles.galleryImg} />
                      ) : (
                        <View
                          style={[
                            styles.galleryImg,
                            {
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#f5f5f4",
                            },
                          ]}
                          wrap={false}
                        >
                          <Text style={{ fontSize: 7, color: COLORS.muted }}>
                            Sin imagen
                          </Text>
                        </View>
                      )}
                      <Text style={styles.caption}>{g.originLabel}</Text>
                      {g.caption ? (
                        <Text style={styles.caption}>{g.caption}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <Footer showFooterSection={s.footer} />
          </Page>,
        );
      });
    }
  }

  if (s.pois) {
    pages.push(
      <Page key="pois" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Puntos de interés</Text>
        {pois.length === 0 ? (
          <Text style={{ color: COLORS.muted }}>Sin POIs en el proyecto.</Text>
        ) : null}
        {pois.map((p) => (
          <View
            key={p.localId}
            style={{
              marginBottom: 10,
              paddingBottom: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: COLORS.border,
            }}
            wrap={false}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
              {p.label}
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.muted }}>
              {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
              {p.gpsAccuracyM != null
                ? ` · ±${p.gpsAccuracyM.toFixed(1)} m`
                : ""}
            </Text>
            {p.note?.trim() ? (
              <Text style={{ marginTop: 4, fontSize: 9 }}>{p.note.trim()}</Text>
            ) : null}
          </View>
        ))}
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.subPolygons) {
    pages.push(
      <Page key="subs" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Sub-polígonos</Text>
        {subLayers.length === 0 ? (
          <Text style={{ color: COLORS.muted }}>
            Sin sub-polígonos definidos.
          </Text>
        ) : null}
        {subLayers.map((layer) => (
          <View
            key={layer.polygon.localId}
            style={{
              marginBottom: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 4,
            }}
            wrap={false}
          >
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
              {layer.polygon.name}
            </Text>
            <Text>Vértices: {layer.vertices.length}</Text>
            <Text>
              Área:{" "}
              {layer.polygon.areaM2 != null
                ? `${layer.polygon.areaM2.toFixed(1)} m²`
                : "—"}
            </Text>
            <Text>
              Perímetro:{" "}
              {layer.polygon.perimeterM != null
                ? `${layer.polygon.perimeterM.toFixed(1)} m`
                : "—"}
            </Text>
            <Text>Cerrado: {layer.polygon.isClosed ? "Sí" : "No"}</Text>
          </View>
        ))}
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (s.disclaimer) {
    pages.push(
      <Page key="legal" size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Aviso legal</Text>
        <Text style={styles.disclaimer}>{LEGAL_DISCLAIMER_ES}</Text>
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  if (pages.length === 0) {
    pages.push(
      <Page key="empty" size="A4" style={styles.page}>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={{ color: COLORS.muted, marginTop: 12 }}>
          Ninguna sección seleccionada. Volvé a la configuración y activá al
          menos una opción.
        </Text>
        <Footer showFooterSection={s.footer} />
      </Page>,
    );
  }

  return <Document>{pages}</Document>;
}

export function TerrainReportDocument({
  input,
  hydratedGallery,
}: {
  input: TerrainReportPdfInput;
  hydratedGallery: HydratedGalleryItem[];
}) {
  return (
    <TerrainReportDocumentInner
      input={input}
      hydratedGallery={hydratedGallery}
    />
  );
}

export async function generateTerrainReportPdfBlob(
  input: TerrainReportPdfInput,
): Promise<Blob> {
  const hydratedGallery =
    input.payload.sections.gallery && input.galleryItems.length > 0
      ? await hydrateGalleryForPdf(input.galleryItems)
      : [];
  const doc = (
    <TerrainReportDocument
      input={input}
      hydratedGallery={hydratedGallery}
    />
  );
  return pdf(doc).toBlob();
}

export function buildTerrainReportPdfFilename(
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
  const base = safe.length > 0 ? safe : "informe";
  return `${base}_${y}-${m}-${d}_informe.pdf`;
}

export async function downloadTerrainReportPdf(
  input: TerrainReportPdfInput,
): Promise<void> {
  const blob = await generateTerrainReportPdfBlob(input);
  const filename = buildTerrainReportPdfFilename(input.project.name, new Date());
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

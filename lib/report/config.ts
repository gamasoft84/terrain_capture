/** Opciones de sección para informes (PDF/PNG posteriores). */

export const REPORT_SECTION_IDS = [
  "cover",
  "client",
  "map",
  "stats",
  "vertexTable",
  "gallery",
  "pois",
  "subPolygons",
  "disclaimer",
  "footer",
] as const;

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

export type ReportSectionsState = Record<ReportSectionId, boolean>;

export const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  cover: "Portada con logo Gamasoft y nombre proyecto",
  client: "Datos del cliente",
  map: "Mapa con polígono (captura del mapa)",
  stats: "Estadísticas (área, perímetro, vértices)",
  vertexTable: "Tabla de coordenadas de vértices",
  gallery: "Galería de fotos con notas",
  pois: "Lista de POIs con fotos y coordenadas",
  subPolygons: "Sub-polígonos con sus datos",
  disclaimer:
    'Disclaimer legal ("estimación, no sustituye topografía certificada")',
  footer: "Footer con datos de contacto Gamasoft",
};

export function defaultReportSections(): ReportSectionsState {
  const o = {} as ReportSectionsState;
  for (const id of REPORT_SECTION_IDS) o[id] = true;
  return o;
}

export const LEGAL_DISCLAIMER_ES =
  "Los datos son estimaciones basadas en GPS de uso general y no sustituyen un levantamiento topográfico certificado.";

/** Texto de pie para vista previa; ajustar dominio cuando esté en producción. */
export const GAMASOFT_FOOTER_LINES = [
  "Gamasoft IA Technologies S.A.S.",
  "TerrainCapture · informes para clientes",
] as const;

export type ReportGenerationPayload = {
  sections: ReportSectionsState;
  clientName: string;
  surveyDate: string;
  executiveNotes: string;
};

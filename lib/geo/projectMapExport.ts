import { downloadProjectCsv } from "@/lib/geo/csv";
import { downloadProjectGeoJson } from "@/lib/geo/geojson";
import { downloadProjectZip } from "@/lib/geo/zip";
import {
  downloadProjectKml,
  loadProjectForKmlExport,
  type KmlProjectInput,
} from "@/lib/geo/kml";

/** Formatos espaciales descargables desde la vista de mapa (misma carga que KML). */
export type ProjectMapExportFormat = "kml" | "geojson" | "csv" | "zip";

/** Carga proyecto + polígonos + POIs para export (alias semántico). */
export async function loadProjectMapExportInput(
  projectLocalId: string,
): Promise<KmlProjectInput | null> {
  return loadProjectForKmlExport(projectLocalId);
}

export async function runProjectMapExport(
  format: ProjectMapExportFormat,
  input: KmlProjectInput,
): Promise<void> {
  switch (format) {
    case "kml":
      await downloadProjectKml(input);
      return;
    case "geojson":
      await downloadProjectGeoJson(input);
      return;
    case "csv":
      await downloadProjectCsv(input);
      return;
    case "zip":
      await downloadProjectZip(input);
      return;
  }
}

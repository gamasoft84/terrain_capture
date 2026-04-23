import type { LocalProject } from "@/lib/db/schema";

const LABELS: Record<LocalProject["status"], string> = {
  draft: "Borrador",
  in_progress: "En curso",
  completed: "Completado",
  shared: "Compartido",
};

/** Texto corto para badges y listas. */
export function projectStatusLabelEs(
  status: LocalProject["status"],
): string {
  return LABELS[status] ?? status;
}

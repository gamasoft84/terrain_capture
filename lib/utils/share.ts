/** Descarga un blob en el navegador (fallback cuando no hay Web Share API). */
export function downloadBlob(blob: Blob, filename: string): void {
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

function blobToShareFile(blob: Blob, filename: string): File {
  const type =
    blob.type && blob.type.length > 0 ? blob.type : "application/octet-stream";
  return new File([blob], filename, { type, lastModified: Date.now() });
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: string }).name === "AbortError"
  );
}

/**
 * Intenta compartir un archivo con la Web Share API (ideal en iOS Safari).
 * Si no está disponible o falla, descarga el archivo y abre WhatsApp Web con el texto.
 */
export async function shareReport(
  blob: Blob,
  filename: string,
  text?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const file = blobToShareFile(blob, filename);
  const trimmed = text?.trim();
  const shareData: ShareData = {
    files: [file],
    ...(trimmed ? { text: trimmed } : {}),
  };

  const hasShare = typeof navigator.share === "function";
  const canTryFiles =
    typeof navigator.canShare !== "function" ||
    navigator.canShare({ files: [file] });

  if (hasShare && canTryFiles) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e: unknown) {
      if (isAbortError(e)) return;
    }
  }

  downloadBlob(blob, filename);
  if (trimmed) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(trimmed)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
}

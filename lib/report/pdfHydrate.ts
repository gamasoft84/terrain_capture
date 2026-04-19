import { blobFromStored } from "@/lib/db/blobFromStored";
import type { ProjectGalleryItem } from "@/lib/gallery/collectProjectGallery";

export type HydratedGalleryItem = {
  src: string | null;
  caption: string;
  originLabel: string;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read blob"));
    r.readAsDataURL(blob);
  });
}

/** Descarga foto pública y la convierte a data URL (misma origen lógico para canvas). */
async function fetchHttpToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export type HydrateGalleryOptions = {
  /**
   * Para PNG (`html-to-image`): Safari/iOS vacía las imágenes remotas en el canvas
   * si el `<img>` usa URL cross-origin sin data URL. Con `true`, las URLs http(s)
   * se descargan y se pasan como data URL; también se priorizan siempre los bytes locales.
   */
  inlineRemotePhotos?: boolean;
};

export async function hydrateGalleryForPdf(
  items: ProjectGalleryItem[],
  options?: HydrateGalleryOptions,
): Promise<HydratedGalleryItem[]> {
  const inlineRemote = options?.inlineRemotePhotos === true;
  const out: HydratedGalleryItem[] = [];

  for (const item of items) {
    let src: string | null = null;

    const blob = blobFromStored(item);
    if (blob && blob.size > 0) {
      src = await blobToDataUrl(blob);
    }

    if (!src && item.photoUrl?.startsWith("http")) {
      if (inlineRemote) {
        src = await fetchHttpToDataUrl(item.photoUrl);
      } else {
        src = item.photoUrl;
      }
    }

    out.push({
      src,
      caption: item.caption?.trim() ?? "",
      originLabel: item.originLabel,
    });
  }

  return out;
}

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

export async function hydrateGalleryForPdf(
  items: ProjectGalleryItem[],
): Promise<HydratedGalleryItem[]> {
  const out: HydratedGalleryItem[] = [];
  for (const item of items) {
    let src: string | null = item.photoUrl?.startsWith("http")
      ? item.photoUrl
      : null;
    if (!src) {
      const blob = blobFromStored(item);
      if (blob && blob.size > 0) {
        src = await blobToDataUrl(blob);
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

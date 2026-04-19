"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cameraPermissionShortLine } from "@/lib/geo/permissionCopy";

type Props = {
  cameraInputId: string;
  galleryInputId: string;
  disabled?: boolean;
  hasFile: boolean;
  onFileSelected: (file: File) => void;
  /** Para `aria-labelledby` del grupo (dos inputs). */
  labelledBy?: string;
};

export function PhotoSourceInputs({
  cameraInputId,
  galleryInputId,
  disabled,
  hasFile,
  onFileSelected,
  labelledBy,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    input.value = "";
    if (f) onFileSelected(f);
  }

  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-labelledby={labelledBy}
    >
      <input
        id={cameraInputId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        id={galleryInputId}
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          {hasFile ? "Cámara" : "Tomar foto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          {hasFile ? "Galería" : "Elegir de fotos"}
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        Las fotos grandes se comprimen automáticamente al guardarlas (WebP o JPEG).
      </p>
      <p className="text-muted-foreground text-[11px] leading-snug">
        {cameraPermissionShortLine()}
      </p>
    </div>
  );
}

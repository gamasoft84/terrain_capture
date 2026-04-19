"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function touchDistance(a: Touch, b: Touch): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export interface GalleryLightboxProps {
  open: boolean;
  imageSrc: string;
  title: string;
  metaLines: string[];
  onClose: () => void;
  /** Error de subida tras reintentos (sync); botón para volver a encolar. */
  photoUploadError?: boolean;
  onRetryPhotoUpload?: () => void;
  retryPhotoBusy?: boolean;
}

const MIN = 1;
const MAX = 5;

export function GalleryLightbox({
  open,
  imageSrc,
  title,
  metaLines,
  onClose,
  photoUploadError,
  onRetryPhotoUpload,
  retryPhotoBusy,
}: GalleryLightboxProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const pinchAnchor = useRef<{ d0: number; s0: number } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    origTx: number;
    origTy: number;
  } | null>(null);
  const gestureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    txRef.current = tx;
  }, [tx]);
  useEffect(() => {
    tyRef.current = ty;
  }, [ty]);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTx(0);
    setTy(0);
    pinchAnchor.current = null;
    panRef.current = null;
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const clampScale = useCallback((s: number) => Math.min(MAX, Math.max(MIN, s)), []);

  useEffect(() => {
    if (!open) return;
    const el = gestureRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = touchDistance(e.touches[0], e.touches[1]);
        pinchAnchor.current = { d0: d, s0: scaleRef.current };
        panRef.current = null;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        const t = e.touches[0];
        panRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          origTx: txRef.current,
          origTy: tyRef.current,
        };
        pinchAnchor.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchAnchor.current) {
        e.preventDefault();
        const d = touchDistance(e.touches[0], e.touches[1]);
        const { d0, s0 } = pinchAnchor.current;
        const next = clampScale(s0 * (d / d0));
        setScale(next);
      } else if (
        e.touches.length === 1 &&
        panRef.current &&
        scaleRef.current > 1
      ) {
        e.preventDefault();
        const t = e.touches[0];
        const p = panRef.current;
        setTx(p.origTx + (t.clientX - p.startX));
        setTy(p.origTy + (t.clientY - p.startY));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchAnchor.current = null;
      if (e.touches.length === 0) panRef.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const zoomIn = e.deltaY < 0;
      const factor = zoomIn ? 1.08 : 1 / 1.08;
      setScale((s) => {
        const n = clampScale(s * factor);
        if (n <= 1) {
          setTx(0);
          setTy(0);
        }
        return n;
      });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [open, imageSrc, clampScale]);

  const zoomIn = useCallback(() => {
    setScale((s) => clampScale(s * 1.25));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const n = clampScale(s / 1.25);
      if (n <= 1) {
        setTx(0);
        setTy(0);
      }
      return n;
    });
  }, [clampScale]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className={cn(
              "size-9 border-0 bg-white/15 text-white hover:bg-white/25",
            )}
            aria-label="Alejar"
            onClick={zoomOut}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className={cn(
              "size-9 border-0 bg-white/15 text-white hover:bg-white/25",
            )}
            aria-label="Acercar"
            onClick={zoomIn}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className={cn(
              "size-9 border-0 bg-white/15 text-white hover:bg-white/25",
            )}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      <div
        ref={gestureRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <div
          className="flex size-full items-center justify-center overflow-hidden"
          onDoubleClick={() => {
            setScale((s) => {
              if (s > 1) {
                setTx(0);
                setTy(0);
                return 1;
              }
              return 2;
            });
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            className="max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
            draggable={false}
          />
        </div>
      </div>

      {photoUploadError && onRetryPhotoUpload ? (
        <div className="border-t border-amber-400/30 bg-amber-950/40 px-3 py-2">
          <p className="text-[11px] text-amber-100/95">
            No se pudo subir esta foto al servidor (varios intentos fallidos).
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 h-8 border-0 bg-white/20 text-white hover:bg-white/30"
            disabled={retryPhotoBusy}
            onClick={onRetryPhotoUpload}
          >
            {retryPhotoBusy ? "Encolando…" : "Reintentar subida"}
          </Button>
        </div>
      ) : null}

      <div className="border-t border-white/10 px-3 py-2 text-[11px] leading-snug text-white/80">
        <p className="mb-1 text-white/60">
          Móvil: pellizca para zoom; un dedo arrastra si está ampliado. Escritorio:
          pellizco en trackpad (Ctrl/⌘ + rueda) o botones +/−. Doble clic alterna
          1× / 2×.
        </p>
        {metaLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

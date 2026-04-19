"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteProjectDialog } from "@/components/project/DeleteProjectDialog";

const DELETE_PANEL_PX = 88;

export type ProjectSwipeRowData = {
  projectName: string;
  projectLocalId: string;
  locationLabel?: string;
  updatedAt: Date;
  status: string;
  areaLabel: string | null;
};

type ProjectSwipeRowProps = {
  row: ProjectSwipeRowData;
};

export function ProjectSwipeRow({ row }: ProjectSwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
  } | null>(null);
  const suppressNavRef = useRef(false);

  const snapClosed = useCallback(() => {
    setOffset(0);
  }, []);

  const setDialogOpen = useCallback((open: boolean) => {
    setConfirmOpen(open);
    if (!open) setOffset(0);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startOffset: offset,
      };
      suppressNavRef.current = false;
    },
    [offset],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const delta = e.clientX - d.startX;
      if (Math.abs(delta) > 12) suppressNavRef.current = true;
      setOffset(
        Math.max(
          -DELETE_PANEL_PX,
          Math.min(0, d.startOffset + delta),
        ),
      );
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ya liberado */
      }
      dragRef.current = null;
      setIsDragging(false);
      setOffset((prev) => {
        const mid = -DELETE_PANEL_PX / 2;
        return prev <= mid ? -DELETE_PANEL_PX : 0;
      });
    },
    [],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      snapClosed();
    },
    [snapClosed],
  );

  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressNavRef.current) {
      e.preventDefault();
      suppressNavRef.current = false;
    }
  }, []);

  return (
    <>
      <div className="border-border bg-card hover:border-primary/50 overflow-hidden rounded-xl border shadow-sm transition-colors">
        <div
          className="flex w-[calc(100%+88px)] touch-pan-y"
          style={{
            transform: `translateX(${offset}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="relative min-w-0 flex-1">
            <Link
              href={`/projects/${row.projectLocalId}`}
              className="block"
              onClick={handleLinkClick}
            >
              <Card className="border-0 shadow-none">
                <CardHeader className="pb-2 pr-12">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{row.projectName}</CardTitle>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {row.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {row.locationLabel ? (
                    <CardDescription>{row.locationLabel}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    Actualizado{" "}
                    {format(row.updatedAt, "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                  {row.areaLabel ? (
                    <span className="text-primary font-mono font-medium">
                      Área: {row.areaLabel}
                    </span>
                  ) : (
                    <span className="font-mono">Área: —</span>
                  )}
                </CardContent>
              </Card>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive absolute top-3 right-2 z-20"
              aria-label="Eliminar proyecto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex shrink-0 items-center justify-center px-2 text-center text-sm font-semibold"
            style={{ width: DELETE_PANEL_PX }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setDialogOpen(true);
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
      <DeleteProjectDialog
        open={confirmOpen}
        onOpenChange={setDialogOpen}
        projectLocalId={row.projectLocalId}
        projectName={row.projectName}
        onDeleted={snapClosed}
      />
    </>
  );
}

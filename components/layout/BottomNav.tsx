"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Camera, Home, ImageIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLastProjectLocalIdServerSnapshot,
  getLastProjectLocalIdSnapshot,
  subscribeLastProjectLocalId,
} from "@/lib/settings/lastProjectLocalId";

const items = [
  { href: "/", label: "Inicio", icon: Home, key: "home" },
  { href: "/capture", label: "Capturar", icon: Camera, key: "capture" },
  { label: "Galería", icon: ImageIcon, key: "gallery" },
  { href: "/settings", label: "Ajustes", icon: Settings, key: "settings" },
] as const;

function isGalleryPath(pathname: string) {
  return (
    pathname === "/gallery" ||
    /^\/projects\/[^/]+\/gallery\/?$/.test(pathname)
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const lastProjectLocalId = useSyncExternalStore(
    subscribeLastProjectLocalId,
    getLastProjectLocalIdSnapshot,
    getLastProjectLocalIdServerSnapshot,
  );
  const galleryHref = lastProjectLocalId
    ? `/projects/${lastProjectLocalId}/gallery`
    : "/gallery";

  return (
    <nav
      className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Navegación principal"
    >
      {items.map((item) => {
        const { label, icon: Icon, key } = item;
        const href = "href" in item ? item.href : galleryHref;
        const active =
          key === "home"
            ? pathname === "/"
            : key === "gallery"
              ? isGalleryPath(pathname)
              : pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "text-muted-foreground flex min-h-12 min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active && "text-primary",
            )}
          >
            <Icon className="size-6" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

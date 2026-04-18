"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Home, ImageIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/capture", label: "Capturar", icon: Camera },
  { href: "/gallery", label: "Galería", icon: ImageIcon },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Navegación principal"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
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

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rememberLastProjectFromPathname } from "@/lib/settings/lastProjectLocalId";

/** Persiste el último `localId` de proyecto al navegar bajo `/projects/:id/*`. */
export function LastProjectRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    rememberLastProjectFromPathname(pathname);
  }, [pathname]);
  return null;
}

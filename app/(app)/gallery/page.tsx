"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { readLastProjectLocalId } from "@/lib/settings/lastProjectLocalId";

export default function GalleryHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = readLastProjectLocalId();
    if (id) {
      router.replace(`/projects/${id}/gallery`);
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Galería</CardTitle>
        <CardDescription>
          Aún no hay un proyecto reciente. Abre un proyecto desde el inicio y
          sus fotos aparecerán aquí la próxima vez.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        La galería muestra vértices, puntos de interés y fotos adicionales del
        último proyecto que visites.
      </CardContent>
      <CardFooter className="gap-2">
        <Link className={cn(buttonVariants())} href="/">
          Ir al inicio
        </Link>
        <Link
          className={cn(buttonVariants({ variant: "outline" }))}
          href="/projects/new"
        >
          Nuevo proyecto
        </Link>
      </CardFooter>
    </Card>
  );
}

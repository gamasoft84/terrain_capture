"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProjectWithMainPolygon } from "@/lib/db/projects";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  locationLabel: z.string().optional(),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewProjectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      locationLabel: "",
      clientName: "",
      clientContact: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const { projectLocalId } = await createProjectWithMainPolygon({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        locationLabel: values.locationLabel?.trim() || undefined,
        clientName: values.clientName?.trim() || undefined,
        clientContact: values.clientContact?.trim() || undefined,
      });
      router.push(`/projects/${projectLocalId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el proyecto");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Nuevo proyecto
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Se crea el terreno principal vacío; la captura de vértices llega en la
          tarea 1.6+.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Datos del levantamiento</CardTitle>
          <CardDescription>
            Todo se guarda en este dispositivo (IndexedDB).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del proyecto</Label>
              <Input
                id="name"
                placeholder="Ej. Terreno Playa Zipolite"
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationLabel">Ubicación (etiqueta)</Label>
              <Input
                id="locationLabel"
                placeholder="Zipolite, Oaxaca"
                {...register("locationLabel")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Notas internas"
                {...register("description")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Cliente (nombre)</Label>
              <Input id="clientName" {...register("clientName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientContact">Cliente (contacto)</Label>
              <Input
                id="clientContact"
                placeholder="Teléfono o correo"
                {...register("clientContact")}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Crear proyecto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

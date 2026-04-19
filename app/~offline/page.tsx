import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center gap-6 px-6 pb-safe">
      <div className="border-border bg-card text-card-foreground max-w-md rounded-2xl border p-8 text-center shadow-lg">
        <p className="text-muted-foreground mb-2 text-sm tracking-wide uppercase">
          Sin conexión
        </p>
        <h1 className="font-heading mb-3 text-2xl font-semibold">
          TerrainCapture no alcanza la red
        </h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          Cuando vuelva la señal, la app se actualizará sola. Lo que hayas guardado en
          el dispositivo sigue disponible offline.
        </p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
        >
          Reintentar
        </Link>
      </div>
    </div>
  );
}

# TerrainCapture

Especificación completa (stack, datos, fases y tareas): [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Desarrollo local

```bash
npm install
npm run dev
```

Los scripts usan **`--webpack`** porque, si en Cursor abres el workspace en la carpeta **padre** (p. ej. `cursor_proys`) en lugar de `terrain_capture_pwa`, **Turbopack** puede intentar resolver `tailwindcss` desde ese directorio y fallar. Con Webpack + `npm run` desde `terrain_capture_pwa` el problema desaparece. Si abres la carpeta del repo como raíz del workspace, puedes probar `npm run dev:turbo` / `npm run build:turbo`.

Abre [http://localhost:3000](http://localhost:3000): dashboard de proyectos (IndexedDB / Dexie). **Fase 1 tareas 1.1–1.5** listas: crear proyecto crea también el polígono principal vacío.

- Copia [`.env.local.example`](./.env.local.example) a `.env.local` cuando conectes Supabase (Storage y sync en fases posteriores).
- Migración SQL de ejemplo: [`supabase/migrations/20250417120000_initial.sql`](./supabase/migrations/20250417120000_initial.sql) — ver [`supabase/README.md`](./supabase/README.md).

```bash
npm run build
```

## Stack

Next.js (App Router), Tailwind v4, shadcn/ui (Base UI), Dexie, Supabase client helpers, dependencias del mapa/cálculos instaladas para tareas 1.6+.

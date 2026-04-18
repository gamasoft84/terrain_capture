# TerrainCapture

Especificación completa (stack, datos, fases y tareas): [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000): dashboard de proyectos (IndexedDB / Dexie). **Fase 1 tareas 1.1–1.5** listas: crear proyecto crea también el polígono principal vacío.

- Copia [`.env.local.example`](./.env.local.example) a `.env.local` cuando conectes Supabase (Storage y sync en fases posteriores).
- Migración SQL de ejemplo: [`supabase/migrations/20250417120000_initial.sql`](./supabase/migrations/20250417120000_initial.sql) — ver [`supabase/README.md`](./supabase/README.md).

```bash
npm run build
```

## Stack

Next.js (App Router), Tailwind v4, shadcn/ui (Base UI), Dexie, Supabase client helpers, dependencias del mapa/cálculos instaladas para tareas 1.6+.

# TerrainCapture

PWA para levantamiento de terrenos en campo: polígonos, fotos georreferenciadas, trabajo offline y reportes exportables.

La especificación del producto (stack, modelo de datos, fases y tareas) está en [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).

## Flujo principal

1. **Proyectos** — En el inicio creas o abres un proyecto; el polígono principal se gestiona en Dexie (IndexedDB).
2. **Captura** — Registras vértices y POIs con GPS y fotos (cámara o galería); las imágenes se comprimen en cliente antes de guardar/subir.
3. **Mapa del proyecto** — Visualizas el terreno, estadísticas y cierras el polígono cuando corresponda.
4. **Sincronización** — Con Supabase configurado, las fotos y metadatos se encolan y suben al Storage cuando hay red.
5. **Reporte** — Exportas GeoJSON/KML, PNG para compartir y PDF profesional desde la vista de reporte.

### Galería visual

Las imágenes siguientes son **marcadores SVG** listos para sustituir por capturas reales (PNG/WebP); ver [`docs/screenshots/README.md`](./docs/screenshots/README.md).

| Paso | Descripción |
|------|-------------|
| 1 | Listado de proyectos |
| 2 | Captura de vértice / POI |
| 3 | Mapa y polígono del proyecto |
| 4 | Reporte y exportación |

![Dashboard / proyectos](./docs/screenshots/01-dashboard.svg)

![Captura en campo](./docs/screenshots/02-capture.svg)

![Mapa del proyecto](./docs/screenshots/03-project-map.svg)

![Reporte y exportación](./docs/screenshots/04-report.svg)

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Los scripts usan **`--webpack`** porque, si en Cursor abres el workspace en la carpeta **padre** (p. ej. `cursor_proys`) en lugar de `terrain_capture_pwa`, **Turbopack** puede intentar resolver `tailwindcss` desde ese directorio y fallar. Con Webpack + `npm run` desde `terrain_capture_pwa` el problema desaparece. Si abres la carpeta del repo como raíz del workspace, puedes probar `npm run dev:turbo` / `npm run build:turbo`.

- Copia [`.env.local.example`](./.env.local.example) a `.env.local` cuando conectes Supabase (Storage y sync).
- Migración SQL de ejemplo: [`supabase/migrations/20250417120000_initial.sql`](./supabase/migrations/20250417120000_initial.sql) — ver [`supabase/README.md`](./supabase/README.md).

```bash
npm run build
```

Análisis opcional del bundle: `npm run analyze`.

## Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| [`CHANGELOG.md`](./CHANGELOG.md) | Historial de versiones |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Variables de entorno, Supabase Storage y deploy en Vercel |

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (Base UI), Dexie, cliente Supabase, MapLibre, Turf, React PDF; PWA vía `@ducanh2912/next-pwa`.

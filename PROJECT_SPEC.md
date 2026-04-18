# 🌿 TerrainCapture — Prompts para Cursor AI

> Documento de especificación y prompts secuenciales para construir TerrainCapture en Cursor AI.
> **Autor:** Rick — Gamasoft IA Technologies S.A.S.
> **Uso:** Copia este archivo a la raíz de tu proyecto como `PROJECT_SPEC.md` y mantenlo abierto en Cursor para que lo use como contexto permanente.

---

## 📋 Cómo usar este documento

1. Crea el proyecto en Cursor con `npx create-next-app@latest TerrainCapture`
2. Copia este archivo completo a la raíz como `PROJECT_SPEC.md`
3. Abre Cursor y **fija este archivo como contexto** (@ mention)
4. Usa los prompts en el orden indicado: Master → Fase 1 → Fase 2 → ... → Fase 5
5. **NUNCA** pegues todos los prompts de fases juntos. Uno a la vez.
6. Entre fase y fase, prueba el código y haz commit antes de seguir.

---

# 🎯 PROMPT MAESTRO (pegar al inicio del proyecto)

```
Vas a ayudarme a construir TerrainCapture, una Progressive Web App (PWA) offline-first para levantamiento topográfico de terrenos usando GPS del iPhone. Soy Rick, programador y fundador de Gamasoft IA Technologies S.A.S. en México. Esta app es para apoyar mi operación de compra/venta de terrenos en Huatulco, Oaxaca.

## CONTEXTO DE NEGOCIO

TerrainCapture permite caminar un terreno en campo, tomar fotos georreferenciadas en cada vértice, calcular área/perímetro automáticamente, capturar sub-áreas internas (cabañas, pozos) y puntos de interés (árboles, servicios), y generar reportes profesionales compartibles por WhatsApp para clientes. Debe funcionar completamente sin internet en el campo y sincronizar con servidores cuando haya conexión.

## STACK TÉCNICO OBLIGATORIO

- **Framework:** Next.js 14+ (App Router) + TypeScript estricto — fija la versión mayor en `package.json` según la [versión LTS](https://nextjs.org/support-policy) vigente al hacer scaffold (evita que el asistente mezcle APIs de distintas majors).
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL con extensión PostGIS + Storage + Auth)
- **Mapa:** MapLibre GL JS + control de dibujo. Paquete de referencia: `@mapbox/mapbox-gl-draw` (muchas apps lo usan con MapLibre). **Si hay incompatibilidad de peer dependencies o estilos rotos**, usar el paquete mantenido para MapLibre (`@maplibre/maplibre-gl-draw` u otro fork recomendado en la doc del paquete) y anotar la versión elegida en el README del repo.
- **Tiles satelitales:** ESRI World Imagery (gratis, sin API key) + MapTiler como fallback
- **Cálculos geoespaciales:** Turf.js (@turf/turf)
- **Offline storage:** Dexie.js (wrapper de IndexedDB)
- **PWA:** @ducanh2912/next-pwa (fork mantenido de next-pwa)
- **EXIF de fotos:** exifr
- **Generación de PDF:** @react-pdf/renderer
- **Generación de PNG del reporte:** html-to-image
- **Compartir:** Web Share API nativa + fallback a deep link de WhatsApp
- **Deploy:** Vercel

## ARQUITECTURA OFFLINE-FIRST

Regla crítica: toda escritura del usuario debe ir **primero** a IndexedDB (Dexie). A partir de Fase 3, lo remoto se encola y sube sin bloquear la captura. Nunca dependas de red para que el usuario **confirme** una captura (el dato válido existe en Dexie aunque falle el upload).

**Flujo (Fase 3+):**
1. Usuario captura vértice/POI → se guarda en Dexie inmediatamente
2. Se agrega entrada a `sync_queue` en Dexie
3. Hook useSyncManager detecta conexión y procesa la cola en background
4. Al completar sync, marca entrada como synced y elimina de cola local

En **Fase 1** los pasos 2–4 no están activos; la persistencia local es el paso 1 (y la excepción Storage opcional ya descrita).

### Alcance por fase (Dexie, red y sync)

- **Fase 1:** Dexie es la fuente de verdad local: el usuario no pierde datos al refrescar. **No** hay PWA instalable para trabajo sin red de bundle, **no** se procesa `sync_queue` hacia Postgres y **no** se implementa `app/api/sync` todavía (la carpeta/ruta puede existir vacía o omitirse hasta Fase 3).
- **Fase 3+:** PWA, caché de tiles, cola de sync y toda escritura remota gobernada por `SyncManager`.

### Excepción controlada — Fase 1 y Supabase Storage

La regla global es que **la captura nunca dependa de la red** para persistir: el registro del vértice (coords, nota, metadatos) y el **`photoBlob` en Dexie** son obligatorios al guardar.

En **Fase 1** se permite, además, **subir la imagen a Supabase Storage en segundo plano** y actualizar `photoUrl` cuando termine, solo para acelerar pruebas y vistas con URL pública. A partir de **Fase 3**, los blobs y las filas remotas deben alinearse con la cola de sync; **no** añadir nuevos flujos client → Storage directos fuera de esa arquitectura.

## MODELO DE DATOS

### Jerarquía conceptual

```
Proyecto (ej. "Terreno Playa Zipolite")
├── Polígono principal (requerido, 1 por proyecto)
│   └── Vértices ordenados (P1, P2, ..., Pn)
├── Sub-polígonos (opcional, N)
│   └── Vértices propios
└── POIs (opcional, N)
    └── Punto único con foto + nota
```

### Schema Supabase (PostgreSQL + PostGIS)

```sql
-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Proyectos
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL, -- para matching offline/online
  name TEXT NOT NULL,
  description TEXT,
  location_label TEXT, -- ej. "Zipolite, Oaxaca"
  client_name TEXT,
  client_contact TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'shared')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Polígonos (principal o sub-área)
CREATE TABLE polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Terreno principal", "Cabaña", etc.
  type TEXT NOT NULL CHECK (type IN ('main', 'sub')),
  color TEXT DEFAULT '#10b981', -- hex para rendering
  area_m2 NUMERIC(12, 2),
  perimeter_m NUMERIC(12, 2),
  centroid GEOGRAPHY(POINT, 4326),
  geometry GEOGRAPHY(POLYGON, 4326),
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vértices de polígonos
CREATE TABLE vertices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  polygon_id UUID REFERENCES polygons(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  gps_accuracy_m NUMERIC(6, 2),
  altitude_m NUMERIC(8, 2),
  captured_at TIMESTAMPTZ DEFAULT now(),
  photo_url TEXT,
  thumbnail_url TEXT,
  note TEXT,
  capture_method TEXT CHECK (capture_method IN ('gps_single', 'gps_averaged', 'manual_map', 'photo_exif'))
);

-- Puntos de interés
CREATE TABLE points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- etiqueta libre
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  gps_accuracy_m NUMERIC(6, 2),
  photo_url TEXT,
  thumbnail_url TEXT,
  note TEXT,
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- Fotos adicionales del proyecto (no asociadas a vértice/POI)
CREATE TABLE project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX idx_polygons_project ON polygons(project_id);
CREATE INDEX idx_vertices_polygon ON vertices(polygon_id);
CREATE INDEX idx_vertices_order ON vertices(polygon_id, order_index);
CREATE INDEX idx_pois_project ON points_of_interest(project_id);
CREATE INDEX idx_photos_project ON project_photos(project_id);
CREATE INDEX idx_polygons_geometry ON polygons USING GIST(geometry);
CREATE INDEX idx_vertices_coords ON vertices USING GIST(coordinates);
```

### Schema Dexie (IndexedDB local, espejo del servidor)

```typescript
// lib/db/schema.ts
import Dexie, { Table } from 'dexie';

export interface LocalProject {
  localId: string;
  serverId?: string;
  name: string;
  description?: string;
  locationLabel?: string;
  clientName?: string;
  clientContact?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'shared';
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface LocalPolygon {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  name: string;
  type: 'main' | 'sub';
  color: string;
  areaM2?: number;
  perimeterM?: number;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface LocalVertex {
  localId: string;
  serverId?: string;
  polygonLocalId: string;
  orderIndex: number;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  altitudeM?: number;
  capturedAt: Date;
  photoBlob?: Blob; // foto guardada localmente
  photoUrl?: string; // URL del server cuando ya se subió
  note?: string;
  captureMethod: 'gps_single' | 'gps_averaged' | 'manual_map' | 'photo_exif';
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface LocalPOI {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  label: string;
  latitude: number;
  longitude: number;
  gpsAccuracyM?: number;
  photoBlob?: Blob;
  photoUrl?: string;
  note?: string;
  capturedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

/** Fotos del proyecto no ligadas a un vértice/POI (espejo de `project_photos` en Supabase). */
export interface LocalProjectPhoto {
  localId: string;
  serverId?: string;
  projectLocalId: string;
  photoBlob?: Blob;
  photoUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  capturedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

export interface SyncQueueEntry {
  id?: number;
  entityType: 'project' | 'polygon' | 'vertex' | 'poi' | 'photo';
  entityLocalId: string;
  action: 'create' | 'update' | 'delete';
  /** Snapshot JSON-serializable; en código consumidor hacer narrowing según `entityType` / `action` (no usar `any`). */
  payload: Record<string, unknown>;
  attemptCount: number;
  lastAttempt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

export interface CachedTile {
  url: string;
  blob: Blob;
  cachedAt: Date;
  zoom: number;
  x: number;
  y: number;
}

export class TerrainCaptureDB extends Dexie {
  projects!: Table<LocalProject, string>;
  polygons!: Table<LocalPolygon, string>;
  vertices!: Table<LocalVertex, string>;
  pois!: Table<LocalPOI, string>;
  projectPhotos!: Table<LocalProjectPhoto, string>;
  syncQueue!: Table<SyncQueueEntry, number>;
  tileCache!: Table<CachedTile, string>;

  constructor() {
    super('TerrainCaptureDB');
    this.version(1).stores({
      projects: 'localId, serverId, status, syncStatus, createdAt',
      polygons: 'localId, serverId, projectLocalId, type, syncStatus',
      vertices: 'localId, serverId, polygonLocalId, orderIndex, syncStatus',
      pois: 'localId, serverId, projectLocalId, syncStatus',
      projectPhotos: 'localId, serverId, projectLocalId, syncStatus, capturedAt',
      syncQueue: '++id, entityType, entityLocalId, status, createdAt',
      tileCache: 'url, zoom, cachedAt'
    });
    // Índice `updatedAt` requerido para orderBy en lista de proyectos
    this.version(2).stores({
      projects: 'localId, serverId, status, syncStatus, createdAt, updatedAt',
    });
  }
}

export const db = new TerrainCaptureDB();
```

## DESIGN SYSTEM: "Terrain Pro"

### Paleta de colores

```css
/* globals.css - CSS Variables */
:root {
  /* Backgrounds (modo oscuro por default) */
  --bg-base: #0a0f0d;           /* Negro selva */
  --bg-surface: #111917;         /* Superficie elevada */
  --bg-elevated: #1a2420;        /* Cards, modales */
  --bg-overlay: rgba(10, 15, 13, 0.85);

  /* Verdes selva (primary) */
  --primary-50: #ecfdf5;
  --primary-400: #34d399;
  --primary-500: #10b981;        /* Verde principal */
  --primary-600: #059669;
  --primary-700: #047857;

  /* Ámbar/dorado (accent - oaxaqueño) */
  --accent-400: #fbbf24;
  --accent-500: #f59e0b;         /* Ámbar principal */
  --accent-600: #d97706;

  /* Grises/text */
  --text-primary: #f0fdf4;
  --text-secondary: #a7b3af;
  --text-tertiary: #6b7570;
  --text-muted: #4a544f;

  /* Borders */
  --border-subtle: #1f2a26;
  --border-default: #2a3631;
  --border-strong: #3d4a44;

  /* Estados */
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #3b82f6;

  /* Precisión GPS */
  --gps-excellent: #10b981;  /* <3m */
  --gps-good: #84cc16;       /* 3-5m */
  --gps-fair: #f59e0b;       /* 5-10m */
  --gps-poor: #ef4444;       /* >10m */
}
```

### Tipografía

- **UI principal:** Geist Sans (moderna, técnica, excelente legibilidad en móvil)
- **Datos/coordenadas:** JetBrains Mono (monoespaciada, facilita lectura de coords)
- **Display/títulos grandes:** Geist Sans con tracking ajustado

```typescript
// app/layout.tsx
import { GeistSans } from 'geist/font/sans';
import { JetBrains_Mono } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono'
});
```

### Principios de UI para app de campo

1. **Botones grandes** — mínimo 48x48px táctil, pensados para dedos con guantes/sudor
2. **Alto contraste** — la app se usará bajo sol directo en Huatulco
3. **Feedback háptico** — `navigator.vibrate()` en acciones importantes
4. **Modo "una mano"** — controles principales en zona inferior de pantalla
5. **Estados de batería/GPS/red siempre visibles** — en barra superior fija
6. **Confirmaciones para acciones destructivas** — borrar vértice requiere confirm
7. **Auto-save agresivo** — cualquier cambio persiste inmediatamente en Dexie

### Branding Gamasoft

- Logo pequeño de Gamasoft en splash screen y reportes
- Firma "Powered by Gamasoft IA" discreta en footer
- Colores primarios son de TerrainCapture, NO los de Gamasoft corporativo
- En reportes generados para clientes: logo Gamasoft + datos de contacto

## ESTRUCTURA DE CARPETAS

```
TerrainCapture/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx                    # Layout con nav inferior
│   │   ├── page.tsx                      # Dashboard / lista de proyectos
│   │   ├── projects/
│   │   │   ├── new/page.tsx             # Crear proyecto
│   │   │   └── [id]/
│   │   │       ├── page.tsx             # Vista del proyecto (mapa)
│   │   │       ├── capture/page.tsx     # Modo captura de vértices
│   │   │       ├── pois/page.tsx        # Gestión de POIs
│   │   │       ├── gallery/page.tsx     # Galería de fotos
│   │   │       ├── export/page.tsx      # Exportación
│   │   │       └── report/page.tsx      # Configurar y generar reporte
│   │   └── settings/page.tsx            # Configuración (precisión GPS, etc.)
│   ├── api/
│   │   └── sync/route.ts                # Endpoint de sync batch
│   ├── layout.tsx
│   ├── globals.css
│   └── manifest.ts                      # PWA manifest
├── components/
│   ├── ui/                              # shadcn/ui components
│   ├── map/
│   │   ├── MapCanvas.tsx
│   │   ├── MapControls.tsx
│   │   ├── PolygonLayer.tsx
│   │   ├── VertexMarker.tsx
│   │   ├── POIMarker.tsx
│   │   └── GPSAccuracyIndicator.tsx
│   ├── capture/
│   │   ├── CaptureButton.tsx           # Botón principal de captura
│   │   ├── VertexForm.tsx              # Form de vértice (foto + nota)
│   │   ├── GPSStatusBar.tsx
│   │   └── CameraCapture.tsx
│   ├── project/
│   │   ├── ProjectCard.tsx
│   │   ├── PolygonStats.tsx            # Área, perímetro, vértices
│   │   ├── SubPolygonManager.tsx
│   │   └── VertexList.tsx
│   ├── report/
│   │   ├── ReportConfig.tsx            # Toggle secciones
│   │   ├── ReportPreview.tsx
│   │   ├── ReportPDF.tsx               # @react-pdf/renderer
│   │   └── ReportPNG.tsx               # Template HTML para html-to-image
│   ├── sync/
│   │   ├── SyncIndicator.tsx
│   │   └── OfflineBanner.tsx
│   └── layout/
│       ├── TopBar.tsx                   # Con GPS/red/batería
│       └── BottomNav.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                    # Dexie schema
│   │   ├── projects.ts                  # CRUD projects
│   │   ├── polygons.ts
│   │   ├── vertices.ts
│   │   ├── pois.ts
│   │   ├── projectPhotos.ts             # CRUD fotos de proyecto (UI galería Fase 2+)
│   │   └── sync.ts                      # Sync manager
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── storage.ts                   # Upload de fotos
│   ├── geo/
│   │   ├── calculations.ts              # Turf.js wrappers
│   │   ├── gps.ts                       # Geolocation API + averaging
│   │   ├── exif.ts                      # Lectura EXIF con exifr
│   │   ├── kml.ts                       # Export KML
│   │   ├── geojson.ts
│   │   └── csv.ts
│   ├── map/
│   │   ├── tile-providers.ts
│   │   └── tile-cache.ts
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── useGPSAveraged.ts
│   │   ├── useOnlineStatus.ts
│   │   ├── useSyncQueue.ts
│   │   └── useCamera.ts
│   └── utils/
│       ├── units.ts                     # m² ↔ hectáreas ↔ etc.
│       ├── ids.ts                       # nanoid para local_id
│       └── share.ts                     # Web Share API
├── public/
│   ├── icons/                           # PWA icons
│   ├── logo-gamasoft.svg
│   └── logo-TerrainCapture.svg
├── types/
│   └── index.ts
├── PROJECT_SPEC.md                      # este archivo
└── [config files]
```

## REGLAS DE DESARROLLO

1. **TypeScript estricto:** `strict: true`, sin `any`, sin `@ts-ignore` excepto con comentario justificado
2. **Persistencia y remoto:** Toda **captura** se escribe primero en Dexie; la app no debe depender de la red para guardar trabajo del usuario. Las escrituras a Postgres y a Storage en **Fase 3+** pasan por la cola de sync. **Excepción temporal en Fase 1:** upload directo a Storage para fotos de vértice, descrito en *ARQUITECTURA OFFLINE-FIRST → Excepción controlada — Fase 1*.
3. **`SUPABASE_SERVICE_ROLE_KEY`:** solo en Server Components, Route Handlers, server actions o scripts de mantenimiento; **nunca** con prefijo `NEXT_PUBLIC_` ni en código ejecutado en el navegador.
4. **IDs locales:** Usa `nanoid()` para generar `local_id` al crear entidades. El `server_id` se asigna solo tras sync exitoso
5. **Componentes pequeños:** Máximo 200 líneas por archivo. Si crece, extrae sub-componentes o hooks
6. **No uses `localStorage` para datos críticos:** todo va a Dexie. localStorage solo para UI preferences triviales
7. **Manejo de errores:** Todo try/catch en operaciones de IO. Nunca swallow errors silenciosamente
8. **Accesibilidad básica:** aria-labels en botones icon-only, contraste WCAG AA mínimo
9. **Performance:** Lazy load de componentes pesados (mapa, PDF renderer). `next/dynamic` con `ssr: false` para MapLibre
10. **Mobile-first:** Todo diseño primero para 390px (iPhone 15 Pro Max), luego adaptar desktop
11. **Comentarios en español** para lógica de negocio, inglés para lógica técnica pura

## USUARIO HARDCODED (FASE 1)

En fase 1 usaremos un solo usuario hardcoded en Supabase. Variables de entorno:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_HARDCODED_USER_ID=<uuid del usuario Rick>
NEXT_PUBLIC_MAPTILER_KEY=   # opcional, fallback de tiles
```

RLS en Supabase deshabilitado o con política permisiva para ese único user_id mientras sea uso personal.

## ¿ENTENDIDO?

Confirma que entendiste el contexto completo y el stack. NO escribas código todavía. Solo responde:
1. Resumen en 3 bullets de lo que vamos a construir
2. Cualquier duda crítica sobre el stack o modelo de datos
3. Propón el orden de las primeras 5 tareas para empezar Fase 1

Luego te pasaré el prompt de Fase 1 específico.
```

---

# 🚀 FASE 1 — Core Capture (semanas 1-2)

**Objetivo:** Tener una app funcional donde puedo crear un proyecto, capturar vértices con GPS + foto, ver el polígono en el mapa, y calcular área/perímetro. **Sin PWA ni cola de sync todavía** (ver *ARQUITECTURA OFFLINE-FIRST → Alcance por fase*): sí **Dexie** para persistencia local. Sin sub-polígonos. Sin POIs. Sin reportes.

```
Vamos a empezar FASE 1 de TerrainCapture. Lee PROJECT_SPEC.md antes de continuar.

## OBJETIVO DE FASE 1

Construir el flujo core: crear proyecto → capturar vértices con GPS y foto → visualizar polígono en mapa satelital → calcular área/perímetro → cerrar polígono.

**Sin:** PWA, procesamiento de `sync_queue`, endpoint batch de sync, sub-polígonos, POIs, reportes, exportación. Eso viene en fases siguientes. **Sí:** Dexie + datos locales inmediatos (y excepción Fase 1 para Storage en fotos de vértice).

## TAREAS ORDENADAS

### Tarea 1.1: Setup del proyecto

- Inicializar Next.js (14 o superior, App Router) con TypeScript estricto, Tailwind — alinear versión con el bullet *Framework* del stack
- Instalar shadcn/ui con init
- Instalar dependencias: `maplibre-gl`, `@mapbox/mapbox-gl-draw`, `@turf/turf`, `dexie`, `dexie-react-hooks`, `@supabase/supabase-js`, `nanoid`, `geist`, `lucide-react`, `exifr`, `date-fns`, `zod`
- Configurar `globals.css` con las CSS variables del design system Terrain Pro
- Configurar Tailwind para usar esas variables como colors
- Setup del font stack (Geist Sans + JetBrains Mono)
- Crear estructura de carpetas según PROJECT_SPEC.md
- Crear `.env.local.example` con todas las variables necesarias

### Tarea 1.2: Supabase setup

- Crear migration SQL con el schema completo de PROJECT_SPEC.md (projects, polygons, vertices, pois, project_photos) incluyendo PostGIS
- Crear bucket `project-photos` en Storage con política pública de lectura
- Crear `lib/supabase/client.ts` con el cliente browser
- Crear `lib/supabase/server.ts` con el cliente server-side
- Crear `lib/supabase/storage.ts` con helpers para upload/delete de fotos

### Tarea 1.3: Dexie local DB

- Implementar `lib/db/schema.ts` exactamente como PROJECT_SPEC.md indica (incluye tabla `projectPhotos` aunque la UI de galería sea Fase 2)
- Crear helpers CRUD en `lib/db/projects.ts`, `lib/db/polygons.ts`, `lib/db/vertices.ts`, `lib/db/projectPhotos.ts` (este último puede exponer solo create/list/delete mínimo hasta la galería)
- Los helpers deben generar `localId` con nanoid al crear
- Todos los writes deben setear `syncStatus: 'pending'`

### Tarea 1.4: Layout base y navegación

- Implementar `app/layout.tsx` con fonts y providers
- Crear `components/layout/TopBar.tsx` con:
  - Logo TerrainCapture a la izquierda
  - Indicador de conexión online/offline (placeholder por ahora)
  - Indicador de precisión GPS con color según calidad
  - Badge de batería si `navigator.getBattery` está disponible
- Crear `components/layout/BottomNav.tsx` con 4 items: Inicio, Capturar, Galería, Ajustes
- Crear `app/(app)/layout.tsx` que envuelve con TopBar + BottomNav

### Tarea 1.5: Dashboard y creación de proyecto

- `app/(app)/page.tsx`: lista de proyectos desde Dexie con `useLiveQuery`
- Tarjeta por proyecto con nombre, ubicación, fecha, estado, área si existe polígono cerrado
- Botón flotante "+ Nuevo proyecto"
- `app/(app)/projects/new/page.tsx`: form con nombre, descripción, ubicación, cliente (nombre + contacto)
- **Al crear el proyecto:** además del `LocalProject`, crear **siempre** un `LocalPolygon` con `type: 'main'` (p. ej. nombre `"Terreno principal"`), `isClosed: false`, vinculado por `projectLocalId`, mismo `syncStatus: 'pending'`. Sin este registro la vista 1.10 no puede cargar “polígono principal + vértices”.
- Al crear, navega a `/projects/[localId]`

## DELIVERABLE DE TAREA 1.1 a 1.5

Al terminar estas 5 tareas debo poder:
1. Correr `pnpm dev` y ver el dashboard vacío
2. Crear un proyecto nuevo con datos básicos
3. Ver el proyecto en la lista
4. Al refrescar la página, el proyecto sigue ahí (persistió en Dexie)
5. El diseño usa Terrain Pro consistentemente

**NO avances a la Tarea 1.6 hasta que confirme que 1.1-1.5 funcionan perfectamente.**

Empieza con Tarea 1.1. Ejecuta los comandos necesarios, crea los archivos, y al final dime qué hiciste y cómo verifico que funcionó.
```

---

## Prompt de continuación Fase 1 (después de validar 1.1-1.5)

```
Perfecto, 1.1-1.5 funcionan. Ahora las tareas de captura de vértices.

### Tarea 1.6: Hook useGeolocation

Implementa `lib/hooks/useGeolocation.ts`:

```typescript
interface GPSReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  watch?: boolean; // watchPosition vs getCurrentPosition
}

interface UseGeolocationReturn {
  reading: GPSReading | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
  accuracyLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  requestReading: () => Promise<GPSReading>;
}
```

- Maneja permisos correctamente
- Clasifica accuracyLevel según PROJECT_SPEC.md (<3m excellent, 3-5 good, 5-10 fair, >10 poor)
- En iOS Safari los permisos pueden fallar silenciosamente: maneja el caso

### Tarea 1.7: Hook useGPSAveraged

`lib/hooks/useGPSAveraged.ts`: toma N lecturas en M segundos y calcula promedio ponderado por inverso de la precisión. Retorna:
- `isAveraging`, `progress` (0-1), `readingsCount`
- `startAveraging(targetReadings: number, maxDurationMs: number)`
- `averagedReading: GPSReading | null`
- El promedio se calcula con weighted average donde peso = 1/accuracy²

### Tarea 1.8: Mapa con MapLibre

`components/map/MapCanvas.tsx`:
- Importar dinámicamente con `next/dynamic` ssr: false
- Usar ESRI World Imagery como tile layer principal:
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- Control de zoom, geolocate control
- Props: `vertices` (LocalVertex[]), `onMapClick`, `showUserLocation`
- Renderiza markers numerados para cada vertex (P1, P2, ...)
- Si hay 3+ vertices, renderiza el polígono con fill semi-transparente verde
- Si `isClosed` true, cierra y muestra área en centro

### Tarea 1.9: Captura de vértice

`components/capture/CaptureButton.tsx`: botón flotante grande abajo-centro que al presionar:
1. Abre bottom sheet con modo de captura: "Captura rápida" (1 lectura) vs "Captura precisa" (promediada)
2. Si promediada, muestra progress con readings count + accuracy en vivo
3. Al obtener lectura, abre `VertexForm`

`components/capture/VertexForm.tsx`:
- Muestra coordenadas lat/lng en JetBrains Mono
- Accuracy del GPS con indicador de color
- Input de cámara: `<input type="file" accept="image/*" capture="environment">`
- Preview de foto tomada
- Textarea para nota
- Botones: Cancelar / Guardar vértice
- Al guardar: crea `LocalVertex` en Dexie (incl. `photoBlob`); recalcula y guarda en Dexie área/perímetro del polígono principal. **Opcional en Fase 1:** subir foto a Storage en background y setear `photoUrl` al terminar — ver *Excepción controlada — Fase 1*; no bloquear el guardado si falla la red.

### Tarea 1.10: Vista del proyecto

`app/(app)/projects/[localId]/page.tsx`:
- Carga proyecto + polígono principal + vertices con useLiveQuery
- Renderiza MapCanvas fullscreen
- Panel inferior colapsable con stats: área (m² y hectáreas), perímetro, # vértices
- Botón "Capturar vértice" (abre CaptureButton flow)
- Botón "Cerrar polígono" (solo activo con 3+ vértices)
- Lista de vértices con scroll horizontal: P1, P2, ... con thumb de foto
- Tap en vértice → abre sheet con detalles, opción editar/eliminar

### Tarea 1.11: Cálculos con Turf.js

`lib/geo/calculations.ts`:

```typescript
export function calculateArea(vertices: Vertex[]): number // retorna m²
export function calculatePerimeter(vertices: Vertex[]): number // retorna metros
export function calculateCentroid(vertices: Vertex[]): [number, number]
export function verticesToGeoJSON(vertices: Vertex[]): Feature<Polygon>
export function formatArea(areaM2: number): { value: number; unit: 'm²' | 'ha' }
// Si < 10,000 m² → m², si >= → hectáreas con 2 decimales
export function estimateAreaError(vertices: Vertex[]): number
// Error estimado basado en accuracy de cada vértice
```

Usa funciones de `@turf/turf`: `turf.area`, `turf.length`, `turf.centroid`, `turf.polygon`.

**Precisión:** `turf.area` sobre geometría en lon/lat es **aproximación plana**; para polígonos muy extensos el error respecto a geodésica puede crecer. Documentar en UI/reporte que son **estimaciones** (coherente con el disclaimer legal de Fase 4). Si en el futuro se requiere mayor rigor geodésico, evaluar bibliotecas o servicios específicos; no bloquea Fase 1.

## DELIVERABLE FINAL FASE 1

Al terminar debo poder:
1. Crear proyecto
2. Entrar a su vista, ver el mapa satelital
3. Presionar "Capturar" y elegir captura rápida o precisa
4. Ver el GPS funcionando con indicador de accuracy en vivo
5. Tomar foto con cámara del iPhone, agregar nota, guardar vértice
6. Ver el vértice renderizado en el mapa con número
7. Agregar 3+ vértices y ver el polígono formarse
8. Cerrar polígono y ver área/perímetro calculados
9. Editar/eliminar vértices individuales
10. Todo persistido en Dexie (refresh no pierde datos)

No pasa a Fase 2 hasta que esto esté sólido en iPhone 15 Pro Max real (no solo en simulador).

Empieza con Tarea 1.6.
```

---

# 🗂️ FASE 2 — Jerarquía completa (semana 3)

```
Fase 1 validada en campo. Ahora Fase 2: jerarquía completa de proyecto.

## OBJETIVO

Expandir el modelo a: proyecto con polígono principal + N sub-polígonos + N POIs + fotos adicionales del proyecto.

## TAREAS

### Tarea 2.1: Selector de entidad activa en captura

Refactoriza CaptureButton para que antes de capturar pregunte:
- ¿Qué estás capturando?
  - Vértice del terreno principal
  - Vértice de sub-área (selector de sub-polígono existente o crear nuevo)
  - Punto de interés (POI)
  - Foto adicional (solo foto, sin coordenada obligatoria)

### Tarea 2.2: Gestión de sub-polígonos

`components/project/SubPolygonManager.tsx`:
- Lista de sub-polígonos del proyecto
- Crear nuevo sub-polígono: nombre + color
- Editar nombre/color
- Eliminar sub-polígono (con confirmación, borra en cascada vértices)
- Al seleccionar sub-polígono en mapa, se resaltan sus vértices

Renderiza sub-polígonos en MapCanvas con color distintivo cada uno, fill semi-transparente, contorno sólido.

### Tarea 2.3: POIs

`app/(app)/projects/[localId]/pois/page.tsx`:
- Lista de POIs con foto thumbnail, etiqueta, nota
- Crear POI: flujo similar a vértice pero con campo "Etiqueta" libre (ej. "Pozo", "Árbol de mango", "Cisterna")
- Editar/eliminar
- Click en POI en mapa abre sheet con detalles

Marker de POI en mapa con icono distintivo (ej. Lucide `MapPin` en color ámbar) y label visible.

### Tarea 2.4: Fotos adicionales

`app/(app)/projects/[localId]/gallery/page.tsx`:
- Grid de todas las fotos del proyecto (de vértices, POIs y adicionales)
- Filtro por tipo de origen
- Agregar foto adicional con caption (no requiere GPS)
- Ver en fullscreen con pinch-to-zoom
- Metadata de cada foto: fecha, coords si tiene, origen

### Tarea 2.5: Estadísticas del proyecto

`components/project/PolygonStats.tsx` expandido:
- Área total del terreno principal
- Área de cada sub-polígono
- Área "libre" = terreno - suma de sub-áreas
- Total de vértices, POIs, fotos
- Perímetro principal y de cada sub
- Todo en cards con formato limpio y tipografía mono para números

## DELIVERABLE FASE 2

Puedo modelar completamente un proyecto: terreno principal + cabaña + pozo + árboles importantes + fotos contextuales, y ver todo renderizado correctamente en el mapa con estadísticas.

Empieza con Tarea 2.1.
```

---

# 🔌 FASE 3 — Offline-First & Sync (semana 4)

```
Fase 2 lista. Ahora lo más crítico: offline real y sincronización.

## OBJETIVO

La app debe funcionar 100% sin internet y sincronizar automáticamente cuando hay conexión.

## TAREAS

### Tarea 3.1: PWA setup con next-pwa

- Instalar `@ducanh2912/next-pwa`
- Configurar `next.config.mjs` con runtime caching para:
  - App shell (NetworkFirst)
  - Tiles de ESRI (CacheFirst, 30 días, max 2000 entradas)
  - Imágenes de Supabase Storage (CacheFirst, 7 días)
  - Font files (CacheFirst, 1 año)
- Crear `app/manifest.ts` con icons, colors, display standalone
- Generar icons en todos los tamaños requeridos (usa sharp en un script)
- Splash screens para iOS (apple-touch-icon + apple-touch-startup-image)
- Meta tags iOS en layout.tsx: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`

### Tarea 3.2: Tile caching custom

next-pwa no cachea tiles que aún no has visitado. Necesitamos pre-caching de zonas.

`lib/map/tile-cache.ts`:
- Función `precacheArea(bounds, minZoom, maxZoom)` que descarga todos los tiles de un bounding box
- Guarda blobs en Dexie `tileCache` table
- Hook `useTileCache()` con progress
- UI en Settings: "Descargar mapa de esta zona" (usuario navega a zona deseada y confirma)

`lib/map/tile-providers.ts`: tile source custom de MapLibre que primero busca en Dexie, luego va a network, y al obtener guarda en Dexie.

### Tarea 3.3: Sync manager

`lib/db/sync.ts`:

```typescript
class SyncManager {
  async enqueueCreate(entityType, entityLocalId, payload)
  async enqueueUpdate(entityType, entityLocalId, payload)
  async enqueueDelete(entityType, entityLocalId)
  async processQueue(): Promise<SyncResult>
  async retryFailed()
  subscribe(callback: (status: SyncStatus) => void)
}
```

Lógica:
1. Procesa queue en orden FIFO
2. Por cada entry: sube a Supabase, actualiza `server_id` en Dexie, marca synced
3. Fotos: sube primero la foto a Storage, obtiene URL, luego crea/actualiza el record
4. Manejo de errores: incrementa `attemptCount`, exponential backoff, max 5 intentos
5. Dependencias: no subir un vertex antes que su polygon exista en server (ordenamiento topológico simple)

### Tarea 3.4: Online status y auto-sync

`lib/hooks/useOnlineStatus.ts`: combina `navigator.onLine` con **comprobación activa** (porque `navigator.onLine` miente en iOS). No existe un “/health” estándar público de Supabase; usar por ejemplo **`HEAD` o `GET`** a `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/` con header `apikey: <anon key>` (y opcionalmente `Authorization: Bearer <anon key>`), timeout corto (2–4 s): status 2xx ⇒ online; fallo de red o timeout ⇒ offline. Alternativa equivalente: `fetch` a la URL del proyecto con `no-cors` no sirve para distinguir; preferir REST con respuesta observable.

`lib/hooks/useSyncQueue.ts`:
- Observa online status
- Cuando true: llama `syncManager.processQueue()` automáticamente
- Re-intenta cada 30s si hay items pendientes
- Expone: `pendingCount`, `isSyncing`, `lastSync`, `syncNow()`

### Tarea 3.5: UI de sync

`components/sync/OfflineBanner.tsx`: banner amarillo arriba cuando offline.

`components/sync/SyncIndicator.tsx`: icono en TopBar que muestra:
- ☁️ con ✓ si todo synced
- ☁️ con número si hay pendientes
- 🔄 animado si syncing
- ⚠️ si hay fallos
- Tap abre modal con detalle de la cola

### Tarea 3.6: Resolución de conflictos

Para uso personal es simple: last-write-wins en el server. Pero:
- Si un vertex fue borrado en server (admin tools) y local lo edita, detectar 404 y preguntar al usuario
- Si foto falla al subir 3 veces, marcar record como "sync_error" y mostrar en UI con opción de reintento manual

## DELIVERABLE FASE 3

1. Pongo el iPhone en modo avión completo
2. Abro la app, creo proyecto, capturo 5 vértices con fotos, creo un POI
3. Todo funciona sin red
4. Al salir a zona con wifi/datos, la cola se procesa sola
5. Veo en Supabase dashboard todos los records correctamente
6. Las fotos están en Storage
7. Pre-descargo mapa de Zipolite en casa, voy sin señal, el mapa satelital sigue funcionando

Este es el deliverable más importante. Tómate el tiempo necesario.

Empieza con Tarea 3.1.
```

---

# 📊 FASE 4 — Exportación y Reportes (semana 5)

```
Fase 3 validada en campo sin internet. Ahora los deliverables de valor comercial.

## OBJETIVO

Generar todos los formatos de exportación y reportes profesionales configurables para compartir con clientes.

## TAREAS

### Tarea 4.1: Exportación KML

`lib/geo/kml.ts`:
- Genera KML válido con el proyecto completo
- Polígono principal con estilo verde
- Sub-polígonos con sus colores
- POIs como Placemarks con nombre y descripción
- Foto de cada vertex embebida como `<description>` HTML
- Descargar como blob con nombre: `{project_name}_{fecha}.kml`

Test: abrir en Google Earth Pro y verificar que renderiza correctamente.

### Tarea 4.2: Exportación GeoJSON

`lib/geo/geojson.ts`:
- FeatureCollection con todos los polygons + POIs
- Properties con metadata: local_id, name, area_m2, etc.
- Formato indentado, UTF-8

### Tarea 4.3: Exportación CSV

`lib/geo/csv.ts`:
- Tabla de vértices: id, polygon_name, order_index, latitude, longitude, accuracy, altitude, note, photo_url
- Tabla de POIs separada
- Descarga como .csv o .xlsx (opcional con SheetJS)

### Tarea 4.4: Configuración de reporte

`components/report/ReportConfig.tsx`:
- Toggle por sección:
  - ✅ Portada con logo Gamasoft y nombre proyecto
  - ✅ Datos del cliente
  - ✅ Mapa con polígono (captura del MapCanvas)
  - ✅ Estadísticas (área, perímetro, vértices)
  - ✅ Tabla de coordenadas de vértices
  - ✅ Galería de fotos con notas
  - ✅ Lista de POIs con fotos y coords
  - ✅ Sub-polígonos con sus datos
  - ✅ Disclaimer legal ("estimación, no sustituye topografía certificada")
  - ✅ Footer con datos de contacto Gamasoft
- Campos adicionales editables:
  - Nombre del cliente (prellenado)
  - Fecha del levantamiento (prellenada)
  - Notas ejecutivas (textarea)
- Preview en vivo a la derecha (desktop) o debajo (móvil)
- Botones: Generar PDF / Generar PNG / Compartir

### Tarea 4.5: Generación de PDF

`components/report/ReportPDF.tsx` con `@react-pdf/renderer`:
- Portada con logo, nombre proyecto, ubicación, fecha
- Página de mapa: captura del mapa renderizada (usa `html-to-image` sobre MapCanvas oculto con el polígono, luego inserta como Image en PDF)
- Página de estadísticas con tabla profesional
- Página de tabla de coordenadas
- Galería de fotos: grid 2x3 por página, con caption
- POIs listados
- Disclaimer al final
- Footer en cada página con logo Gamasoft pequeño y número de página

Plantilla en oscuro o claro? → Reportes para clientes = modo CLARO profesional. Solo la app es oscura. Paleta del PDF: blanco + verde oscuro corporativo + ámbar para acentos.

### Tarea 4.6: Generación de PNG para WhatsApp

`components/report/ReportPNG.tsx`:
- Template HTML estilizado, 1080x1920 (formato historia/vertical)
- Mapa capturado arriba (40% del alto)
- Stats grandes: ÁREA TOTAL con número big + unit
- # vértices, perímetro
- Mini galería de 4 fotos más representativas
- Logo Gamasoft footer
- Colores vibrantes para que destaque en WhatsApp

Genera con `html-to-image` → `toPng()` → blob.

### Tarea 4.7: Compartir

`lib/utils/share.ts`:

```typescript
async function shareReport(blob: Blob, filename: string, text?: string) {
  if (navigator.canShare && navigator.canShare({ files: [...] })) {
    await navigator.share({ files: [new File([blob], filename)], text });
  } else {
    // Fallback: descarga + abre WhatsApp Web con texto
    downloadBlob(blob, filename);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}
```

En iOS Safari, Web Share API funciona bien para imágenes. PDF puede variar; si falla, fallback a descarga.

## DELIVERABLE FASE 4

Puedo:
1. Abrir cualquier proyecto
2. Ir a "Generar reporte"
3. Configurar qué secciones incluir
4. Descargar KML y abrirlo en Google Earth ✓
5. Descargar PDF profesional y enviarlo a un cliente
6. Generar PNG y compartirlo directo a WhatsApp desde la app
7. Compartir GeoJSON/CSV para uso técnico

Empieza con Tarea 4.1.
```

---

# 🎯 FASE 5 — Polish, testing real, optimización (semana 6)

```
Todas las features están listas. Ahora a pulir y validar en Huatulco real.

## TAREAS

### 5.1: Performance audit

- Lighthouse PWA score >90
- Bundle analyzer: identificar y lazy-load módulos grandes
- Optimización de imágenes: convertir fotos a WebP antes de subir a Storage (client-side con canvas)
- Thumbnail generation automática (200x200 WebP) para listas

### 5.2: Battery & GPS optimization

- Modo "ahorro de batería" en Settings: usa `enableHighAccuracy: false` cuando GPS no es crítico
- Pausa watchPosition al abandonar pantalla de captura
- Sugerir al usuario bajar brillo cuando detecte uso prolongado en campo

### 5.3: Empty states y onboarding

- Dashboard vacío: ilustración + CTA claro
- Primer uso: tour corto de 3 pantallas explicando captura, offline, reporte
- Permisos: pantalla explicativa antes de pedir GPS y cámara (iOS especialmente)

### 5.4: Edge cases y errores

- Manejo de permisos denegados (GPS, cámara): mensajes claros de cómo habilitarlos en iOS
- Fotos demasiado grandes: compresión automática cliente con canvas
- Supabase Storage lleno o falla: retry + UI clara
- Polígono con vértices colineales o auto-intersectante: validación y advertencia
- Coordenadas fuera de México: confirmación por si hay error

### 5.5: Testing en campo

Ve físicamente a Huatulco con la app:
- [ ] Capturar un terreno de 500m² con señal
- [ ] Capturar un terreno de 2 hectáreas sin señal
- [ ] Verificar precisión con cinta métrica en un lado conocido
- [ ] Pre-cachear zona, ir sin datos, capturar, regresar y verificar sync
- [ ] Generar reporte PDF y enviarlo a un cliente real
- [ ] Verificar consumo de batería en captura de 30 minutos
- [ ] Probar bajo sol directo (legibilidad)

### 5.6: Documentación

- README con capturas de pantalla y flujo
- CHANGELOG.md
- Notas de deploy en Vercel + Supabase

### 5.7: Feature flags para futuras funcionalidades

Dejar preparado en Settings:
- 🔜 Integración con CostaVista (enviar polígono directo como lote)
- 🔜 Múltiples usuarios (cuando crezca)
- 🔜 Comparación de terrenos
- 🔜 Estimación de precio por m² según zona

## DELIVERABLE FINAL

App en producción en TerrainCapture.gamasoft.mx (o subdominio que prefieras), validada con 3+ terrenos reales en Huatulco, con al menos 1 reporte compartido a cliente real.

Empieza con 5.1.
```

---

# 💡 Tips finales para trabajar con Cursor

1. **Fija este archivo** como contexto permanente con `@PROJECT_SPEC.md`
2. **Haz commit entre tareas** con mensajes claros (`feat(capture): add vertex form with camera`)
3. **Si Cursor alucina**, reafirma con "vuelve a leer PROJECT_SPEC.md, sección [X]"
4. **Usa Claude Sonnet 4** en Cursor para tareas complejas, Haiku para refactors triviales
5. **Si una fase se vuelve muy grande**, divídela en sub-fases con Cursor
6. **No aceptes código que mezcla responsabilidades**: si un componente crece, pídele que lo refactorice antes de seguir
7. **Prueba en iPhone 15 Pro Max real** lo antes posible, no confíes solo en el simulador o devtools

---

# 🎨 Apéndice: Referencias visuales para design system

Cuando Cursor dude del diseño, referencia estas apps:
- **Strava** — app dashboard, stats grandes, tipografía mono para datos
- **Linear** — paleta oscura con acentos, jerarquía tipográfica
- **Gaia GPS** — mapa fullscreen con controles superpuestos
- **Arc browser** — uso de gradientes sutiles
- **Vercel dashboard** — cards, espaciado, muted colors

---

**Suerte, Rick. Construye algo que te enorgullezca.**
— Gamasoft IA Technologies S.A.S.

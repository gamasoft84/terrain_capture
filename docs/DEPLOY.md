# Deploy: Vercel + Supabase

Guía breve para publicar **TerrainCapture** y enlazar backend/storage.

## 1. Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta la migración inicial del repo  
   [`supabase/migrations/20250417120000_initial.sql`](../supabase/migrations/20250417120000_initial.sql)  
   (o `supabase link` + `supabase db push` si usas la CLI).
3. **Storage**: confirma el bucket **`project-photos`** (o el nombre que use el código) y políticas que permitan a los clientes autenticados/anónimos según tu modelo. El [`supabase/README.md`](../supabase/README.md) resume el enfoque de desarrollo.
4. Revisa **RLS** y políticas de Storage antes de abrir el proyecto a usuarios reales.

Variables que la app espera (ver [`.env.local.example`](../.env.local.example)):

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (cliente / PWA) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor u operaciones admin; **no** exponer como `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_HARDCODED_USER_ID` | Si el flujo actual asocia datos a un usuario fijo en desarrollo |
| `NEXT_PUBLIC_MAPTILER_KEY` | Si el mapa usa teselas MapTiler (opcional según configuración) |

## 2. Vercel

1. Importa el repositorio en [Vercel](https://vercel.com).
2. **Root directory**: raíz del repo (`terrain_capture_pwa` si el Git monorepo tiene carpeta padre).
3. **Build command**: `npm run build` (el proyecto usa `next build --webpack` en script).
4. **Install**: `npm install` (por defecto).
5. En **Settings → Environment Variables**, copia las mismas claves que en `.env.local` para Production (y Preview si quieres previews con Supabase de staging).

Notas:

- No subas `.env.local` al repositorio; solo define variables en el panel de Vercel.
- Tras cambiar variables, redeploy para que el build y runtime las lean.

## 3. Dominio

En Vercel: **Settings → Domains** y apunta el DNS según las instrucciones (CNAME/A).  
El objetivo del spec es algo como `TerrainCapture.gamasoft.mx` o el subdominio que elijas.

## 4. Checklist post-deploy

- [ ] Crear proyecto de prueba en la PWA y verificar subida de fotos al bucket.
- [ ] Probar una sesión offline y recuperación de sync al volver online.
- [ ] Generar un PDF de reporte y comprobar enlaces públicos/temporales si los usas.

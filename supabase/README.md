# Supabase — TerrainCapture

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor**, ejecuta el contenido de `migrations/20250417120000_initial.sql` (o usa la CLI: `supabase link` y `supabase db push`).
3. Confirma que el bucket **`project-photos`** existe en **Storage** y que las políticas permiten lectura y (en desarrollo) subida con la anon key.
4. Copia `.env.local.example` a `.env.local` y rellena URL, anon key y opcionalmente `SUPABASE_SERVICE_ROLE_KEY` solo para scripts server-side.

Las políticas del SQL de ejemplo son permisivas para Fase 1; endurecer antes de producción multiusuario.

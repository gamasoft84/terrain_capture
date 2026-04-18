-- TerrainCapture — schema inicial (PostGIS + tablas core)
-- Aplicar con: Supabase CLI `supabase db push` o SQL Editor en el dashboard.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_label TEXT,
  client_name TEXT,
  client_contact TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'shared')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('main', 'sub')),
  color TEXT DEFAULT '#10b981',
  area_m2 NUMERIC(12, 2),
  perimeter_m NUMERIC(12, 2),
  centroid GEOGRAPHY(POINT, 4326),
  geometry GEOGRAPHY(POLYGON, 4326),
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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
  capture_method TEXT DEFAULT 'gps_single' CHECK (
    capture_method IN ('gps_single', 'gps_averaged', 'manual_map', 'photo_exif')
  )
);

CREATE TABLE points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  gps_accuracy_m NUMERIC(6, 2),
  photo_url TEXT,
  thumbnail_url TEXT,
  note TEXT,
  captured_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX idx_polygons_project ON polygons(project_id);
CREATE INDEX idx_vertices_polygon ON vertices(polygon_id);
CREATE INDEX idx_vertices_order ON vertices(polygon_id, order_index);
CREATE INDEX idx_pois_project ON points_of_interest(project_id);
CREATE INDEX idx_photos_project ON project_photos(project_id);
CREATE INDEX idx_polygons_geometry ON polygons USING GIST(geometry);
CREATE INDEX idx_vertices_coords ON vertices USING GIST(coordinates);

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lectura pública project-photos" ON storage.objects;
DROP POLICY IF EXISTS "Subida anon project-photos (dev / Fase 1)" ON storage.objects;
DROP POLICY IF EXISTS "Borrado anon project-photos (dev / Fase 1)" ON storage.objects;

CREATE POLICY "Lectura pública project-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos');

CREATE POLICY "Subida anon project-photos (dev / Fase 1)"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-photos');

CREATE POLICY "Borrado anon project-photos (dev / Fase 1)"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-photos');

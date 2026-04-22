-- Add updated_at for child entities (sync pull/push LWW)

-- Vertices
ALTER TABLE vertices
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- POIs
ALTER TABLE points_of_interest
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Project gallery photos
ALTER TABLE project_photos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure columns are not null going forward
ALTER TABLE vertices
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE points_of_interest
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE project_photos
  ALTER COLUMN updated_at SET NOT NULL;

-- Auto-update `updated_at` on UPDATE if client forgets
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vertices_updated_at ON vertices;
CREATE TRIGGER trg_vertices_updated_at
BEFORE UPDATE ON vertices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pois_updated_at ON points_of_interest;
CREATE TRIGGER trg_pois_updated_at
BEFORE UPDATE ON points_of_interest
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_photos_updated_at ON project_photos;
CREATE TRIGGER trg_project_photos_updated_at
BEFORE UPDATE ON project_photos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


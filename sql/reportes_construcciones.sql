-- ============================================================
-- Tabla: reportes_construcciones
-- Reportes ciudadanos vinculados a construcciones
-- ============================================================

CREATE TABLE IF NOT EXISTS reportes_construcciones (
  id SERIAL PRIMARY KEY,
  id_construccion TEXT,
  clave_construccion TEXT,
  bloque TEXT,
  estado_observado TEXT NOT NULL,
  prioridad TEXT NOT NULL,
  comentario TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  estado_gestion TEXT DEFAULT 'Pendiente',
  fecha_reporte TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fuente TEXT DEFAULT 'Geoportal Web',
  geom GEOMETRY(Point, 4326)
);

-- Trigger: generar geom automaticamente desde lat/lon
CREATE OR REPLACE FUNCTION generar_geom_reporte_construccion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reportes_construcciones_geom ON reportes_construcciones;
CREATE TRIGGER trg_reportes_construcciones_geom
BEFORE INSERT OR UPDATE ON reportes_construcciones
FOR EACH ROW EXECUTE FUNCTION generar_geom_reporte_construccion();

-- Vista GeoJSON para Leaflet
CREATE OR REPLACE VIEW v_reportes_construcciones_geojson AS
SELECT
  id,
  id_construccion,
  clave_construccion,
  bloque,
  estado_observado,
  prioridad,
  comentario,
  lat,
  lon,
  estado_gestion,
  fecha_reporte,
  fuente,
  ST_AsGeoJSON(geom)::json AS geometry
FROM reportes_construcciones;

-- RLS
ALTER TABLE reportes_construcciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_rc" ON reportes_construcciones;
DROP POLICY IF EXISTS "anon_select_rc" ON reportes_construcciones;
CREATE POLICY "anon_insert_rc" ON reportes_construcciones FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_rc" ON reportes_construcciones FOR SELECT USING (true);

-- Indices
CREATE INDEX IF NOT EXISTS idx_rc_geom ON reportes_construcciones USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rc_id_construccion ON reportes_construcciones(id_construccion);

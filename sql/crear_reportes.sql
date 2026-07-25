-- ============================================================
-- TABLA: reportes_ciudadanos
-- Sistema de reportes ciudadanos para el Geoportal de Cuenca
-- ============================================================

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS public.reportes_ciudadanos (
    id          SERIAL PRIMARY KEY,
    tipo        TEXT NOT NULL,
    descripcion TEXT,
    nombre      TEXT,
    email       TEXT,
    telefono    TEXT,
    fecha       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado      TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_revision','resuelto','rechazado')),
    lat         NUMERIC(10,7) NOT NULL,
    lon         NUMERIC(10,7) NOT NULL,
    geom        GEOMETRY(Point,4326)
);

-- 2. Trigger: genera geom automaticamente desde lat/lon
CREATE OR REPLACE FUNCTION public.generar_geom_reporte()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_geom_reporte ON public.reportes_ciudadanos;

CREATE TRIGGER trg_geom_reporte
    BEFORE INSERT OR UPDATE OF lat, lon
    ON public.reportes_ciudadanos
    FOR EACH ROW
    EXECUTE FUNCTION public.generar_geom_reporte();

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_reportes_geom ON public.reportes_ciudadanos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON public.reportes_ciudadanos (estado);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON public.reportes_ciudadanos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON public.reportes_ciudadanos (tipo);

-- 4. Permisos RLS (Row Level Security)
ALTER TABLE public.reportes_ciudadanos ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede INSERTAR un reporte (ciudadanos)
CREATE POLICY "ciudadanos_insert"
    ON public.reportes_ciudadanos
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Cualquiera puede LEER reportes (para el geoportal)
CREATE POLICY "ciudadanos_select"
    ON public.reportes_ciudadanos
    FOR SELECT
    TO anon
    USING (true);

-- Solo el servicio puede actualizar/eliminar
CREATE POLICY "admin_update"
    ON public.reportes_ciudadanos
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "admin_delete"
    ON public.reportes_ciudadanos
    FOR DELETE
    TO service_role
    USING (true);

-- 5. Vista resumen (opcional)
CREATE OR REPLACE VIEW public.v_reportes_resumen AS
SELECT
    tipo,
    estado,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
    COUNT(*) FILTER (WHERE fecha > NOW() - INTERVAL '7 days') AS ultimos_7_dias
FROM public.reportes_ciudadanos
GROUP BY tipo, estado
ORDER BY total DESC;

-- ============================================================
-- CATEGORIAS DE PROBLEMAS (valores sugeridos)
-- ============================================================
-- 'Bache en via'
-- 'Alumbrado publico danado'
-- 'Basura acumulada'
-- 'Inundacion'
-- 'Deslizamiento'
-- 'Vandalismo'
-- 'Arbol caido'
-- 'Tapa de alcantarilla falta'
-- 'Fuga de agua'
-- 'Parque deteriorado'
-- 'Senalizacion danada'
-- 'Otro'
-- ============================================================

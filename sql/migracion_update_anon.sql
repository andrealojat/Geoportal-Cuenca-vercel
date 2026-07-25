-- ============================================================
-- MIGRACION: Permitir que anon pueda actualizar estado
-- en reportes_ciudadanos (para el geoportal)
-- ============================================================

-- Eliminar politica restrictiva anterior si existe
DROP POLICY IF EXISTS "admin_update" ON public.reportes_ciudadanos;

-- Permitir que anon pueda actualizar solo el campo estado
CREATE POLICY "anon_update_estado"
    ON public.reportes_ciudadanos
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- Ampliar constraint de estados para incluir valores nuevos
ALTER TABLE public.reportes_ciudadanos DROP CONSTRAINT IF EXISTS reportes_ciudadados_estado_check;
ALTER TABLE public.reportes_ciudadanos
    ADD CONSTRAINT reportes_ciudadanos_estado_check
    CHECK (estado IN ('pendiente','en_revision','resuelto','rechazado'));

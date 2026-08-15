-- ============================================================
-- SIEMBRA NATIVA CLUB - Log de notas por socio
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Reemplaza el campo único profiles.notas_admin (que se pisaba)
-- por un historial de notas fechadas con tipo (consulta médica,
-- REPROCANN, pago, general). Solo visible/editable por admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS socio_notas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tipo       TEXT NOT NULL DEFAULT 'general'
             CHECK (tipo IN ('general', 'consulta_medica', 'reprocann', 'pago')),
  contenido  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS socio_notas_socio_idx ON socio_notas (socio_id, created_at DESC);

-- Solo admin: las notas pueden contener datos de salud (Ley 25.326)
ALTER TABLE socio_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_crud_socio_notas" ON socio_notas;
CREATE POLICY "admin_crud_socio_notas"
  ON socio_notas FOR ALL
  USING (get_my_role() = 'admin');

-- Migrar las notas existentes de profiles.notas_admin como primera
-- entrada del log (solo si el socio aún no tiene notas migradas)
INSERT INTO socio_notas (socio_id, tipo, contenido)
SELECT id, 'general', notas_admin
FROM profiles
WHERE notas_admin IS NOT NULL
  AND btrim(notas_admin) <> ''
  AND NOT EXISTS (SELECT 1 FROM socio_notas sn WHERE sn.socio_id = profiles.id);

-- profiles.notas_admin queda deprecado (la app deja de usarlo)
COMMENT ON COLUMN profiles.notas_admin IS 'DEPRECADO: usar tabla socio_notas';

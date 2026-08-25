-- ============================================================
-- SIEMBRA NATIVA CLUB - Consultas de socios
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Los socios dejan dudas/consultas; el admin las ve con los datos
-- de contacto del socio, puede responder con un texto breve y
-- marcarlas atendidas (el socio ve estado y respuesta en la app).
-- ============================================================

CREATE TABLE IF NOT EXISTS consultas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL DEFAULT 'general'
               CHECK (tipo IN ('general', 'pedidos', 'reprocann', 'pagos')),
  mensaje      TEXT NOT NULL CHECK (btrim(mensaje) <> ''),
  estado       TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente', 'atendida')),
  respuesta    TEXT,             -- respuesta breve visible para el socio
  atendida_por UUID REFERENCES profiles(id),
  atendida_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consultas_socio_idx  ON consultas (socio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consultas_estado_idx ON consultas (estado, created_at DESC);

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

-- El socio crea consultas propias y ve solo las suyas
DROP POLICY IF EXISTS "socio_crea_consultas" ON consultas;
CREATE POLICY "socio_crea_consultas"
  ON consultas FOR INSERT
  WITH CHECK (socio_id = auth.uid());

DROP POLICY IF EXISTS "socio_ve_propias_consultas" ON consultas;
CREATE POLICY "socio_ve_propias_consultas"
  ON consultas FOR SELECT
  USING (socio_id = auth.uid());

-- El admin ve y gestiona todas
DROP POLICY IF EXISTS "admin_crud_consultas" ON consultas;
CREATE POLICY "admin_crud_consultas"
  ON consultas FOR ALL
  USING (get_my_role() = 'admin');

-- Verificación
SELECT COUNT(*) AS consultas FROM consultas;

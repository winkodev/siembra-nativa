-- ============================================================
-- SIEMBRA NATIVA CLUB - Actividad de socios
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- audit_log registra solo acciones de ADMIN. Esta tabla registra lo que
-- hacen los SOCIOS (guardar perfil, subir certificado, confirmar pedido,
-- subir comprobante, aceptar términos, enviar consulta), para que el
-- admin se entere desde Admin → Actividad.
-- Se escribe desde las server actions con el service client; el socio
-- no necesita permisos sobre la tabla.
-- ============================================================

CREATE TABLE IF NOT EXISTS actividad_socios (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- guardar_perfil | aceptar_terminos | subir_certificado | crear_pedido | subir_comprobante | crear_consulta
  accion     TEXT NOT NULL,
  -- Detalle legible (ej: campos que cargó, número de pedido)
  detalle    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS actividad_socios_fecha_idx ON actividad_socios (created_at DESC);
CREATE INDEX IF NOT EXISTS actividad_socios_socio_idx ON actividad_socios (socio_id, created_at DESC);

ALTER TABLE actividad_socios ENABLE ROW LEVEL SECURITY;

-- Solo el admin la lee
DROP POLICY IF EXISTS "actividad_socios_admin_lee" ON actividad_socios;
CREATE POLICY "actividad_socios_admin_lee" ON actividad_socios FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS filas FROM actividad_socios;

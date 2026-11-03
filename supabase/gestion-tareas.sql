-- ============================================================
-- SIEMBRA NATIVA CLUB - Gestión: tareas con vencimiento (solo superadmin)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Tareas simples: título, notas, vencimiento y repetición opcional
-- (mensual o anual). Al marcar hecha una tarea repetitiva, la app crea
-- la siguiente con la misma fecha del mes/año siguiente (serie_id las agrupa).
-- ============================================================

CREATE TABLE IF NOT EXISTS tareas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo      TEXT NOT NULL,
  notas       TEXT,
  vence_at    DATE NOT NULL,
  -- ninguna | mensual | anual
  recurrencia TEXT NOT NULL DEFAULT 'ninguna' CHECK (recurrencia IN ('ninguna', 'mensual', 'anual')),
  -- Agrupa las ocurrencias de una misma tarea repetitiva
  serie_id    UUID,
  hecha_at    TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tareas_vence_idx ON tareas (hecha_at, vence_at);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- Solo superadmin (es_superadmin() viene de tesoreria.sql)
DROP POLICY IF EXISTS "tareas_super" ON tareas;
CREATE POLICY "tareas_super" ON tareas FOR ALL USING (es_superadmin());

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS tareas FROM tareas;

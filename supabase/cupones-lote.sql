-- ============================================================
-- SIEMBRA NATIVA CLUB - Cupones masivos (lotes)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- "Cupón para todos": el admin crea de una vez un cupón individual por
-- socio. Todos comparten un lote_id para poder listarlos y anular los
-- que no se usaron. Cada cupón sigue siendo personal y de un solo uso.
-- ============================================================

ALTER TABLE cupones
  ADD COLUMN IF NOT EXISTS lote_id UUID;

CREATE INDEX IF NOT EXISTS cupones_lote_idx ON cupones (lote_id) WHERE lote_id IS NOT NULL;

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_name = 'cupones' AND column_name = 'lote_id';

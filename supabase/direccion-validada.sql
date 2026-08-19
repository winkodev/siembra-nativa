-- ============================================================
-- SIEMBRA NATIVA CLUB - Validación de dirección (Georef)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- La dirección del socio se elige de un autocompletado contra la API
-- Georef del Estado argentino (apis.datos.gob.ar). Se guardan las
-- coordenadas para habilitar a futuro zonas de entrega y costos por
-- zona. Sin datos personales enviados a terceros privados.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitud               NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitud              NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS direccion_normalizada TEXT,
  ADD COLUMN IF NOT EXISTS direccion_validada_at TIMESTAMPTZ;

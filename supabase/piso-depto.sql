-- ============================================================
-- SIEMBRA NATIVA CLUB - Piso y departamento
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Georef valida calle y altura; el piso/depto lo completa el socio
-- a mano porque no forma parte del dato geolocalizado.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS piso_depto TEXT;

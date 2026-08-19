-- ============================================================
-- SIEMBRA NATIVA CLUB - Checks de preparación del pedido
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Antes de aprobar, el club debe marcar dos controles: pedido
-- armado y comprobante chequeado. Cada marca guarda QUIÉN y CUÁNDO
-- (trazabilidad), y sin ambas no se habilita la aprobación.
-- ============================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS armado_por     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS armado_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comprobante_ok_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comprobante_ok_at  TIMESTAMPTZ;

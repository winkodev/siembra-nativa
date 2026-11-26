-- ============================================================
-- SIEMBRA NATIVA CLUB - Gastos fijos en dólares y cuotas de deudas
-- Ejecutar en: Supabase Dashboard → SQL Editor (se puede repetir)
-- Requiere: personal-costos-objetivos.sql
-- ============================================================
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS moneda   TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS', 'USD')),
  -- Cuota de una deuda: Objetivos cuenta la cuota en lugar de la deuda entera
  ADD COLUMN IF NOT EXISTS deuda_id UUID REFERENCES tes_deudas(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT COUNT(*) AS tareas_con_monto FROM tareas WHERE monto IS NOT NULL;

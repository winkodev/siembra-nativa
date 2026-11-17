-- ============================================================
-- SIEMBRA NATIVA CLUB - Días bloqueados para entregas (vacaciones, feriados)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El superadmin bloquea un día completo (franja_id NULL) o una franja puntual
-- de un día. Los días/franjas bloqueados no se le ofrecen al socio al
-- confirmar el pedido. Lo leen todos los usuarios logueados (el socio lo
-- necesita para filtrar); solo el superadmin escribe.
-- ============================================================

CREATE TABLE IF NOT EXISTS fechas_bloqueadas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha      DATE NOT NULL,
  -- NULL = el día entero; si no, solo esa franja ese día
  franja_id  UUID REFERENCES franjas_horarias(id) ON DELETE CASCADE,
  motivo     TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo bloqueo por (día, franja) y uno solo por día entero
CREATE UNIQUE INDEX IF NOT EXISTS fechas_bloq_dia_idx    ON fechas_bloqueadas (fecha) WHERE franja_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fechas_bloq_franja_idx ON fechas_bloqueadas (fecha, franja_id) WHERE franja_id IS NOT NULL;

ALTER TABLE fechas_bloqueadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fechas_bloq_lectura" ON fechas_bloqueadas;
CREATE POLICY "fechas_bloq_lectura" ON fechas_bloqueadas FOR SELECT TO authenticated USING (true);

-- es_superadmin() viene de tesoreria.sql
DROP POLICY IF EXISTS "fechas_bloq_super" ON fechas_bloqueadas;
CREATE POLICY "fechas_bloq_super" ON fechas_bloqueadas FOR ALL USING (es_superadmin());

-- ------------------------------------------------------------
-- Red de seguridad en la base: un pedido de socio no puede crearse
-- para un día bloqueado entero (el bloqueo por franja lo valida la app).
-- Los pedidos manuales del admin no se frenan.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION pedidos_fecha_no_bloqueada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entrega_fecha IS NOT NULL AND NOT COALESCE(NEW.manual, FALSE) AND EXISTS (
    SELECT 1 FROM fechas_bloqueadas WHERE fecha = NEW.entrega_fecha AND franja_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Ese día no hay entregas. Elegí otra fecha.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedidos_fecha_bloqueada ON pedidos;
CREATE TRIGGER trg_pedidos_fecha_bloqueada
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pedidos_fecha_no_bloqueada();

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS bloqueos FROM fechas_bloqueadas;

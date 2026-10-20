-- ============================================================
-- SIEMBRA NATIVA CLUB - Salidas manuales de stock (solo superadmin)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Para descontar flores que salieron sin pedido en la app (pedido
-- informal, merma, muestra). Descuenta FIFO de los lotes igual que un
-- pedido aprobado y deja registro con motivo, quién y cuándo.
-- ============================================================

CREATE TABLE IF NOT EXISTS egresos_stock (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  genetica_id UUID NOT NULL REFERENCES geneticas(id) ON DELETE CASCADE,
  gramos      NUMERIC(10,2) NOT NULL CHECK (gramos > 0),
  motivo      TEXT NOT NULL,
  admin_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS egresos_stock_fecha_idx ON egresos_stock (created_at DESC);

ALTER TABLE egresos_stock ENABLE ROW LEVEL SECURITY;

-- Los admins lo ven; se escribe solo a través de la función
DROP POLICY IF EXISTS "egresos_stock_admin_lee" ON egresos_stock;
CREATE POLICY "egresos_stock_admin_lee" ON egresos_stock FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));

-- Descuenta FIFO (lotes más antiguos primero) y registra la salida.
CREATE OR REPLACE FUNCTION egreso_manual_stock(
  p_genetica_id UUID,
  p_gramos      NUMERIC,
  p_motivo      TEXT
)
RETURNS UUID AS $$
DECLARE
  v_super     BOOLEAN;
  v_restante  NUMERIC := p_gramos;
  v_total     NUMERIC;
  lote_row    RECORD;
  v_id        UUID;
BEGIN
  SELECT superadmin INTO v_super FROM profiles WHERE id = auth.uid() AND rol = 'admin';
  IF NOT COALESCE(v_super, FALSE) THEN
    RAISE EXCEPTION 'Solo el superadmin puede registrar salidas manuales';
  END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN
    RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0';
  END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Indicá el motivo de la salida';
  END IF;

  -- Serializa con la creación/aprobación de pedidos
  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  SELECT COALESCE(SUM(cantidad_gramos), 0) INTO v_total FROM stock WHERE genetica_id = p_genetica_id;
  IF v_total < p_gramos THEN
    RAISE EXCEPTION 'Stock insuficiente: hay %g físicos de esta genética', v_total;
  END IF;

  FOR lote_row IN
    SELECT id, cantidad_gramos FROM stock
    WHERE genetica_id = p_genetica_id AND cantidad_gramos > 0
    ORDER BY fecha_ingreso ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;
    IF lote_row.cantidad_gramos >= v_restante THEN
      UPDATE stock SET cantidad_gramos = cantidad_gramos - v_restante WHERE id = lote_row.id;
      v_restante := 0;
    ELSE
      v_restante := v_restante - lote_row.cantidad_gramos;
      UPDATE stock SET cantidad_gramos = 0 WHERE id = lote_row.id;
    END IF;
  END LOOP;

  INSERT INTO egresos_stock (genetica_id, gramos, motivo, admin_id)
  VALUES (p_genetica_id, p_gramos, btrim(p_motivo), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS egresos FROM egresos_stock;

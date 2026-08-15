-- ============================================================
-- SIEMBRA NATIVA CLUB - Conservar la cantidad ingresada por lote
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- stock.cantidad_gramos es lo RESTANTE del lote (el FIFO descuenta
-- de ahí, eso es correcto). Lo que faltaba: conservar cuánto
-- ingresó originalmente. Se agrega cantidad_inicial, que nunca
-- se descuenta.
-- ============================================================

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS cantidad_inicial NUMERIC(10,2);

-- Backfill: para lotes existentes se asume que lo restante es lo ingresado
-- (si un lote ya tuvo descuentos, corregir a mano su cantidad_inicial)
UPDATE stock SET cantidad_inicial = cantidad_gramos WHERE cantidad_inicial IS NULL;

-- Todo lote nuevo arranca con inicial = ingresado
-- (cubre también los lotes de devolución que crea restaurar_stock_pedido)
CREATE OR REPLACE FUNCTION stock_set_cantidad_inicial()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cantidad_inicial IS NULL THEN
    NEW.cantidad_inicial := NEW.cantidad_gramos;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_cantidad_inicial ON stock;
CREATE TRIGGER stock_cantidad_inicial
  BEFORE INSERT ON stock
  FOR EACH ROW EXECUTE FUNCTION stock_set_cantidad_inicial();

-- ============================================================
-- SIEMBRA NATIVA CLUB - Unificación Catálogo + Tienda
-- Permite que un pedido contenga genéticas (gramos) Y productos (unidades)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- pedido_items: soportar productos además de genéticas
-- ------------------------------------------------------------
ALTER TABLE pedido_items
  ADD COLUMN IF NOT EXISTS producto_id       UUID REFERENCES productos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cantidad_unidades INTEGER CHECK (cantidad_unidades > 0);

-- Los campos de genética dejan de ser obligatorios (un item puede ser producto)
ALTER TABLE pedido_items ALTER COLUMN genetica_id     DROP NOT NULL;
ALTER TABLE pedido_items ALTER COLUMN cantidad_gramos DROP NOT NULL;

-- Exclusividad: cada item es genética (con gramos) O producto (con unidades), nunca ambos
ALTER TABLE pedido_items DROP CONSTRAINT IF EXISTS pedido_item_tipo_valido;
ALTER TABLE pedido_items ADD CONSTRAINT pedido_item_tipo_valido CHECK (
  (genetica_id IS NOT NULL AND cantidad_gramos   IS NOT NULL
     AND producto_id IS NULL AND cantidad_unidades IS NULL)
  OR
  (producto_id  IS NOT NULL AND cantidad_unidades IS NOT NULL
     AND genetica_id IS NULL AND cantidad_gramos   IS NULL)
);

-- ------------------------------------------------------------
-- descontar_stock_pedido: ahora también descuenta stock de productos
-- Genéticas → FIFO por lote (gramos). Productos → resta directa (unidades).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION descontar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
  restante NUMERIC;
  lote_row RECORD;
  prod RECORD;
BEGIN
  -- 1) Genéticas: descuento FIFO de los lotes más antiguos primero
  FOR item IN
    SELECT genetica_id, cantidad_gramos FROM pedido_items
    WHERE pedido_id = p_pedido_id AND genetica_id IS NOT NULL
  LOOP
    restante := item.cantidad_gramos;

    FOR lote_row IN
      SELECT id, cantidad_gramos FROM stock
      WHERE genetica_id = item.genetica_id AND cantidad_gramos > 0
      ORDER BY fecha_ingreso ASC
      FOR UPDATE
    LOOP
      EXIT WHEN restante <= 0;

      IF lote_row.cantidad_gramos >= restante THEN
        UPDATE stock SET cantidad_gramos = cantidad_gramos - restante WHERE id = lote_row.id;
        restante := 0;
      ELSE
        restante := restante - lote_row.cantidad_gramos;
        UPDATE stock SET cantidad_gramos = 0 WHERE id = lote_row.id;
      END IF;
    END LOOP;

    IF restante > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para genética %', item.genetica_id;
    END IF;
  END LOOP;

  -- 2) Productos: descuento directo por unidades
  FOR prod IN
    SELECT producto_id, cantidad_unidades FROM pedido_items
    WHERE pedido_id = p_pedido_id AND producto_id IS NOT NULL
  LOOP
    UPDATE productos
    SET stock = stock - prod.cantidad_unidades
    WHERE id = prod.producto_id AND stock >= prod.cantidad_unidades;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %', prod.producto_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- RLS: el socio ya podía crear items de sus pedidos; las policies
-- existentes (socio_crea_items / socio_ve_propios_items) siguen aplicando
-- igual para items de producto (validan por pedido_id, no por tipo).
-- ------------------------------------------------------------

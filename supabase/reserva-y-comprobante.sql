-- ============================================================
-- SIEMBRA NATIVA CLUB - Reserva de stock + comprobante de pago
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- (a) Reserva virtual: los pedidos pendientes restan del stock
--     visible en tienda, sin tocar el stock físico. El descuento
--     FIFO real sigue ocurriendo al aprobar.
-- (b) Comprobante de pago: bucket privado + columnas en pedidos.
-- ============================================================

-- ------------------------------------------------------------
-- 1) stock_publico: stock físico MENOS gramos comprometidos
--    en pedidos pendientes (reserva virtual de flores)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW stock_publico AS
  SELECT
    g.id          AS genetica_id,
    g.nombre,
    g.tipo,
    g.thc,
    g.cbd,
    g.descripcion,
    g.imagen_url,
    GREATEST(
      COALESCE(SUM(s.cantidad_gramos), 0)
      - COALESCE((
          SELECT SUM(pi.cantidad_gramos)
          FROM pedido_items pi
          JOIN pedidos p ON p.id = pi.pedido_id
          WHERE pi.genetica_id = g.id AND p.estado = 'pendiente'
        ), 0),
      0
    ) AS stock_total_gramos
  FROM geneticas g
  LEFT JOIN stock s ON s.genetica_id = g.id
  WHERE g.activa = TRUE
  GROUP BY g.id, g.nombre, g.tipo, g.thc, g.cbd, g.descripcion, g.imagen_url;

-- ------------------------------------------------------------
-- 2) productos_publico: stock de productos MENOS unidades
--    comprometidas en pedidos pendientes. Misma forma que la
--    tabla productos, para que la tienda la use sin cambios.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW productos_publico AS
  SELECT
    p.id,
    p.nombre,
    p.descripcion,
    p.categoria,
    p.precio,
    p.imagen_url,
    p.activo,
    GREATEST(
      p.stock - COALESCE((
        SELECT SUM(pi.cantidad_unidades)
        FROM pedido_items pi
        JOIN pedidos pe ON pe.id = pi.pedido_id
        WHERE pi.producto_id = p.id AND pe.estado = 'pendiente'
      ), 0),
      0
    )::INTEGER AS stock,
    p.created_at,
    p.updated_at
  FROM productos p;

-- ------------------------------------------------------------
-- 3) restaurar_stock_pedido: devuelve el stock de un pedido
--    APROBADO que se cancela. Las flores reingresan como lote
--    nuevo (trazable como devolución); los productos suman
--    unidades de vuelta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION restaurar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
BEGIN
  -- Flores: reingreso como lote nuevo con marca de devolución
  FOR item IN
    SELECT genetica_id, cantidad_gramos FROM pedido_items
    WHERE pedido_id = p_pedido_id AND genetica_id IS NOT NULL
  LOOP
    INSERT INTO stock (genetica_id, cantidad_gramos, lote)
    VALUES (item.genetica_id, item.cantidad_gramos, 'devolucion:' || p_pedido_id);
  END LOOP;

  -- Productos: suma directa de unidades
  FOR item IN
    SELECT producto_id, cantidad_unidades FROM pedido_items
    WHERE pedido_id = p_pedido_id AND producto_id IS NOT NULL
  LOOP
    UPDATE productos
    SET stock = stock + item.cantidad_unidades
    WHERE id = item.producto_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4) Comprobante de pago: columnas en pedidos
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS comprobante_path      TEXT,
  ADD COLUMN IF NOT EXISTS comprobante_subido_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 5) Bucket PRIVADO para comprobantes (dato financiero:
--    nunca URL pública, admin accede con signed URL + audit)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes-pago',
  'comprobantes-pago',
  FALSE,          -- PRIVADO
  10485760,       -- 10MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Estructura de path: {user_id}/{pedido_id}.{ext}
DROP POLICY IF EXISTS "socio_sube_comprobante" ON storage.objects;
CREATE POLICY "socio_sube_comprobante"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprobantes-pago'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "socio_actualiza_comprobante" ON storage.objects;
CREATE POLICY "socio_actualiza_comprobante"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'comprobantes-pago'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "socio_ve_propio_comprobante" ON storage.objects;
CREATE POLICY "socio_ve_propio_comprobante"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes-pago'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "admin_ve_comprobantes" ON storage.objects;
CREATE POLICY "admin_ve_comprobantes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprobantes-pago'
  AND get_my_role() = 'admin'
);

DROP POLICY IF EXISTS "admin_elimina_comprobantes" ON storage.objects;
CREATE POLICY "admin_elimina_comprobantes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comprobantes-pago'
  AND get_my_role() = 'admin'
);

-- ------------------------------------------------------------
-- 6) Config: comprobante obligatorio para aprobar (off por defecto)
-- ------------------------------------------------------------
INSERT INTO configuracion_app (clave, valor, descripcion) VALUES
  ('comprobante_obligatorio', 'false', 'Si es "true", un pedido no puede aprobarse sin comprobante de pago cargado')
ON CONFLICT (clave) DO NOTHING;

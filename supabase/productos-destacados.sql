-- ============================================================
-- SIEMBRA NATIVA CLUB - Productos destacados
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Un producto destacado se le ofrece al socio al cerrar el carrito
-- ("Sumá productos a tu pedido") y aparece primero en el catálogo.
-- Solo aplica a productos (aceites, merchandising, otros), no a genéticas.
-- ============================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT false;

-- La vista pública expone la columna nueva (OR REPLACE solo permite
-- agregar columnas al final, por eso va última).
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
    p.updated_at,
    p.destacado
  FROM productos p;

-- Textos del paso "Sumá productos" (editables desde Configuración → General)
INSERT INTO configuracion_app (clave, valor, descripcion) VALUES
  ('upsell_titulo', 'Sumá productos a tu pedido', 'Título del paso que ofrece productos destacados al cerrar el carrito'),
  ('upsell_texto',  'Aprovechá el envío y agregá alguno de estos productos.', 'Bajada del paso de productos destacados')
ON CONFLICT (clave) DO NOTHING;

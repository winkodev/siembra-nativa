-- ============================================================
-- SIEMBRA NATIVA CLUB - Banco (semillera) de la genética
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El catálogo muestra "Nombre by Banco".
-- ============================================================

ALTER TABLE geneticas
  ADD COLUMN IF NOT EXISTS banco TEXT;

-- (CREATE OR REPLACE permite agregar columnas al final de la vista)
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
    ) AS stock_total_gramos,
    g.calidad,
    g.cultivo,
    g.precio_gramo,
    g.banco
  FROM geneticas g
  LEFT JOIN stock s ON s.genetica_id = g.id
  WHERE g.activa = TRUE
  GROUP BY g.id, g.nombre, g.tipo, g.thc, g.cbd, g.descripcion, g.imagen_url,
           g.calidad, g.cultivo, g.precio_gramo, g.banco;

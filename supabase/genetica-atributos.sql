-- ============================================================
-- SIEMBRA NATIVA CLUB - Atributos de genética: calidad y cultivo
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Agrega calidad (regular/premium) y cultivo (indoor/outdoor)
-- a las genéticas, visibles para el socio en la tienda vía
-- stock_publico (CREATE OR REPLACE permite agregar columnas
-- al final de la vista).
-- ============================================================

ALTER TABLE geneticas
  ADD COLUMN IF NOT EXISTS calidad TEXT CHECK (calidad IN ('regular', 'premium')),
  ADD COLUMN IF NOT EXISTS cultivo TEXT CHECK (cultivo IN ('indoor', 'outdoor'));

-- Vista pública: misma definición con reserva virtual + los dos
-- atributos nuevos AL FINAL (no se puede cambiar el orden previo)
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
    g.cultivo
  FROM geneticas g
  LEFT JOIN stock s ON s.genetica_id = g.id
  WHERE g.activa = TRUE
  GROUP BY g.id, g.nombre, g.tipo, g.thc, g.cbd, g.descripcion, g.imagen_url, g.calidad, g.cultivo;

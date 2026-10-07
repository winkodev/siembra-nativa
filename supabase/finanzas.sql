-- ============================================================
-- SIEMBRA NATIVA CLUB - Finanzas (solo superadmin)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- (a) pedido_items.precio_unitario: precio por gramo / por unidad al
--     momento del pedido. Un trigger lo completa en cada INSERT, así
--     crear_pedido no cambia. Los ítems viejos se completan con el
--     precio actual y quedan marcados como estimados.
-- (b) finanzas_club(): ingresos, gramos y $ por genética, por socio
--     (con detalle por genética) y por pedido, en una sola pasada.
--     Solo el superadmin puede llamarla.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Precio unitario por ítem
-- ------------------------------------------------------------
ALTER TABLE pedido_items
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC,
  ADD COLUMN IF NOT EXISTS precio_estimado BOOLEAN NOT NULL DEFAULT FALSE;

-- Trigger: si el ítem entra sin precio, toma el vigente (flores: $/g; productos: $/u)
CREATE OR REPLACE FUNCTION pedido_items_precio_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio_unitario IS NULL THEN
    IF NEW.genetica_id IS NOT NULL THEN
      SELECT precio_gramo INTO NEW.precio_unitario FROM geneticas WHERE id = NEW.genetica_id;
    ELSIF NEW.producto_id IS NOT NULL THEN
      SELECT precio INTO NEW.precio_unitario FROM productos WHERE id = NEW.producto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_items_precio ON pedido_items;
CREATE TRIGGER trg_pedido_items_precio
  BEFORE INSERT ON pedido_items
  FOR EACH ROW EXECUTE FUNCTION pedido_items_precio_snapshot();

-- Ítems anteriores: precio actual, marcados como estimados
UPDATE pedido_items pi
SET precio_unitario = g.precio_gramo, precio_estimado = TRUE
FROM geneticas g
WHERE pi.genetica_id = g.id AND pi.precio_unitario IS NULL;

UPDATE pedido_items pi
SET precio_unitario = pr.precio, precio_estimado = TRUE
FROM productos pr
WHERE pi.producto_id = pr.id AND pi.precio_unitario IS NULL;

-- ------------------------------------------------------------
-- 2) finanzas_club: todo el módulo en una consulta
--    p_estados: qué pedidos contar (ej: {aprobado,entregado})
--    p_agrupacion: 'day' | 'week' | 'month' para la serie
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION finanzas_club(
  p_desde      TIMESTAMPTZ,
  p_hasta      TIMESTAMPTZ,
  p_estados    TEXT[] DEFAULT ARRAY['aprobado', 'entregado'],
  p_agrupacion TEXT DEFAULT 'month'
)
RETURNS JSONB AS $$
DECLARE
  v_super   BOOLEAN;
  resultado JSONB;
BEGIN
  SELECT superadmin INTO v_super FROM profiles WHERE id = auth.uid() AND rol = 'admin';
  IF NOT COALESCE(v_super, FALSE) THEN
    RAISE EXCEPTION 'Solo el superadmin puede consultar finanzas';
  END IF;

  IF p_agrupacion NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Agrupación inválida: %', p_agrupacion;
  END IF;

  -- Pedidos del período con el estado pedido (por fecha de creación)
  CREATE TEMP TABLE IF NOT EXISTS _fin_pedidos ON COMMIT DROP AS
    SELECT p.id, p.numero, p.created_at, p.estado::TEXT AS estado, p.socio_id,
           p.monto_total, p.monto_envio, p.monto_descuento, p.monto_cupon,
           pr.nombre AS socio_nombre
    FROM pedidos p
    JOIN profiles pr ON pr.id = p.socio_id
    WHERE p.created_at BETWEEN p_desde AND p_hasta
      AND p.estado::TEXT = ANY (p_estados);

  SELECT jsonb_build_object(

    'resumen', (
      SELECT jsonb_build_object(
        'ingresos',        COALESCE(SUM(monto_total), 0),
        'pedidos',         COUNT(*),
        'ticket_promedio', COALESCE(AVG(monto_total), 0),
        'descuentos',      COALESCE(SUM(COALESCE(monto_descuento, 0) + COALESCE(monto_cupon, 0)), 0),
        'envios',          COALESCE(SUM(monto_envio), 0),
        'sin_monto',       COUNT(*) FILTER (WHERE monto_total IS NULL),
        'gramos',          COALESCE((SELECT SUM(pi.cantidad_gramos) FROM pedido_items pi WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos) AND pi.genetica_id IS NOT NULL), 0),
        'unidades',        COALESCE((SELECT SUM(pi.cantidad_unidades) FROM pedido_items pi WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos) AND pi.producto_id IS NOT NULL), 0),
        'estimados',       (SELECT COUNT(DISTINCT pi.pedido_id) FROM pedido_items pi WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos) AND pi.precio_estimado)
      )
      FROM _fin_pedidos
    ),

    -- Serie de ingresos netos por período
    'serie', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('periodo', periodo, 'ingresos', ingresos, 'pedidos', cnt) ORDER BY periodo), '[]'::jsonb)
      FROM (
        SELECT date_trunc(p_agrupacion, created_at) AS periodo,
               COALESCE(SUM(monto_total), 0) AS ingresos,
               COUNT(*) AS cnt
        FROM _fin_pedidos
        GROUP BY 1
      ) t
    ),

    -- Por genética: gramos y $ bruto (precio del ítem × gramos, antes de descuentos)
    'por_genetica', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'nombre', nombre, 'gramos', gramos, 'bruto', bruto, 'pedidos', pedidos, 'estimado', estimado
      ) ORDER BY bruto DESC, gramos DESC), '[]'::jsonb)
      FROM (
        SELECT g.nombre,
               SUM(pi.cantidad_gramos) AS gramos,
               COALESCE(SUM(pi.cantidad_gramos * COALESCE(pi.precio_unitario, 0)), 0) AS bruto,
               COUNT(DISTINCT pi.pedido_id) AS pedidos,
               BOOL_OR(pi.precio_estimado) AS estimado
        FROM pedido_items pi
        JOIN geneticas g ON g.id = pi.genetica_id
        WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos)
        GROUP BY g.nombre
      ) t
    ),

    -- Por producto (aceites y demás): unidades y $ bruto
    'por_producto', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'nombre', nombre, 'unidades', unidades, 'bruto', bruto, 'pedidos', pedidos, 'estimado', estimado
      ) ORDER BY bruto DESC), '[]'::jsonb)
      FROM (
        SELECT pr.nombre,
               SUM(pi.cantidad_unidades) AS unidades,
               COALESCE(SUM(pi.cantidad_unidades * COALESCE(pi.precio_unitario, 0)), 0) AS bruto,
               COUNT(DISTINCT pi.pedido_id) AS pedidos,
               BOOL_OR(pi.precio_estimado) AS estimado
        FROM pedido_items pi
        JOIN productos pr ON pr.id = pi.producto_id
        WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos)
        GROUP BY pr.nombre
      ) t
    ),

    -- Por socio: pedidos, gramos, $ pagado y detalle por genética
    'por_socio', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'socio_id', socio_id, 'nombre', socio_nombre, 'pedidos', pedidos, 'gramos', gramos, 'total', total,
        'detalle', detalle
      ) ORDER BY total DESC, gramos DESC), '[]'::jsonb)
      FROM (
        SELECT f.socio_id, f.socio_nombre,
               COUNT(DISTINCT f.id) AS pedidos,
               COALESCE((SELECT SUM(pi.cantidad_gramos) FROM pedido_items pi WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos WHERE socio_id = f.socio_id) AND pi.genetica_id IS NOT NULL), 0) AS gramos,
               COALESCE(SUM(f.monto_total), 0) AS total,
               (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', nombre, 'gramos', gramos, 'bruto', bruto) ORDER BY gramos DESC), '[]'::jsonb)
                 FROM (
                   SELECT g.nombre, SUM(pi.cantidad_gramos) AS gramos,
                          COALESCE(SUM(pi.cantidad_gramos * COALESCE(pi.precio_unitario, 0)), 0) AS bruto
                   FROM pedido_items pi
                   JOIN geneticas g ON g.id = pi.genetica_id
                   WHERE pi.pedido_id IN (SELECT id FROM _fin_pedidos WHERE socio_id = f.socio_id)
                   GROUP BY g.nombre
                 ) d
               ) AS detalle
        FROM _fin_pedidos f
        GROUP BY f.socio_id, f.socio_nombre
      ) t
    ),

    -- Pedidos del período
    'pedidos', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'numero', numero, 'fecha', created_at, 'estado', estado, 'socio', socio_nombre,
        'gramos', COALESCE((SELECT SUM(cantidad_gramos) FROM pedido_items WHERE pedido_id = f.id AND genetica_id IS NOT NULL), 0),
        'unidades', COALESCE((SELECT SUM(cantidad_unidades) FROM pedido_items WHERE pedido_id = f.id AND producto_id IS NOT NULL), 0),
        'descuentos', COALESCE(monto_descuento, 0) + COALESCE(monto_cupon, 0),
        'envio', COALESCE(monto_envio, 0),
        'total', monto_total
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM _fin_pedidos f
    )

  ) INTO resultado;

  DROP TABLE IF EXISTS _fin_pedidos;
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verificación
-- ============================================================
SELECT
  COUNT(*) FILTER (WHERE precio_unitario IS NOT NULL) AS items_con_precio,
  COUNT(*) FILTER (WHERE precio_estimado)            AS items_estimados,
  COUNT(*)                                           AS items_total
FROM pedido_items;

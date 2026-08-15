-- ============================================================
-- SIEMBRA NATIVA CLUB - Estadísticas
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- (a) fecha_entregado en pedidos: momento real de la dispensa
--     (updated_at se pisa con cualquier edición, no sirve para stats)
-- (b) estadisticas_club(): todas las métricas del período en una
--     sola pasada, solo para admin.
-- ============================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS fecha_entregado TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION estadisticas_club(
  p_desde      TIMESTAMPTZ,
  p_hasta      TIMESTAMPTZ,
  p_agrupacion TEXT DEFAULT 'day'   -- 'day' | 'week' | 'month'
)
RETURNS JSONB AS $$
DECLARE
  resultado JSONB;
BEGIN
  IF get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede consultar estadísticas';
  END IF;

  IF p_agrupacion NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Agrupación inválida: %', p_agrupacion;
  END IF;

  SELECT jsonb_build_object(

    -- Dispensado: solo pedidos ENTREGADOS, por su fecha de entrega
    'gramos_dispensados', COALESCE((
      SELECT SUM(pi.cantidad_gramos)
      FROM pedido_items pi
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE p.estado = 'entregado'
        AND p.fecha_entregado BETWEEN p_desde AND p_hasta
        AND pi.genetica_id IS NOT NULL
    ), 0),

    'unidades_dispensadas', COALESCE((
      SELECT SUM(pi.cantidad_unidades)
      FROM pedido_items pi
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE p.estado = 'entregado'
        AND p.fecha_entregado BETWEEN p_desde AND p_hasta
        AND pi.producto_id IS NOT NULL
    ), 0),

    -- Pedidos creados en el período, total y por estado actual
    'pedidos_total', (
      SELECT COUNT(*) FROM pedidos
      WHERE created_at BETWEEN p_desde AND p_hasta
    ),
    'pedidos_por_estado', (
      SELECT COALESCE(jsonb_object_agg(estado, cnt), '{}'::jsonb)
      FROM (
        SELECT estado::TEXT AS estado, COUNT(*) AS cnt
        FROM pedidos
        WHERE created_at BETWEEN p_desde AND p_hasta
        GROUP BY estado
      ) t
    ),

    -- Socios
    'socios_nuevos', (
      SELECT COUNT(*) FROM profiles
      WHERE rol = 'socio' AND fecha_alta BETWEEN p_desde AND p_hasta
    ),
    'socios_activos', (
      SELECT COUNT(DISTINCT socio_id) FROM pedidos
      WHERE created_at BETWEEN p_desde AND p_hasta
    ),

    -- Serie temporal de gramos dispensados
    'serie_dispensado', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('periodo', periodo, 'gramos', gramos) ORDER BY periodo), '[]'::jsonb)
      FROM (
        SELECT date_trunc(p_agrupacion, p.fecha_entregado) AS periodo,
               SUM(pi.cantidad_gramos) AS gramos
        FROM pedido_items pi
        JOIN pedidos p ON p.id = pi.pedido_id
        WHERE p.estado = 'entregado'
          AND p.fecha_entregado BETWEEN p_desde AND p_hasta
          AND pi.genetica_id IS NOT NULL
        GROUP BY 1
      ) t
    ),

    -- Serie temporal de altas de socios
    'serie_altas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('periodo', periodo, 'altas', altas) ORDER BY periodo), '[]'::jsonb)
      FROM (
        SELECT date_trunc(p_agrupacion, fecha_alta) AS periodo,
               COUNT(*) AS altas
        FROM profiles
        WHERE rol = 'socio' AND fecha_alta BETWEEN p_desde AND p_hasta
        GROUP BY 1
      ) t
    ),

    -- Top 5 genéticas más dispensadas del período
    'top_geneticas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', nombre, 'gramos', gramos) ORDER BY gramos DESC), '[]'::jsonb)
      FROM (
        SELECT g.nombre, SUM(pi.cantidad_gramos) AS gramos
        FROM pedido_items pi
        JOIN pedidos p   ON p.id = pi.pedido_id
        JOIN geneticas g ON g.id = pi.genetica_id
        WHERE p.estado = 'entregado'
          AND p.fecha_entregado BETWEEN p_desde AND p_hasta
        GROUP BY g.nombre
        ORDER BY 2 DESC
        LIMIT 5
      ) t
    )

  ) INTO resultado;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- SIEMBRA NATIVA CLUB - Precios, envío y notificaciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- (a) precio_gramo por genética, visible en tienda/carrito
-- (b) costo de envío configurable con umbral de gratis
-- (c) snapshot de montos en el pedido (monto_total / monto_envio)
-- (d) notificaciones in-app para socios (pedido confirmado/entregado)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Precio por gramo en genéticas + vista pública
-- ------------------------------------------------------------
ALTER TABLE geneticas
  ADD COLUMN IF NOT EXISTS precio_gramo NUMERIC(10,2) CHECK (precio_gramo >= 0);

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
    g.precio_gramo
  FROM geneticas g
  LEFT JOIN stock s ON s.genetica_id = g.id
  WHERE g.activa = TRUE
  GROUP BY g.id, g.nombre, g.tipo, g.thc, g.cbd, g.descripcion, g.imagen_url, g.calidad, g.cultivo, g.precio_gramo;

-- ------------------------------------------------------------
-- 2) Config de envío
-- ------------------------------------------------------------
INSERT INTO configuracion_app (clave, valor, descripcion) VALUES
  ('costo_envio',        '0', 'Costo del envío a domicilio en pesos (0 = no se cobra)'),
  ('envio_gratis_desde', '0', 'Gramos de flores desde los que el envío es gratis (0 = se cobra siempre)')
ON CONFLICT (clave) DO NOTHING;

-- ------------------------------------------------------------
-- 3) Snapshot de montos en el pedido
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS monto_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monto_envio NUMERIC(10,2);

-- ------------------------------------------------------------
-- 4) Notificaciones in-app para socios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  mensaje    TEXT,
  leida      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_socio_idx ON notificaciones (socio_id, created_at DESC);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socio_ve_propias_notificaciones" ON notificaciones;
CREATE POLICY "socio_ve_propias_notificaciones"
  ON notificaciones FOR SELECT
  USING (socio_id = auth.uid());

DROP POLICY IF EXISTS "socio_marca_leidas" ON notificaciones;
CREATE POLICY "socio_marca_leidas"
  ON notificaciones FOR UPDATE
  USING (socio_id = auth.uid());

DROP POLICY IF EXISTS "admin_crud_notificaciones" ON notificaciones;
CREATE POLICY "admin_crud_notificaciones"
  ON notificaciones FOR ALL
  USING (get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 5) crear_pedido v2: calcula y guarda los montos (foto de precios)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
  p_items     JSONB,
  p_notas     TEXT DEFAULT NULL,
  p_franja_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_socio          UUID := auth.uid();
  v_habilitada     BOOLEAN;
  v_max            NUMERIC;
  v_total_gramos   NUMERIC := 0;
  item             JSONB;
  v_disponible     NUMERIC;
  v_activo         BOOLEAN;
  v_nombre         TEXT;
  v_precio         NUMERIC;
  v_subtotal       NUMERIC := 0;
  v_costo_envio    NUMERIC;
  v_gratis_desde   NUMERIC;
  v_monto_envio    NUMERIC := 0;
  v_franja         TEXT := NULL;
  v_franjas_activas INT;
  v_pedido_id      UUID;
  v_numero         INTEGER;
BEGIN
  IF v_socio IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT compra_habilitada INTO v_habilitada FROM profiles WHERE id = v_socio;
  IF NOT COALESCE(v_habilitada, FALSE) THEN
    RAISE EXCEPTION 'Tu acceso a pedidos no está habilitado. Contactá al club.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido está vacío';
  END IF;

  -- Serializa las creaciones concurrentes (sin ventana de carrera)
  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  SELECT COALESCE(
    (SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'max_gramos_pedido'), 40
  ) INTO v_max;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF item->>'tipo' = 'genetica' THEN
      v_total_gramos := v_total_gramos + (item->>'cantidad')::NUMERIC;
    END IF;
  END LOOP;

  IF v_total_gramos > v_max THEN
    RAISE EXCEPTION 'El pedido supera el límite de %g de flores.', v_max;
  END IF;

  -- Validar disponibilidad y acumular subtotal con precios actuales
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'cantidad')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en el pedido';
    END IF;

    IF item->>'tipo' = 'genetica' THEN
      SELECT nombre, stock_total_gramos, precio_gramo INTO v_nombre, v_disponible, v_precio
      FROM stock_publico WHERE genetica_id = (item->>'id')::UUID;

      IF v_disponible IS NULL OR v_disponible < (item->>'cantidad')::NUMERIC THEN
        RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'la genética');
      END IF;
      v_subtotal := v_subtotal + COALESCE(v_precio, 0) * (item->>'cantidad')::NUMERIC;
    ELSE
      SELECT nombre, stock, activo, precio INTO v_nombre, v_disponible, v_activo, v_precio
      FROM productos_publico WHERE id = (item->>'id')::UUID;

      IF v_disponible IS NULL OR NOT v_activo OR v_disponible < (item->>'cantidad')::NUMERIC THEN
        RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'el producto');
      END IF;
      v_subtotal := v_subtotal + COALESCE(v_precio, 0) * (item->>'cantidad')::NUMERIC;
    END IF;
  END LOOP;

  -- Envío: se cobra si hay costo configurado y no aplica el umbral de gratis
  SELECT COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'costo_envio'), 0),
         COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'envio_gratis_desde'), 0)
  INTO v_costo_envio, v_gratis_desde;

  IF v_costo_envio > 0 AND (v_gratis_desde <= 0 OR v_total_gramos < v_gratis_desde) THEN
    v_monto_envio := v_costo_envio;
  END IF;

  -- Franja de entrega: obligatoria si el club definió franjas activas
  SELECT COUNT(*) INTO v_franjas_activas FROM franjas_horarias WHERE activa;
  IF v_franjas_activas > 0 THEN
    SELECT dia || ' · ' || to_char(hora_desde, 'HH24:MI') || '–' || to_char(hora_hasta, 'HH24:MI') || ' hs'
    INTO v_franja
    FROM franjas_horarias
    WHERE id = p_franja_id AND activa;

    IF v_franja IS NULL THEN
      RAISE EXCEPTION 'Elegí un horario de entrega';
    END IF;
  END IF;

  INSERT INTO pedidos (socio_id, notas, entrega_franja, monto_total, monto_envio)
  VALUES (
    v_socio,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_franja,
    v_subtotal + v_monto_envio,
    v_monto_envio
  )
  RETURNING id, numero INTO v_pedido_id, v_numero;

  INSERT INTO pedido_items (pedido_id, genetica_id, cantidad_gramos, producto_id, cantidad_unidades)
  SELECT
    v_pedido_id,
    CASE WHEN i->>'tipo' = 'genetica' THEN (i->>'id')::UUID END,
    CASE WHEN i->>'tipo' = 'genetica' THEN (i->>'cantidad')::NUMERIC END,
    CASE WHEN i->>'tipo' = 'producto' THEN (i->>'id')::UUID END,
    CASE WHEN i->>'tipo' = 'producto' THEN (i->>'cantidad')::INTEGER END
  FROM jsonb_array_elements(p_items) AS i;

  RETURN jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

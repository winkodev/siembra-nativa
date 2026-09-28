-- ============================================================
-- SIEMBRA NATIVA CLUB - Cupones personales
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Un cupón es personal (un socio), de un solo uso, y lo crea el admin
-- desde la ficha del socio. Se aplica al confirmar el pedido dentro de
-- crear_pedido (misma transacción): nadie puede usar un cupón ajeno,
-- vencido o ya usado. Reglas acordadas:
--   - un cupón por pedido
--   - el pedido tiene que llevar flores
--   - se acumula con el descuento por cantidad (se aplica después)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla cupones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- porcentaje | monto | producto_gratis | envio_gratis
  tipo         TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'monto', 'producto_gratis', 'envio_gratis')),
  -- % (porcentaje) o $ (monto); NULL para producto_gratis / envio_gratis
  valor        NUMERIC,
  -- producto_gratis: qué producto y cuántas unidades
  producto_id  UUID REFERENCES productos(id) ON DELETE SET NULL,
  cantidad     INTEGER,
  -- Texto libre que ve el socio ("Gracias Marcos por este tiempo con nosotros...")
  mensaje      TEXT NOT NULL,
  vence_at     TIMESTAMPTZ,
  -- disponible | usado | anulado
  estado       TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'usado', 'anulado')),
  -- Para mostrar el popup una sola vez
  visto_at     TIMESTAMPTZ,
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  usado_at     TIMESTAMPTZ,
  creado_por   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cupones_valor_ok CHECK (
    (tipo = 'porcentaje'      AND valor > 0 AND valor <= 100) OR
    (tipo = 'monto'           AND valor > 0) OR
    (tipo = 'producto_gratis' AND producto_id IS NOT NULL AND cantidad > 0) OR
    (tipo = 'envio_gratis')
  )
);

CREATE INDEX IF NOT EXISTS cupones_socio_idx ON cupones (socio_id, estado);

ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;

-- El socio ve solo sus cupones (y marca el "visto")
DROP POLICY IF EXISTS "cupones_socio_lee" ON cupones;
CREATE POLICY "cupones_socio_lee" ON cupones FOR SELECT
  USING (socio_id = auth.uid());

DROP POLICY IF EXISTS "cupones_socio_visto" ON cupones;
CREATE POLICY "cupones_socio_visto" ON cupones FOR UPDATE
  USING (socio_id = auth.uid())
  WITH CHECK (socio_id = auth.uid());

-- Admin: todo
DROP POLICY IF EXISTS "cupones_admin" ON cupones;
CREATE POLICY "cupones_admin" ON cupones FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));

-- ------------------------------------------------------------
-- 2) pedidos: qué cupón se usó y cuánto descontó
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS cupon_id    UUID REFERENCES cupones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS monto_cupon NUMERIC;

-- ------------------------------------------------------------
-- 3) crear_pedido v5: acepta p_cupon_id y lo aplica en la misma
--    transacción. Misma lógica que v4 + cupón.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
  p_items     JSONB,
  p_notas     TEXT DEFAULT NULL,
  p_franja_id UUID DEFAULT NULL,
  p_cupon_id  UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_socio            UUID := auth.uid();
  v_habilitada       BOOLEAN;
  v_terminos         TIMESTAMPTZ;
  v_max              NUMERIC;
  v_total_gramos     NUMERIC := 0;
  item               JSONB;
  v_disponible       NUMERIC;
  v_activo           BOOLEAN;
  v_nombre           TEXT;
  v_precio           NUMERIC;
  v_subtotal_flores  NUMERIC := 0;
  v_subtotal_prod    NUMERIC := 0;
  v_desc_pct         NUMERIC := 0;
  v_monto_descuento  NUMERIC := 0;
  v_costo_envio      NUMERIC;
  v_gratis_desde     NUMERIC;
  v_monto_envio      NUMERIC := 0;
  v_franja           TEXT := NULL;
  v_franjas_activas  INT;
  v_pedido_id        UUID;
  v_numero           INTEGER;
  -- Cupón
  v_cupon            RECORD;
  v_monto_cupon      NUMERIC := 0;
  v_base_cupon       NUMERIC;
  v_unidades_prod    NUMERIC;
  v_precio_prod      NUMERIC;
BEGIN
  IF v_socio IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT compra_habilitada, terminos_aceptados_at
  INTO v_habilitada, v_terminos
  FROM profiles WHERE id = v_socio;

  IF v_terminos IS NULL THEN
    RAISE EXCEPTION 'Tenés que aceptar los términos y condiciones desde tu perfil para hacer pedidos.';
  END IF;

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

  -- Validar disponibilidad y acumular subtotales con precios actuales
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
      v_subtotal_flores := v_subtotal_flores + COALESCE(v_precio, 0) * (item->>'cantidad')::NUMERIC;
    ELSE
      SELECT nombre, stock, activo, precio INTO v_nombre, v_disponible, v_activo, v_precio
      FROM productos_publico WHERE id = (item->>'id')::UUID;

      IF v_disponible IS NULL OR NOT v_activo OR v_disponible < (item->>'cantidad')::NUMERIC THEN
        RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'el producto');
      END IF;
      v_subtotal_prod := v_subtotal_prod + COALESCE(v_precio, 0) * (item->>'cantidad')::NUMERIC;
    END IF;
  END LOOP;

  -- Descuento por cantidad (aplica solo a las flores; gana el umbral mayor)
  IF v_total_gramos >= 40 THEN
    SELECT COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'descuento_40'), 0) INTO v_desc_pct;
  ELSIF v_total_gramos >= 20 THEN
    SELECT COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'descuento_20'), 0) INTO v_desc_pct;
  END IF;
  v_monto_descuento := ROUND(v_subtotal_flores * v_desc_pct / 100, 2);

  -- Envío: se cobra si hay costo configurado y no aplica el umbral de gratis
  SELECT COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'costo_envio'), 0),
         COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'envio_gratis_desde'), 0)
  INTO v_costo_envio, v_gratis_desde;

  IF v_costo_envio > 0 AND (v_gratis_desde <= 0 OR v_total_gramos < v_gratis_desde) THEN
    v_monto_envio := v_costo_envio;
  END IF;

  -- ----------------------------------------------------------
  -- Cupón: se valida y calcula acá, con precios reales, y se
  -- marca usado en la misma transacción (bloqueado con FOR UPDATE)
  -- ----------------------------------------------------------
  IF p_cupon_id IS NOT NULL THEN
    SELECT * INTO v_cupon FROM cupones WHERE id = p_cupon_id FOR UPDATE;

    IF v_cupon.id IS NULL OR v_cupon.socio_id <> v_socio THEN
      RAISE EXCEPTION 'El cupón no es válido';
    END IF;
    IF v_cupon.estado <> 'disponible' THEN
      RAISE EXCEPTION 'El cupón ya fue usado o está anulado';
    END IF;
    IF v_cupon.vence_at IS NOT NULL AND v_cupon.vence_at < NOW() THEN
      RAISE EXCEPTION 'El cupón está vencido';
    END IF;
    IF v_total_gramos <= 0 THEN
      RAISE EXCEPTION 'El cupón se aplica a pedidos con flores';
    END IF;

    -- Base: subtotal ya con el descuento por cantidad, sin envío
    v_base_cupon := v_subtotal_flores - v_monto_descuento + v_subtotal_prod;

    IF v_cupon.tipo = 'porcentaje' THEN
      v_monto_cupon := ROUND(v_base_cupon * v_cupon.valor / 100, 2);

    ELSIF v_cupon.tipo = 'monto' THEN
      v_monto_cupon := LEAST(v_cupon.valor, v_base_cupon);

    ELSIF v_cupon.tipo = 'envio_gratis' THEN
      v_monto_cupon := v_monto_envio;
      v_monto_envio := 0;

    ELSIF v_cupon.tipo = 'producto_gratis' THEN
      -- El producto tiene que estar en el pedido con al menos esa cantidad
      SELECT COALESCE(SUM((i->>'cantidad')::NUMERIC), 0) INTO v_unidades_prod
      FROM jsonb_array_elements(p_items) AS i
      WHERE i->>'tipo' = 'producto' AND (i->>'id')::UUID = v_cupon.producto_id;

      IF v_unidades_prod < v_cupon.cantidad THEN
        RAISE EXCEPTION 'Para usar el cupón, agregá el producto de regalo al pedido';
      END IF;

      SELECT COALESCE(precio, 0) INTO v_precio_prod FROM productos WHERE id = v_cupon.producto_id;
      v_monto_cupon := LEAST(ROUND(v_precio_prod * v_cupon.cantidad, 2), v_base_cupon);
    END IF;

    v_monto_cupon := GREATEST(v_monto_cupon, 0);
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

  INSERT INTO pedidos (socio_id, notas, entrega_franja, monto_total, monto_envio, monto_descuento, cupon_id, monto_cupon)
  VALUES (
    v_socio,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_franja,
    GREATEST(v_subtotal_flores - v_monto_descuento + v_subtotal_prod + v_monto_envio - v_monto_cupon, 0),
    v_monto_envio,
    NULLIF(v_monto_descuento, 0),
    p_cupon_id,
    NULLIF(v_monto_cupon, 0)
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

  IF p_cupon_id IS NOT NULL THEN
    UPDATE cupones SET estado = 'usado', usado_at = NOW(), pedido_id = v_pedido_id WHERE id = p_cupon_id;
  END IF;

  RETURN jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4) liberar_cupon_pedido: al cancelar un pedido, el cupón vuelve
--    a estar disponible (lo llama el admin desde la app).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION liberar_cupon_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cupones
  SET estado = 'disponible', usado_at = NULL, pedido_id = NULL
  WHERE pedido_id = p_pedido_id AND estado = 'usado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verificación
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM cupones) AS cupones,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name IN ('cupon_id', 'monto_cupon')) AS columnas_pedidos;

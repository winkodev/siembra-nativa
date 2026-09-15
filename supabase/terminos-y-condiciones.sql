-- ============================================================
-- SIEMBRA NATIVA CLUB - Términos y condiciones
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- El socio debe aceptar los T&C para que se habilite la tienda.
-- Se guarda la FECHA de aceptación (no un booleano) como respaldo
-- legal. Si el club cambia el texto y quiere que todos vuelvan a
-- aceptar, alcanza con:  UPDATE profiles SET terminos_aceptados_at = NULL;
-- y volver a correr el bloque 2 de este archivo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Fecha de aceptación en el perfil
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2) Notificación in-app para los socios que todavía no aceptaron
--    (los nuevos la reciben al crearse desde /admin/socios)
-- ------------------------------------------------------------
INSERT INTO notificaciones (socio_id, tipo, titulo, mensaje)
SELECT
  p.id,
  'terminos',
  'Aceptá los términos y condiciones',
  'Para habilitar la tienda necesitás leer y aceptar los términos y condiciones desde tu perfil.'
FROM profiles p
WHERE p.rol = 'socio'
  AND p.terminos_aceptados_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM notificaciones n
    WHERE n.socio_id = p.id AND n.tipo = 'terminos' AND NOT n.leida
  );

-- ------------------------------------------------------------
-- 3) crear_pedido v4: además de compra_habilitada exige T&C aceptados
--    (idéntica a v3 de avisos-y-descuentos.sql salvo ese chequeo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
  p_items     JSONB,
  p_notas     TEXT DEFAULT NULL,
  p_franja_id UUID DEFAULT NULL
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

  INSERT INTO pedidos (socio_id, notas, entrega_franja, monto_total, monto_envio, monto_descuento)
  VALUES (
    v_socio,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_franja,
    v_subtotal_flores - v_monto_descuento + v_subtotal_prod + v_monto_envio,
    v_monto_envio,
    NULLIF(v_monto_descuento, 0)
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

-- ============================================================
-- Verificación
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM profiles WHERE rol = 'socio' AND terminos_aceptados_at IS NULL) AS socios_sin_aceptar,
  (SELECT COUNT(*) FROM notificaciones WHERE tipo = 'terminos' AND NOT leida)          AS notificaciones_pendientes;

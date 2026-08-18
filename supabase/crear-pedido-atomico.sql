-- ============================================================
-- SIEMBRA NATIVA CLUB - Creación atómica de pedidos
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Mueve la validación de stock y la creación del pedido a una
-- sola función con lock: dos socios confirmando en el mismo
-- instante ya no pueden reservar los mismos gramos (se elimina
-- la ventana de carrera entre chequeo e inserción).
-- ============================================================

CREATE OR REPLACE FUNCTION crear_pedido(
  p_items     JSONB,                -- [{tipo:'genetica'|'producto', id: uuid, cantidad: numérico}]
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

  -- Serializa las creaciones concurrentes hasta el commit: el chequeo
  -- de stock y la inserción quedan atómicos entre sí
  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  -- Límite de gramos por pedido (solo flores)
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

  -- Validar disponibilidad (las vistas ya restan reservas pendientes)
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'cantidad')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en el pedido';
    END IF;

    IF item->>'tipo' = 'genetica' THEN
      SELECT nombre, stock_total_gramos INTO v_nombre, v_disponible
      FROM stock_publico WHERE genetica_id = (item->>'id')::UUID;

      IF v_disponible IS NULL OR v_disponible < (item->>'cantidad')::NUMERIC THEN
        RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'la genética');
      END IF;
    ELSE
      SELECT nombre, stock, activo INTO v_nombre, v_disponible, v_activo
      FROM productos_publico WHERE id = (item->>'id')::UUID;

      IF v_disponible IS NULL OR NOT v_activo OR v_disponible < (item->>'cantidad')::NUMERIC THEN
        RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'el producto');
      END IF;
    END IF;
  END LOOP;

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

  -- Crear pedido + items (misma transacción que la validación)
  INSERT INTO pedidos (socio_id, notas, entrega_franja)
  VALUES (v_socio, NULLIF(btrim(COALESCE(p_notas, '')), ''), v_franja)
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

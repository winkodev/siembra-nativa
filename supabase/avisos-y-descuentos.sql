-- ============================================================
-- SIEMBRA NATIVA CLUB - Avisos REPROCANN + descuentos por cantidad
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- (a) Cron diario: marca REPROCANN vencidos (deshabilita compra)
--     y notifica al socio con la anticipación configurada.
-- (b) Descuento % configurable al pedir 20g o 40g de flores,
--     aplicado y guardado por crear_pedido.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Config nueva
-- ------------------------------------------------------------
INSERT INTO configuracion_app (clave, valor, descripcion) VALUES
  ('reprocann_aviso_dias', '30', 'Días de anticipación para avisar al socio que su REPROCANN vence'),
  ('descuento_20',         '0',  'Porcentaje de descuento sobre las flores al pedir 20g o más'),
  ('descuento_40',         '0',  'Porcentaje de descuento sobre las flores al pedir 40g o más')
ON CONFLICT (clave) DO NOTHING;

-- ------------------------------------------------------------
-- 2) Tipo de notificación (para no duplicar avisos) + descuento en pedido
-- ------------------------------------------------------------
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'general';

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS monto_descuento NUMERIC(10,2);

-- ------------------------------------------------------------
-- 3) Proceso diario de vencimientos REPROCANN
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_vencimientos_reprocann()
RETURNS VOID AS $$
DECLARE
  v_dias INT;
  r RECORD;
BEGIN
  SELECT COALESCE(
    (SELECT valor::INT FROM configuracion_app WHERE clave = 'reprocann_aviso_dias'), 30
  ) INTO v_dias;

  -- Vencidos: cambiar estado, deshabilitar compra y notificar
  FOR r IN
    SELECT id FROM profiles
    WHERE rol = 'socio'
      AND reprocann_estado = 'aprobado'
      AND reprocann_vencimiento IS NOT NULL
      AND reprocann_vencimiento < CURRENT_DATE
  LOOP
    UPDATE profiles
    SET reprocann_estado = 'vencido', compra_habilitada = FALSE
    WHERE id = r.id;

    INSERT INTO notificaciones (socio_id, tipo, titulo, mensaje)
    VALUES (
      r.id, 'reprocann_vencido',
      'Tu REPROCANN venció',
      'Renovalo y subí el certificado nuevo desde tu perfil para volver a hacer pedidos.'
    );
  END LOOP;

  -- Próximos a vencer: un solo aviso por vencimiento
  FOR r IN
    SELECT p.id, p.reprocann_vencimiento FROM profiles p
    WHERE p.rol = 'socio'
      AND p.reprocann_estado = 'aprobado'
      AND p.reprocann_vencimiento IS NOT NULL
      AND p.reprocann_vencimiento >= CURRENT_DATE
      AND p.reprocann_vencimiento <= CURRENT_DATE + v_dias
      AND NOT EXISTS (
        SELECT 1 FROM notificaciones n
        WHERE n.socio_id = p.id
          AND n.tipo = 'reprocann_aviso'
          AND n.created_at > p.reprocann_vencimiento - (v_dias + 1) * INTERVAL '1 day'
      )
  LOOP
    INSERT INTO notificaciones (socio_id, tipo, titulo, mensaje)
    VALUES (
      r.id, 'reprocann_aviso',
      'Tu REPROCANN vence el ' || to_char(r.reprocann_vencimiento, 'DD/MM/YYYY'),
      'Renovalo a tiempo para no perder el acceso a pedidos.'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron diario a las 09:00 UTC (06:00 Argentina)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reprocann-diario');
EXCEPTION WHEN OTHERS THEN
  NULL; -- el job todavía no existía
END $$;

SELECT cron.schedule('reprocann-diario', '0 9 * * *', 'SELECT procesar_vencimientos_reprocann()');

-- Primera pasada inmediata (marca los ya vencidos)
SELECT procesar_vencimientos_reprocann();

-- ------------------------------------------------------------
-- 4) crear_pedido v3: descuento por cantidad sobre las flores
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

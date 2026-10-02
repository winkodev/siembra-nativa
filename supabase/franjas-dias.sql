-- ============================================================
-- SIEMBRA NATIVA CLUB - Franjas por día de la semana + anticipación
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Antes una franja era un texto libre ("Sábados") + horario y la app no
-- sabía qué día era. Ahora cada franja tiene sus días de la semana como
-- dato (0 = domingo ... 6 = sábado) y el socio elige una FECHA concreta.
-- Las fechas dentro de la anticipación mínima (48 hs por defecto,
-- configurable en Configuración → Horarios) no se pueden elegir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) franjas_horarias: días de la semana
-- ------------------------------------------------------------
ALTER TABLE franjas_horarias
  ADD COLUMN IF NOT EXISTS dias_semana INTEGER[] NOT NULL DEFAULT '{}';

-- Migración de las franjas existentes a partir del texto del día.
-- Las que no se reconozcan quedan con {} y el admin las edita a mano.
UPDATE franjas_horarias SET dias_semana = CASE
  WHEN dia ILIKE '%lunes a viernes%'  THEN '{1,2,3,4,5}'::INTEGER[]
  WHEN dia ILIKE '%lunes a s_bado%'   THEN '{1,2,3,4,5,6}'::INTEGER[]
  WHEN dia ILIKE '%todos los d_as%'   THEN '{0,1,2,3,4,5,6}'::INTEGER[]
  ELSE ARRAY_REMOVE(ARRAY[
    CASE WHEN dia ILIKE '%domingo%'   THEN 0 END,
    CASE WHEN dia ILIKE '%lunes%'     THEN 1 END,
    CASE WHEN dia ILIKE '%martes%'    THEN 2 END,
    CASE WHEN dia ILIKE '%mi_rcoles%' THEN 3 END,
    CASE WHEN dia ILIKE '%jueves%'    THEN 4 END,
    CASE WHEN dia ILIKE '%viernes%'   THEN 5 END,
    CASE WHEN dia ILIKE '%s_bado%'    THEN 6 END
  ], NULL)
END
WHERE dias_semana = '{}';

-- ------------------------------------------------------------
-- 2) Anticipación mínima (horas) entre el pedido y la entrega
-- ------------------------------------------------------------
INSERT INTO configuracion_app (clave, valor, descripcion) VALUES
  ('entrega_anticipacion_horas', '48', 'Horas mínimas entre que el socio pide y la franja de entrega que puede elegir')
ON CONFLICT (clave) DO NOTHING;

-- ------------------------------------------------------------
-- 3) pedidos: fecha concreta de entrega elegida
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS entrega_fecha DATE;

-- ------------------------------------------------------------
-- 4) crear_pedido v6: recibe p_fecha_entrega y valida que la fecha
--    caiga en un día de la franja y respete la anticipación mínima.
--    Misma lógica que v5 (cupones) + fecha.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
  p_items         JSONB,
  p_notas         TEXT DEFAULT NULL,
  p_franja_id     UUID DEFAULT NULL,
  p_cupon_id      UUID DEFAULT NULL,
  p_fecha_entrega DATE DEFAULT NULL
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
  -- Franja / fecha
  v_fr               RECORD;
  v_anticipacion     NUMERIC;
  v_inicio_entrega   TIMESTAMPTZ;
  v_dia_nombre       TEXT;
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
  -- Cupón (misma lógica que v5)
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

    v_base_cupon := v_subtotal_flores - v_monto_descuento + v_subtotal_prod;

    IF v_cupon.tipo = 'porcentaje' THEN
      v_monto_cupon := ROUND(v_base_cupon * v_cupon.valor / 100, 2);
    ELSIF v_cupon.tipo = 'monto' THEN
      v_monto_cupon := LEAST(v_cupon.valor, v_base_cupon);
    ELSIF v_cupon.tipo = 'envio_gratis' THEN
      v_monto_cupon := v_monto_envio;
      v_monto_envio := 0;
    ELSIF v_cupon.tipo = 'producto_gratis' THEN
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

  -- ----------------------------------------------------------
  -- Franja + fecha de entrega: obligatorias si el club tiene franjas activas.
  -- La fecha debe caer en un día de la franja y respetar la anticipación.
  -- ----------------------------------------------------------
  SELECT COUNT(*) INTO v_franjas_activas FROM franjas_horarias WHERE activa;
  IF v_franjas_activas > 0 THEN
    SELECT * INTO v_fr FROM franjas_horarias WHERE id = p_franja_id AND activa;
    IF v_fr.id IS NULL THEN
      RAISE EXCEPTION 'Elegí un horario de entrega';
    END IF;
    IF p_fecha_entrega IS NULL THEN
      RAISE EXCEPTION 'Elegí el día de entrega';
    END IF;
    IF NOT (EXTRACT(DOW FROM p_fecha_entrega)::INTEGER = ANY (v_fr.dias_semana)) THEN
      RAISE EXCEPTION 'Ese día no corresponde al horario elegido';
    END IF;

    SELECT COALESCE((SELECT valor::NUMERIC FROM configuracion_app WHERE clave = 'entrega_anticipacion_horas'), 48)
    INTO v_anticipacion;

    -- Inicio de la franja en hora argentina
    v_inicio_entrega := (p_fecha_entrega + v_fr.hora_desde) AT TIME ZONE 'America/Argentina/Buenos_Aires';
    IF v_inicio_entrega < NOW() + (v_anticipacion || ' hours')::INTERVAL THEN
      RAISE EXCEPTION 'Ese horario es muy pronto: la entrega se programa con % horas de anticipación', v_anticipacion;
    END IF;

    v_dia_nombre := (ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'])[EXTRACT(DOW FROM p_fecha_entrega)::INTEGER + 1];
    v_franja := v_dia_nombre || ' ' || to_char(p_fecha_entrega, 'DD/MM')
             || ' · ' || to_char(v_fr.hora_desde, 'HH24:MI') || '–' || to_char(v_fr.hora_hasta, 'HH24:MI') || ' hs';
  END IF;

  INSERT INTO pedidos (socio_id, notas, entrega_franja, entrega_fecha, monto_total, monto_envio, monto_descuento, cupon_id, monto_cupon)
  VALUES (
    v_socio,
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    v_franja,
    CASE WHEN v_franjas_activas > 0 THEN p_fecha_entrega END,
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

-- La firma vieja (4 parámetros) queda reemplazada por la nueva con DEFAULT:
-- las llamadas sin p_fecha_entrega siguen funcionando.
DROP FUNCTION IF EXISTS crear_pedido(JSONB, TEXT, UUID, UUID);

-- ============================================================
-- Verificación
-- ============================================================
SELECT id, dia, dias_semana, hora_desde, hora_hasta, activa FROM franjas_horarias ORDER BY created_at;

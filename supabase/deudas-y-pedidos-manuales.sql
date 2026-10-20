-- ============================================================
-- SIEMBRA NATIVA CLUB - Deudas a favor + pedidos manuales del admin
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- 1) tes_deudas.sentido: 'a_pagar' (el club debe) | 'a_cobrar' (le deben al club)
-- 2) pedidos manuales: los carga el admin para gente sin cuenta.
--    socio_id = el admin que lo cargó; cliente_nombre/direccion son texto libre.
--    crear_pedido_manual() valida stock y guarda el TOTAL que indica el admin.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Deudas con sentido
-- ------------------------------------------------------------
ALTER TABLE tes_deudas
  ADD COLUMN IF NOT EXISTS sentido TEXT NOT NULL DEFAULT 'a_pagar'
  CHECK (sentido IN ('a_pagar', 'a_cobrar'));

-- ------------------------------------------------------------
-- 2) Pedidos manuales
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS manual            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cliente_nombre    TEXT,
  ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;

-- Crea un pedido manual (solo admin). p_items: [{ "id": genetica_id, "cantidad": gramos }]
-- Valida stock disponible (neto de reservas) con el mismo lock que crear_pedido.
-- El precio de lista de cada ítem lo completa el trigger de pedido_items;
-- el total del pedido es el que indica el admin (puede ser promocional).
CREATE OR REPLACE FUNCTION crear_pedido_manual(
  p_items             JSONB,
  p_total             NUMERIC,
  p_cliente_nombre    TEXT DEFAULT NULL,
  p_cliente_direccion TEXT DEFAULT NULL,
  p_notas             TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin      UUID := auth.uid();
  v_rol        TEXT;
  item         JSONB;
  v_disponible NUMERIC;
  v_nombre     TEXT;
  v_pedido_id  UUID;
  v_numero     INTEGER;
BEGIN
  SELECT rol INTO v_rol FROM profiles WHERE id = v_admin;
  IF v_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede cargar pedidos manuales';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido está vacío';
  END IF;
  IF p_total IS NULL OR p_total < 0 THEN
    RAISE EXCEPTION 'Indicá el total del pedido';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'cantidad')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en el pedido';
    END IF;
    SELECT nombre, stock_total_gramos INTO v_nombre, v_disponible
    FROM stock_publico WHERE genetica_id = (item->>'id')::UUID;
    IF v_disponible IS NULL OR v_disponible < (item->>'cantidad')::NUMERIC THEN
      RAISE EXCEPTION 'Stock insuficiente para %', COALESCE(v_nombre, 'la genética');
    END IF;
  END LOOP;

  INSERT INTO pedidos (socio_id, manual, cliente_nombre, cliente_direccion, notas, monto_total, monto_envio)
  VALUES (
    v_admin, TRUE,
    NULLIF(btrim(COALESCE(p_cliente_nombre, '')), ''),
    NULLIF(btrim(COALESCE(p_cliente_direccion, '')), ''),
    NULLIF(btrim(COALESCE(p_notas, '')), ''),
    p_total, 0
  )
  RETURNING id, numero INTO v_pedido_id, v_numero;

  INSERT INTO pedido_items (pedido_id, genetica_id, cantidad_gramos)
  SELECT v_pedido_id, (i->>'id')::UUID, (i->>'cantidad')::NUMERIC
  FROM jsonb_array_elements(p_items) AS i;

  RETURN jsonb_build_object('pedido_id', v_pedido_id, 'numero', v_numero);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verificación
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tes_deudas' AND column_name = 'sentido') AS deudas_sentido,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name IN ('manual', 'cliente_nombre', 'cliente_direccion')) AS pedidos_cols;

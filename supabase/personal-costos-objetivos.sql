-- ============================================================
-- SIEMBRA NATIVA CLUB - Personal, costos del gramo y objetivos
-- Ejecutar COMPLETO en: Supabase Dashboard → SQL Editor
-- (se puede correr más de una vez)
--
-- Requiere: tesoreria.sql, deudas-y-pedidos-manuales.sql,
--           egresos-stock.sql y gestion-tareas.sql
-- Es compatible con la versión anterior de la app: no cambia la firma
-- de ninguna función existente y las columnas nuevas son opcionales.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas nuevas
-- ------------------------------------------------------------
-- Costo del lote: solo lo pagado por gramo. NULL = lote sin costo (los anteriores)
ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS costo_moneda     TEXT CHECK (costo_moneda IN ('ARS', 'USD')),
  ADD COLUMN IF NOT EXISTS costo_gramo      NUMERIC(14,4) CHECK (costo_gramo > 0),
  ADD COLUMN IF NOT EXISTS costo_cotizacion NUMERIC(14,4) CHECK (costo_cotizacion > 0),
  ADD COLUMN IF NOT EXISTS costo_gramo_ars  NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS proveedor        TEXT,
  ADD COLUMN IF NOT EXISTS deuda_id         UUID REFERENCES tes_deudas(id) ON DELETE SET NULL;

-- Genética incluida en el objetivo de reposición
ALTER TABLE geneticas ADD COLUMN IF NOT EXISTS reponer BOOLEAN NOT NULL DEFAULT TRUE;

-- Gasto fijo: monto estimado de una tarea mensual
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS monto NUMERIC(14,2) CHECK (monto > 0);

-- ------------------------------------------------------------
-- 2) Tablas
-- ------------------------------------------------------------
-- De qué lote salió cada gramo. El costo queda fijo aunque el lote se borre.
CREATE TABLE IF NOT EXISTS stock_consumos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id        UUID REFERENCES stock(id) ON DELETE SET NULL,
  genetica_id     UUID NOT NULL REFERENCES geneticas(id) ON DELETE CASCADE,
  gramos          NUMERIC(10,2) NOT NULL CHECK (gramos > 0),
  costo_gramo_ars NUMERIC(14,4),
  origen          TEXT NOT NULL CHECK (origen IN ('pedido', 'retiro', 'salida')),
  origen_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS stock_consumos_origen_idx   ON stock_consumos (origen, origen_id);
CREATE INDEX IF NOT EXISTS stock_consumos_genetica_idx ON stock_consumos (genetica_id, created_at);

CREATE TABLE IF NOT EXISTS personal (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('empleado', 'socio_admin')),
  cargo         TEXT,
  fecha_ingreso DATE NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de sueldos. desde = primer día del mes. porcentaje NULL = sueldo inicial.
CREATE TABLE IF NOT EXISTS personal_sueldos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personal_id UUID NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  desde       DATE NOT NULL,
  monto       NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  porcentaje  NUMERIC(8,2),
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personal_sueldos_idx ON personal_sueldos (personal_id, desde DESC, created_at DESC);

-- Pago de sueldo (periodo = mes) o aguinaldo (periodo = junio o diciembre).
-- monto es la plata que sale; retiros es lo descontado en flores.
CREATE TABLE IF NOT EXISTS personal_pagos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personal_id   UUID NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('sueldo', 'aguinaldo')),
  periodo       DATE NOT NULL,
  base          NUMERIC(14,2) NOT NULL CHECK (base > 0),
  extra         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (extra >= 0),
  retiros       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (retiros >= 0),
  monto         NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
  fecha         DATE NOT NULL,
  -- RESTRICT: el movimiento solo se borra anulando el pago
  movimiento_id UUID REFERENCES tes_movimientos(id) ON DELETE RESTRICT,
  nota          TEXT,
  anulado_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personal_pagos_idx ON personal_pagos (personal_id, periodo);

CREATE TABLE IF NOT EXISTS personal_retiros (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personal_id  UUID NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  genetica_id  UUID NOT NULL REFERENCES geneticas(id) ON DELETE RESTRICT,
  gramos       NUMERIC(10,2) NOT NULL CHECK (gramos > 0),
  precio_gramo NUMERIC(14,2) NOT NULL CHECK (precio_gramo > 0),
  total        NUMERIC(14,2) NOT NULL CHECK (total > 0),
  fecha        DATE NOT NULL,
  nota         TEXT,
  -- Socio administrador: deuda a favor del club
  deuda_id     UUID REFERENCES tes_deudas(id) ON DELETE RESTRICT,
  anulado_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personal_retiros_idx ON personal_retiros (personal_id, fecha);

-- Cuánto de cada retiro se descontó en cada pago (el sobrante pasa al siguiente)
CREATE TABLE IF NOT EXISTS personal_retiro_aplicaciones (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pago_id   UUID NOT NULL REFERENCES personal_pagos(id) ON DELETE CASCADE,
  retiro_id UUID NOT NULL REFERENCES personal_retiros(id) ON DELETE RESTRICT,
  monto     NUMERIC(14,2) NOT NULL CHECK (monto > 0)
);
CREATE INDEX IF NOT EXISTS personal_aplic_retiro_idx ON personal_retiro_aplicaciones (retiro_id);
CREATE INDEX IF NOT EXISTS personal_aplic_pago_idx   ON personal_retiro_aplicaciones (pago_id);

-- ------------------------------------------------------------
-- 3) RLS: solo superadmin. Pagos, retiros y consumos se escriben
--    únicamente por las funciones de abajo.
-- ------------------------------------------------------------
ALTER TABLE stock_consumos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_sueldos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_pagos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_retiros             ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_retiro_aplicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consumos_super" ON stock_consumos;
CREATE POLICY "consumos_super" ON stock_consumos FOR SELECT USING (es_superadmin());
DROP POLICY IF EXISTS "personal_super" ON personal;
CREATE POLICY "personal_super" ON personal FOR ALL USING (es_superadmin());
DROP POLICY IF EXISTS "personal_sueldos_super" ON personal_sueldos;
CREATE POLICY "personal_sueldos_super" ON personal_sueldos FOR ALL USING (es_superadmin());
DROP POLICY IF EXISTS "personal_pagos_super" ON personal_pagos;
CREATE POLICY "personal_pagos_super" ON personal_pagos FOR SELECT USING (es_superadmin());
DROP POLICY IF EXISTS "personal_retiros_super" ON personal_retiros;
CREATE POLICY "personal_retiros_super" ON personal_retiros FOR SELECT USING (es_superadmin());
DROP POLICY IF EXISTS "personal_aplic_super" ON personal_retiro_aplicaciones;
CREATE POLICY "personal_aplic_super" ON personal_retiro_aplicaciones FOR SELECT USING (es_superadmin());

-- ------------------------------------------------------------
-- 4) Lotes: consumir (FIFO, anota de qué lote salió) y devolver
--    Son internas: no se pueden llamar desde la app.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION _consumir_lotes(p_genetica_id UUID, p_gramos NUMERIC, p_origen TEXT, p_origen_id UUID)
RETURNS VOID AS $$
DECLARE
  v_restante NUMERIC := p_gramos;
  v_toma     NUMERIC;
  lote_row   RECORD;
BEGIN
  FOR lote_row IN
    SELECT id, cantidad_gramos, costo_gramo_ars FROM stock
    WHERE genetica_id = p_genetica_id AND cantidad_gramos > 0
    ORDER BY fecha_ingreso ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;
    v_toma := LEAST(lote_row.cantidad_gramos, v_restante);
    UPDATE stock SET cantidad_gramos = cantidad_gramos - v_toma WHERE id = lote_row.id;
    INSERT INTO stock_consumos (stock_id, genetica_id, gramos, costo_gramo_ars, origen, origen_id)
    VALUES (lote_row.id, p_genetica_id, v_toma, lote_row.costo_gramo_ars, p_origen, p_origen_id);
    v_restante := v_restante - v_toma;
  END LOOP;

  IF v_restante > 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para genética %', p_genetica_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Devuelve a cada lote lo que salió. Si el lote ya no existe, crea uno
-- de devolución con el mismo costo.
CREATE OR REPLACE FUNCTION _devolver_lotes(p_origen TEXT, p_origen_id UUID)
RETURNS VOID AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT * FROM stock_consumos WHERE origen = p_origen AND origen_id = p_origen_id FOR UPDATE LOOP
    UPDATE stock SET cantidad_gramos = cantidad_gramos + c.gramos WHERE id = c.stock_id;
    IF NOT FOUND THEN
      INSERT INTO stock (genetica_id, cantidad_gramos, lote, costo_gramo_ars)
      VALUES (c.genetica_id, c.gramos, 'devolucion:' || p_origen_id, c.costo_gramo_ars);
    END IF;
  END LOOP;
  DELETE FROM stock_consumos WHERE origen = p_origen AND origen_id = p_origen_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION _consumir_lotes(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _devolver_lotes(TEXT, UUID)                FROM PUBLIC, anon, authenticated;

-- Pedidos: igual que antes, ahora anotando el lote de origen
CREATE OR REPLACE FUNCTION descontar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
  prod RECORD;
BEGIN
  FOR item IN
    SELECT genetica_id, cantidad_gramos FROM pedido_items
    WHERE pedido_id = p_pedido_id AND genetica_id IS NOT NULL
  LOOP
    PERFORM _consumir_lotes(item.genetica_id, item.cantidad_gramos, 'pedido', p_pedido_id);
  END LOOP;

  FOR prod IN
    SELECT producto_id, cantidad_unidades FROM pedido_items
    WHERE pedido_id = p_pedido_id AND producto_id IS NOT NULL
  LOOP
    UPDATE productos
    SET stock = stock - prod.cantidad_unidades
    WHERE id = prod.producto_id AND stock >= prod.cantidad_unidades;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para producto %', prod.producto_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Devolución: los pedidos anteriores a este SQL no tienen lotes anotados
-- y vuelven como lote nuevo, igual que antes.
CREATE OR REPLACE FUNCTION restaurar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item    RECORD;
  v_falta NUMERIC;
BEGIN
  FOR item IN
    SELECT genetica_id, SUM(cantidad_gramos) AS gramos FROM pedido_items
    WHERE pedido_id = p_pedido_id AND genetica_id IS NOT NULL
    GROUP BY genetica_id
  LOOP
    SELECT item.gramos - COALESCE(SUM(sc.gramos), 0) INTO v_falta
    FROM stock_consumos sc
    WHERE sc.origen = 'pedido' AND sc.origen_id = p_pedido_id AND sc.genetica_id = item.genetica_id;
    IF v_falta > 0 THEN
      INSERT INTO stock (genetica_id, cantidad_gramos, lote)
      VALUES (item.genetica_id, v_falta, 'devolucion:' || p_pedido_id);
    END IF;
  END LOOP;
  PERFORM _devolver_lotes('pedido', p_pedido_id);

  FOR item IN
    SELECT producto_id, cantidad_unidades FROM pedido_items
    WHERE pedido_id = p_pedido_id AND producto_id IS NOT NULL
  LOOP
    UPDATE productos SET stock = stock + item.cantidad_unidades WHERE id = item.producto_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Salida manual: mismas validaciones que antes
CREATE OR REPLACE FUNCTION egreso_manual_stock(p_genetica_id UUID, p_gramos NUMERIC, p_motivo TEXT)
RETURNS UUID AS $$
DECLARE
  v_total NUMERIC;
  v_id    UUID;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede registrar salidas manuales'; END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0'; END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN RAISE EXCEPTION 'Indicá el motivo de la salida'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  SELECT COALESCE(SUM(cantidad_gramos), 0) INTO v_total FROM stock WHERE genetica_id = p_genetica_id;
  IF v_total < p_gramos THEN RAISE EXCEPTION 'Stock insuficiente: hay %g físicos de esta genética', v_total; END IF;

  INSERT INTO egresos_stock (genetica_id, gramos, motivo, admin_id)
  VALUES (p_genetica_id, p_gramos, btrim(p_motivo), auth.uid())
  RETURNING id INTO v_id;
  PERFORM _consumir_lotes(p_genetica_id, p_gramos, 'salida', v_id);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5) Ingreso de stock con costo: crea el lote y la deuda del club.
--    Cualquier admin carga; la deuda la paga el superadmin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ingresar_stock(
  p_genetica_id UUID, p_gramos NUMERIC, p_ubicacion TEXT, p_lote TEXT, p_fecha DATE,
  p_moneda TEXT, p_costo_gramo NUMERIC, p_cotizacion NUMERIC, p_proveedor TEXT, p_vence DATE
)
RETURNS UUID AS $$
DECLARE
  v_deuda UUID;
  v_stock UUID;
  v_gen   TEXT;
BEGIN
  IF COALESCE(get_my_role()::TEXT, '') <> 'admin' THEN RAISE EXCEPTION 'Solo un admin puede ingresar stock'; END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0'; END IF;
  IF p_moneda IS NULL OR p_moneda NOT IN ('ARS', 'USD') THEN RAISE EXCEPTION 'Moneda inválida'; END IF;
  IF p_costo_gramo IS NULL OR p_costo_gramo <= 0 THEN RAISE EXCEPTION 'Indicá el costo por gramo'; END IF;
  IF p_moneda = 'USD' AND (p_cotizacion IS NULL OR p_cotizacion <= 0) THEN RAISE EXCEPTION 'Indicá la cotización del dólar'; END IF;
  IF btrim(COALESCE(p_proveedor, '')) = '' THEN RAISE EXCEPTION 'Indicá a quién se le compró'; END IF;

  SELECT nombre INTO v_gen FROM geneticas WHERE id = p_genetica_id;
  IF v_gen IS NULL THEN RAISE EXCEPTION 'La genética no existe'; END IF;

  INSERT INTO tes_deudas (acreedor, sentido, moneda, monto, vence_at, nota, created_by)
  VALUES (btrim(p_proveedor), 'a_pagar', p_moneda, ROUND(p_gramos * p_costo_gramo, 2), p_vence,
          'Compra de ' || trim_scale(p_gramos) || 'g de ' || v_gen || COALESCE(' · ' || p_lote, ''), auth.uid())
  RETURNING id INTO v_deuda;

  INSERT INTO stock (genetica_id, cantidad_gramos, ubicacion, lote, fecha_ingreso,
                     costo_moneda, costo_gramo, costo_cotizacion, costo_gramo_ars, proveedor, deuda_id)
  VALUES (p_genetica_id, p_gramos, p_ubicacion, p_lote, p_fecha,
          p_moneda, p_costo_gramo, CASE WHEN p_moneda = 'USD' THEN p_cotizacion END,
          p_costo_gramo * CASE WHEN p_moneda = 'USD' THEN p_cotizacion ELSE 1 END, btrim(p_proveedor), v_deuda)
  RETURNING id INTO v_stock;
  RETURN v_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Corregir gramos o costo de un lote con costo: actualiza la deuda y lo ya salido
CREATE OR REPLACE FUNCTION corregir_costo_lote(p_stock_id UUID, p_gramos NUMERIC, p_costo_gramo NUMERIC, p_cotizacion NUMERIC)
RETURNS VOID AS $$
DECLARE
  s        RECORD;
  v_total  NUMERIC;
  v_pagado NUMERIC;
  v_ars    NUMERIC;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede editar ingresos de stock'; END IF;
  SELECT * INTO s FROM stock WHERE id = p_stock_id FOR UPDATE;
  IF s.id IS NULL OR s.costo_gramo IS NULL THEN RAISE EXCEPTION 'Este lote no tiene costo'; END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0'; END IF;
  IF p_costo_gramo IS NULL OR p_costo_gramo <= 0 THEN RAISE EXCEPTION 'Indicá el costo por gramo'; END IF;
  IF s.costo_moneda = 'USD' AND (p_cotizacion IS NULL OR p_cotizacion <= 0) THEN RAISE EXCEPTION 'Indicá la cotización del dólar'; END IF;

  v_total := ROUND(p_gramos * p_costo_gramo, 2);
  v_ars   := p_costo_gramo * CASE WHEN s.costo_moneda = 'USD' THEN p_cotizacion ELSE 1 END;

  IF s.deuda_id IS NOT NULL THEN
    SELECT COALESCE(SUM(monto), 0) INTO v_pagado FROM tes_movimientos WHERE deuda_id = s.deuda_id;
    IF v_total < v_pagado THEN RAISE EXCEPTION 'Ya se pagaron % de esta compra: el total no puede quedar por debajo', v_pagado; END IF;
    UPDATE tes_deudas SET monto = v_total WHERE id = s.deuda_id;
  END IF;

  UPDATE stock SET costo_gramo = p_costo_gramo, costo_gramo_ars = v_ars,
                   costo_cotizacion = CASE WHEN s.costo_moneda = 'USD' THEN p_cotizacion END
  WHERE id = p_stock_id;
  UPDATE stock_consumos SET costo_gramo_ars = v_ars WHERE stock_id = p_stock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 6) Retiros de flores del personal
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_retiro_personal(
  p_personal_id UUID, p_genetica_id UUID, p_gramos NUMERIC, p_precio NUMERIC, p_fecha DATE, p_nota TEXT
)
RETURNS UUID AS $$
DECLARE
  per       RECORD;
  v_gen     TEXT;
  v_fisico  NUMERIC;
  v_reserva NUMERIC;
  v_total   NUMERIC;
  v_deuda   UUID;
  v_id      UUID;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede registrar retiros'; END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0'; END IF;
  IF p_precio IS NULL OR p_precio <= 0 THEN RAISE EXCEPTION 'El precio tiene que ser mayor a 0'; END IF;

  SELECT * INTO per FROM personal WHERE id = p_personal_id AND activo;
  IF per.id IS NULL THEN RAISE EXCEPTION 'La persona no existe o está dada de baja'; END IF;
  SELECT nombre INTO v_gen FROM geneticas WHERE id = p_genetica_id;
  IF v_gen IS NULL THEN RAISE EXCEPTION 'La genética no existe'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));

  -- No toca lo reservado por pedidos pendientes
  SELECT COALESCE(SUM(cantidad_gramos), 0) INTO v_fisico FROM stock WHERE genetica_id = p_genetica_id;
  SELECT COALESCE(SUM(pi.cantidad_gramos), 0) INTO v_reserva
  FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
  WHERE pi.genetica_id = p_genetica_id AND p.estado = 'pendiente';
  IF v_fisico - v_reserva < p_gramos THEN
    RAISE EXCEPTION 'Stock insuficiente: hay %g disponibles de esta genética', trim_scale(GREATEST(v_fisico - v_reserva, 0));
  END IF;

  v_total := ROUND(p_gramos * p_precio, 2);
  IF per.tipo = 'socio_admin' THEN
    INSERT INTO tes_deudas (acreedor, sentido, moneda, monto, nota, created_by)
    VALUES (per.nombre, 'a_cobrar', 'ARS', v_total, 'Retiro de ' || trim_scale(p_gramos) || 'g de ' || v_gen, auth.uid())
    RETURNING id INTO v_deuda;
  END IF;

  INSERT INTO personal_retiros (personal_id, genetica_id, gramos, precio_gramo, total, fecha, nota, deuda_id, created_by)
  VALUES (p_personal_id, p_genetica_id, p_gramos, p_precio, v_total, p_fecha, NULLIF(btrim(COALESCE(p_nota, '')), ''), v_deuda, auth.uid())
  RETURNING id INTO v_id;
  PERFORM _consumir_lotes(p_genetica_id, p_gramos, 'retiro', v_id);
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION anular_retiro_personal(p_retiro_id UUID)
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede anular retiros'; END IF;
  -- Mismo lock que los pagos: no se puede descontar y anular a la vez
  PERFORM pg_advisory_xact_lock(hashtext('personal_pagos'));
  PERFORM pg_advisory_xact_lock(hashtext('crear_pedido'));
  SELECT * INTO r FROM personal_retiros WHERE id = p_retiro_id FOR UPDATE;
  IF r.id IS NULL OR r.anulado_at IS NOT NULL THEN RAISE EXCEPTION 'El retiro no existe o ya está anulado'; END IF;
  IF EXISTS (SELECT 1 FROM personal_retiro_aplicaciones WHERE retiro_id = r.id) THEN
    RAISE EXCEPTION 'Este retiro ya se descontó de un sueldo: anulá primero ese pago';
  END IF;
  IF r.deuda_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM tes_movimientos WHERE deuda_id = r.deuda_id) THEN
      RAISE EXCEPTION 'Esta deuda ya tiene cobros: eliminá primero esos movimientos en Tesorería';
    END IF;
    UPDATE tes_deudas SET anulada = TRUE WHERE id = r.deuda_id;
  END IF;
  PERFORM _devolver_lotes('retiro', r.id);
  UPDATE personal_retiros SET anulado_at = NOW() WHERE id = r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 7) Pagos: sueldo y aguinaldo (solo pesos)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION pagar_personal(
  p_personal_id UUID, p_tipo TEXT, p_periodo DATE, p_base NUMERIC, p_extra NUMERIC,
  p_retiros NUMERIC, p_monto NUMERIC, p_cuenta_id UUID, p_fecha DATE, p_nota TEXT
)
RETURNS UUID AS $$
DECLARE
  per       RECORD;
  ant       RECORD;
  ret       RECORD;
  v_base    NUMERIC;
  v_falta   NUMERIC;
  v_resto   NUMERIC;
  v_toma    NUMERIC;
  v_mov     UUID;
  v_cat     UUID;
  v_pago    UUID;
  v_detalle TEXT;
  v_meses   TEXT[] := ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede pagar sueldos'; END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('sueldo', 'aguinaldo') THEN RAISE EXCEPTION 'Tipo de pago inválido'; END IF;
  IF COALESCE(p_extra, -1) < 0 OR COALESCE(p_retiros, -1) < 0 OR COALESCE(p_monto, -1) < 0 THEN
    RAISE EXCEPTION 'Los importes no pueden ser negativos';
  END IF;
  IF p_monto + p_retiros <= 0 THEN RAISE EXCEPTION 'No hay nada para pagar'; END IF;
  IF p_tipo = 'aguinaldo' AND p_retiros > 0 THEN RAISE EXCEPTION 'Los retiros no se descuentan del aguinaldo'; END IF;
  IF p_tipo = 'aguinaldo' AND EXTRACT(MONTH FROM p_periodo) NOT IN (6, 12) THEN RAISE EXCEPTION 'El aguinaldo es de junio o diciembre'; END IF;
  p_periodo := date_trunc('month', p_periodo)::DATE;

  PERFORM pg_advisory_xact_lock(hashtext('personal_pagos'));
  SELECT * INTO per FROM personal WHERE id = p_personal_id;
  IF per.id IS NULL OR per.tipo <> 'empleado' THEN RAISE EXCEPTION 'Solo se pagan sueldos a empleados'; END IF;

  IF p_tipo = 'sueldo' THEN
    SELECT ps.monto INTO v_base FROM personal_sueldos ps
    WHERE ps.personal_id = per.id AND ps.desde <= p_periodo
    ORDER BY ps.desde DESC, ps.created_at DESC LIMIT 1;
    IF v_base IS NULL THEN RAISE EXCEPTION 'No hay sueldo vigente en ese mes'; END IF;
  ELSE
    v_base := p_base;
    IF v_base IS NULL OR v_base <= 0 THEN RAISE EXCEPTION 'Indicá el importe del aguinaldo'; END IF;
  END IF;

  SELECT COALESCE(SUM(pp.extra), 0) AS extra, COALESCE(SUM(pp.monto + pp.retiros), 0) AS cubierto INTO ant
  FROM personal_pagos pp
  WHERE pp.personal_id = per.id AND pp.tipo = p_tipo AND pp.periodo = p_periodo AND pp.anulado_at IS NULL;
  v_falta := v_base + ant.extra + p_extra - ant.cubierto;
  IF p_monto + p_retiros > v_falta THEN
    RAISE EXCEPTION 'Supera lo que falta pagar de ese período: $%', trim_scale(GREATEST(v_falta, 0));
  END IF;

  -- La plata que sale
  v_detalle := CASE WHEN p_tipo = 'sueldo' THEN 'Sueldo ' ELSE 'Aguinaldo ' END
    || v_meses[EXTRACT(MONTH FROM p_periodo)::INT] || ' ' || EXTRACT(YEAR FROM p_periodo)::INT || ' · ' || per.nombre;
  IF p_monto > 0 THEN
    IF p_cuenta_id IS NULL THEN RAISE EXCEPTION 'Elegí la cuenta'; END IF;
    SELECT id INTO v_cat FROM tes_categorias WHERE nombre = 'Sueldos y honorarios' AND tipo = 'egreso';
    INSERT INTO tes_movimientos (tipo, fecha, cuenta_id, moneda, monto, categoria_id, concepto, nota, created_by)
    VALUES ('egreso', p_fecha, p_cuenta_id, 'ARS', p_monto, v_cat, v_detalle, NULLIF(btrim(COALESCE(p_nota, '')), ''), auth.uid())
    RETURNING id INTO v_mov;
  END IF;

  INSERT INTO personal_pagos (personal_id, tipo, periodo, base, extra, retiros, monto, fecha, movimiento_id, nota, created_by)
  VALUES (per.id, p_tipo, p_periodo, v_base, p_extra, p_retiros, p_monto, p_fecha, v_mov, NULLIF(btrim(COALESCE(p_nota, '')), ''), auth.uid())
  RETURNING id INTO v_pago;

  -- Descuento de retiros: los más viejos primero; el sobrante queda para el próximo pago
  v_resto := p_retiros;
  FOR ret IN
    SELECT r.id, r.total - COALESCE((SELECT SUM(a.monto) FROM personal_retiro_aplicaciones a WHERE a.retiro_id = r.id), 0) AS pendiente
    FROM personal_retiros r
    WHERE r.personal_id = per.id AND r.anulado_at IS NULL AND r.deuda_id IS NULL
    ORDER BY r.fecha, r.created_at
  LOOP
    EXIT WHEN v_resto <= 0;
    CONTINUE WHEN ret.pendiente <= 0;
    v_toma := LEAST(ret.pendiente, v_resto);
    INSERT INTO personal_retiro_aplicaciones (pago_id, retiro_id, monto) VALUES (v_pago, ret.id, v_toma);
    v_resto := v_resto - v_toma;
  END LOOP;
  IF v_resto > 0 THEN RAISE EXCEPTION 'El descuento supera los retiros pendientes'; END IF;

  RETURN v_pago;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Anular: devuelve la plata y reabre los retiros descontados
CREATE OR REPLACE FUNCTION anular_pago_personal(p_pago_id UUID)
RETURNS VOID AS $$
DECLARE
  g RECORD;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede anular pagos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('personal_pagos'));
  SELECT * INTO g FROM personal_pagos WHERE id = p_pago_id FOR UPDATE;
  IF g.id IS NULL OR g.anulado_at IS NOT NULL THEN RAISE EXCEPTION 'El pago no existe o ya está anulado'; END IF;
  DELETE FROM personal_retiro_aplicaciones WHERE pago_id = g.id;
  UPDATE personal_pagos SET anulado_at = NOW(), movimiento_id = NULL WHERE id = g.id;
  DELETE FROM tes_movimientos WHERE id = g.movimiento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 8) Reposición por genética. Solo cuentan los lotes con costo.
--    Las salidas suman, los ingresos restan y nunca baja de 0.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION objetivo_reposicion()
RETURNS JSONB AS $$
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede ver los objetivos'; END IF;
  RETURN (
    WITH ev AS (
      SELECT c.genetica_id, c.created_at AS t, 1 AS ord, c.gramos AS d
      FROM stock_consumos c WHERE c.costo_gramo_ars IS NOT NULL
      UNION ALL
      SELECT st.genetica_id, st.created_at, 0, -st.cantidad_inicial
      FROM stock st WHERE st.costo_gramo_ars IS NOT NULL AND COALESCE(st.lote, '') NOT LIKE 'devolucion:%'
    ), acc AS (
      SELECT genetica_id,
             SUM(d) OVER (PARTITION BY genetica_id ORDER BY t, ord ROWS UNBOUNDED PRECEDING) AS suma,
             ROW_NUMBER() OVER (PARTITION BY genetica_id ORDER BY t DESC, ord DESC) AS rn
      FROM ev
    ), falta AS (
      SELECT genetica_id, MAX(suma) FILTER (WHERE rn = 1) - LEAST(0, MIN(suma)) AS gramos
      FROM acc GROUP BY genetica_id
    ), ult AS (
      SELECT DISTINCT ON (genetica_id) genetica_id, costo_gramo_ars
      FROM stock WHERE costo_gramo_ars IS NOT NULL AND COALESCE(lote, '') NOT LIKE 'devolucion:%'
      ORDER BY genetica_id, created_at DESC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'genetica_id', g.id, 'nombre', g.nombre, 'reponer', g.reponer,
      'gramos', COALESCE(f.gramos, 0), 'costo', u.costo_gramo_ars,
      -- Pendientes que saldrían de lotes con costo (primero se agotan los que no tienen)
      'pendientes', GREATEST(
        COALESCE((SELECT SUM(pi.cantidad_gramos) FROM pedido_items pi JOIN pedidos p ON p.id = pi.pedido_id
                  WHERE pi.genetica_id = g.id AND p.estado = 'pendiente'), 0)
        - COALESCE((SELECT SUM(st.cantidad_gramos) FROM stock st WHERE st.genetica_id = g.id AND st.costo_gramo_ars IS NULL), 0), 0)
    ) ORDER BY COALESCE(f.gramos, 0) * u.costo_gramo_ars DESC, g.nombre), '[]'::jsonb)
    FROM ult u
    JOIN geneticas g ON g.id = u.genetica_id
    LEFT JOIN falta f ON f.genetica_id = g.id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 9) Ganancia real: venta de flores (neta de descuentos, sin envío)
--    menos el costo de los lotes de donde salieron
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ganancia_flores(p_desde TIMESTAMPTZ, p_hasta TIMESTAMPTZ, p_estados TEXT[])
RETURNS JSONB AS $$
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede consultar finanzas'; END IF;
  RETURN (
    WITH ped AS (
      SELECT p.id, p.numero, p.created_at,
             GREATEST(COALESCE(p.monto_total, 0) - COALESCE(p.monto_envio, 0), 0) AS neto,
             (SELECT SUM(COALESCE(i.precio_unitario, 0) * COALESCE(i.cantidad_gramos, i.cantidad_unidades, 0))
              FROM pedido_items i WHERE i.pedido_id = p.id) AS bruto
      FROM pedidos p
      WHERE p.created_at BETWEEN p_desde AND p_hasta AND p.estado::TEXT = ANY (p_estados)
    ), it AS (
      SELECT pedido_id, genetica_id, SUM(cantidad_gramos) AS gramos, SUM(cantidad_gramos * COALESCE(precio_unitario, 0)) AS bruto
      FROM pedido_items WHERE genetica_id IS NOT NULL AND pedido_id IN (SELECT id FROM ped)
      GROUP BY 1, 2
    ), co AS (
      SELECT origen_id AS pedido_id, genetica_id, SUM(gramos) AS gramos, SUM(gramos * costo_gramo_ars) AS costo
      FROM stock_consumos
      WHERE origen = 'pedido' AND costo_gramo_ars IS NOT NULL AND origen_id IN (SELECT id FROM ped)
      GROUP BY 1, 2
    ), fila AS (
      SELECT ped.id, ped.numero, ped.created_at, g.nombre, co.gramos, co.costo,
             -- Venta de los gramos con costo, prorrateada por lo cobrado de verdad
             CASE WHEN ped.bruto > 0 AND it.gramos > 0
                  THEN it.bruto * (ped.neto / ped.bruto) * (co.gramos / it.gramos) ELSE 0 END AS venta
      FROM co
      JOIN ped ON ped.id = co.pedido_id
      JOIN it  ON it.pedido_id = co.pedido_id AND it.genetica_id = co.genetica_id
      JOIN geneticas g ON g.id = co.genetica_id
    )
    SELECT jsonb_build_object(
      'geneticas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', a.nombre, 'gramos', a.gramos, 'venta', a.venta, 'costo', a.costo) ORDER BY a.venta - a.costo DESC), '[]'::jsonb)
        FROM (SELECT nombre, SUM(gramos) AS gramos, SUM(venta) AS venta, SUM(costo) AS costo FROM fila GROUP BY nombre) a),
      'pedidos', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', b.id, 'numero', b.numero, 'fecha', b.created_at, 'gramos', b.gramos, 'venta', b.venta, 'costo', b.costo) ORDER BY b.created_at DESC), '[]'::jsonb)
        FROM (SELECT id, numero, created_at, SUM(gramos) AS gramos, SUM(venta) AS venta, SUM(costo) AS costo FROM fila GROUP BY 1, 2, 3) b)
    )
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Ninguna de estas funciones es para usuarios sin sesión
REVOKE ALL ON FUNCTION ingresar_stock(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION corregir_costo_lote(UUID, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION registrar_retiro_personal(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION anular_retiro_personal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pagar_personal(UUID, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION anular_pago_personal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION objetivo_reposicion() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ganancia_flores(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ingresar_stock(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION corregir_costo_lote(UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_retiro_personal(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_retiro_personal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION pagar_personal(UUID, TEXT, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_pago_personal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION objetivo_reposicion() TO authenticated;
GRANT EXECUTE ON FUNCTION ganancia_flores(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]) TO authenticated;

-- Que la API vea las tablas y funciones nuevas al instante
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación
-- ============================================================
SELECT (SELECT COUNT(*) FROM personal) AS personal,
       (SELECT COUNT(*) FROM stock WHERE costo_gramo IS NOT NULL) AS lotes_con_costo;

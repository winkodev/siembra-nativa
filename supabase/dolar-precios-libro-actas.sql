-- ============================================================
-- SIEMBRA NATIVA CLUB - Costo en dólares editable, reposición al dólar
-- del día y libro de actas de socios
-- Ejecutar COMPLETO en: Supabase Dashboard → SQL Editor (se puede repetir)
-- Requiere: personal-costos-objetivos.sql
-- Compatible con la versión publicada: solo agrega.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Libro de actas: lo marca un admin a mano
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS libro_actas BOOLEAN NOT NULL DEFAULT FALSE;

-- Un socio puede editar sus datos de contacto, pero no los que maneja el club.
-- (La política de UPDATE del socio no limita columnas.) Admins y service role, libres.
CREATE OR REPLACE FUNCTION proteger_campos_perfil()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(get_my_role()::TEXT, '') = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.superadmin IS DISTINCT FROM OLD.superadmin
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.compra_habilitada IS DISTINCT FROM OLD.compra_habilitada
     OR NEW.notas_admin IS DISTINCT FROM OLD.notas_admin
     OR NEW.reprocann_vencimiento IS DISTINCT FROM OLD.reprocann_vencimiento
     OR NEW.libro_actas IS DISTINCT FROM OLD.libro_actas
     -- Al subir un certificado nuevo, el socio solo puede dejarlo pendiente
     OR (NEW.reprocann_estado IS DISTINCT FROM OLD.reprocann_estado AND NEW.reprocann_estado::TEXT <> 'pendiente')
  THEN
    RAISE EXCEPTION 'No podés modificar ese dato de tu perfil';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_proteger_campos ON profiles;
CREATE TRIGGER profiles_proteger_campos
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil();

-- ------------------------------------------------------------
-- 2) Corregir un lote con costo, ahora también la moneda.
--    Cambiar la moneda solo si la compra todavía no tiene pagos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION corregir_costo_lote(p_stock_id UUID, p_gramos NUMERIC, p_costo_gramo NUMERIC, p_cotizacion NUMERIC, p_moneda TEXT)
RETURNS VOID AS $$
DECLARE
  s        RECORD;
  v_moneda TEXT;
  v_total  NUMERIC;
  v_pagado NUMERIC;
  v_ars    NUMERIC;
BEGIN
  IF NOT es_superadmin() THEN RAISE EXCEPTION 'Solo el superadmin puede editar ingresos de stock'; END IF;
  SELECT * INTO s FROM stock WHERE id = p_stock_id FOR UPDATE;
  IF s.id IS NULL OR s.costo_gramo IS NULL THEN RAISE EXCEPTION 'Este lote no tiene costo'; END IF;
  v_moneda := COALESCE(p_moneda, s.costo_moneda);
  IF v_moneda NOT IN ('ARS', 'USD') THEN RAISE EXCEPTION 'Moneda inválida'; END IF;
  IF p_gramos IS NULL OR p_gramos <= 0 THEN RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0'; END IF;
  IF p_costo_gramo IS NULL OR p_costo_gramo <= 0 THEN RAISE EXCEPTION 'Indicá el costo por gramo'; END IF;
  IF v_moneda = 'USD' AND (p_cotizacion IS NULL OR p_cotizacion <= 0) THEN RAISE EXCEPTION 'Indicá la cotización del dólar'; END IF;

  v_total := ROUND(p_gramos * p_costo_gramo, 2);
  v_ars   := p_costo_gramo * CASE WHEN v_moneda = 'USD' THEN p_cotizacion ELSE 1 END;

  IF s.deuda_id IS NOT NULL THEN
    SELECT COALESCE(SUM(monto), 0) INTO v_pagado FROM tes_movimientos WHERE deuda_id = s.deuda_id;
    IF v_moneda <> s.costo_moneda AND v_pagado > 0 THEN
      RAISE EXCEPTION 'Esta compra ya tiene pagos: no se puede cambiar la moneda';
    END IF;
    IF v_total < v_pagado THEN RAISE EXCEPTION 'Ya se pagaron % de esta compra: el total no puede quedar por debajo', v_pagado; END IF;
    UPDATE tes_deudas SET monto = v_total, moneda = v_moneda WHERE id = s.deuda_id;
  END IF;

  UPDATE stock SET costo_moneda = v_moneda, costo_gramo = p_costo_gramo, costo_gramo_ars = v_ars,
                   costo_cotizacion = CASE WHEN v_moneda = 'USD' THEN p_cotizacion END
  WHERE id = p_stock_id;
  UPDATE stock_consumos SET costo_gramo_ars = v_ars WHERE stock_id = p_stock_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION corregir_costo_lote(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION corregir_costo_lote(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 3) Reposición: además del costo en pesos, la moneda y el costo
--    en dólares del último lote, para valuarlo al dólar del día.
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
      SELECT DISTINCT ON (genetica_id) genetica_id, costo_gramo_ars, costo_moneda, costo_gramo
      FROM stock WHERE costo_gramo_ars IS NOT NULL AND COALESCE(lote, '') NOT LIKE 'devolucion:%'
      ORDER BY genetica_id, created_at DESC
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'genetica_id', g.id, 'nombre', g.nombre, 'reponer', g.reponer,
      'gramos', COALESCE(f.gramos, 0), 'costo', u.costo_gramo_ars,
      'costo_usd', CASE WHEN u.costo_moneda = 'USD' THEN u.costo_gramo END,
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

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación
-- ============================================================
SELECT (SELECT COUNT(*) FROM profiles WHERE libro_actas) AS en_libro_actas,
       (SELECT COUNT(*) FROM stock WHERE costo_moneda = 'USD') AS lotes_en_dolares;

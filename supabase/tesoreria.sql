-- ============================================================
-- SIEMBRA NATIVA CLUB - Tesorería (solo superadmin)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Cuánta plata tiene el club, dónde está y a quién le debe.
--   tes_cuentas     : dónde está el dinero (cada cuenta puede tener ARS y USD)
--   tes_categorias  : rubros de ingresos/egresos (editables)
--   tes_deudas      : deudas del club con terceros, en ARS o USD
--   tes_movimientos : ingreso | egreso | transferencia | cambio | inicial
--   tes_saldos()    : saldo por cuenta y moneda
-- Todo es solo para el superadmin (RLS). Los cobros de pedidos los
-- inserta el servidor con el service role al aprobar un pedido.
-- ============================================================

CREATE TABLE IF NOT EXISTS tes_cuentas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tes_categorias (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  -- ingreso | egreso
  tipo       TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  activa     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (nombre, tipo)
);

CREATE TABLE IF NOT EXISTS tes_deudas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acreedor    TEXT NOT NULL,
  moneda      TEXT NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  monto       NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  vence_at    DATE,
  nota        TEXT,
  anulada     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tes_movimientos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  -- inicial (blanqueo) | ingreso | egreso | transferencia | cambio
  tipo              TEXT NOT NULL CHECK (tipo IN ('inicial', 'ingreso', 'egreso', 'transferencia', 'cambio')),
  -- Origen: en ingreso/inicial es la cuenta que RECIBE; en egreso la que PAGA;
  -- en transferencia/cambio la que SALE
  cuenta_id         UUID NOT NULL REFERENCES tes_cuentas(id) ON DELETE RESTRICT,
  moneda            TEXT NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  monto             NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  -- Destino (transferencia: misma moneda; cambio: otra moneda)
  cuenta_destino_id UUID REFERENCES tes_cuentas(id) ON DELETE RESTRICT,
  moneda_destino    TEXT CHECK (moneda_destino IN ('ARS', 'USD')),
  monto_destino     NUMERIC(14,2) CHECK (monto_destino > 0),
  -- Cambio: pesos por dólar (monto ARS / monto USD), informativo
  tipo_cambio       NUMERIC(14,4),
  categoria_id      UUID REFERENCES tes_categorias(id) ON DELETE SET NULL,
  -- Egreso que paga una deuda
  deuda_id          UUID REFERENCES tes_deudas(id) ON DELETE SET NULL,
  -- Ingreso automático por pedido cobrado
  pedido_id         UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  concepto          TEXT NOT NULL,
  nota              TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tes_mov_destino_ok CHECK (
    (tipo IN ('inicial', 'ingreso', 'egreso') AND cuenta_destino_id IS NULL) OR
    (tipo = 'transferencia' AND cuenta_destino_id IS NOT NULL AND moneda_destino = moneda AND monto_destino = monto) OR
    (tipo = 'cambio'        AND cuenta_destino_id IS NOT NULL AND moneda_destino <> moneda AND monto_destino IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS tes_mov_fecha_idx   ON tes_movimientos (fecha DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS tes_mov_cuenta_idx  ON tes_movimientos (cuenta_id);
CREATE INDEX IF NOT EXISTS tes_mov_deuda_idx   ON tes_movimientos (deuda_id) WHERE deuda_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tes_mov_pedido_idx ON tes_movimientos (pedido_id) WHERE pedido_id IS NOT NULL;

-- ------------------------------------------------------------
-- RLS: solo superadmin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT superadmin FROM profiles WHERE id = auth.uid() AND rol = 'admin'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE tes_cuentas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tes_categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tes_deudas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tes_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tes_cuentas_super"     ON tes_cuentas;
DROP POLICY IF EXISTS "tes_categorias_super"  ON tes_categorias;
DROP POLICY IF EXISTS "tes_deudas_super"      ON tes_deudas;
DROP POLICY IF EXISTS "tes_movimientos_super" ON tes_movimientos;
CREATE POLICY "tes_cuentas_super"     ON tes_cuentas     FOR ALL USING (es_superadmin());
CREATE POLICY "tes_categorias_super"  ON tes_categorias  FOR ALL USING (es_superadmin());
CREATE POLICY "tes_deudas_super"      ON tes_deudas      FOR ALL USING (es_superadmin());
CREATE POLICY "tes_movimientos_super" ON tes_movimientos FOR ALL USING (es_superadmin());

-- ------------------------------------------------------------
-- Categorías iniciales (editables desde la app)
-- ------------------------------------------------------------
INSERT INTO tes_categorias (nombre, tipo) VALUES
  ('Cobro de pedidos',    'ingreso'),
  ('Cuotas sociales',     'ingreso'),
  ('Donaciones',          'ingreso'),
  ('Otros ingresos',      'ingreso'),
  ('Insumos de cultivo',  'egreso'),
  ('Alquiler',            'egreso'),
  ('Servicios',           'egreso'),
  ('Sueldos y honorarios','egreso'),
  ('Envíos',              'egreso'),
  ('Impuestos y tasas',   'egreso'),
  ('Pago de deudas',      'egreso'),
  ('Otros egresos',       'egreso')
ON CONFLICT (nombre, tipo) DO NOTHING;

-- ------------------------------------------------------------
-- Saldos por cuenta y moneda (entradas − salidas)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION tes_saldos()
RETURNS TABLE (cuenta_id UUID, moneda TEXT, saldo NUMERIC) AS $$
  WITH flujos AS (
    -- Entradas a la cuenta origen
    SELECT cuenta_id, moneda, monto AS delta FROM tes_movimientos WHERE tipo IN ('inicial', 'ingreso')
    UNION ALL
    -- Salidas de la cuenta origen
    SELECT cuenta_id, moneda, -monto FROM tes_movimientos WHERE tipo IN ('egreso', 'transferencia', 'cambio')
    UNION ALL
    -- Entradas a la cuenta destino
    SELECT cuenta_destino_id, moneda_destino, monto_destino FROM tes_movimientos WHERE tipo IN ('transferencia', 'cambio')
  )
  SELECT cuenta_id, moneda, COALESCE(SUM(delta), 0) AS saldo
  FROM flujos
  GROUP BY cuenta_id, moneda;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- Verificación
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM tes_categorias) AS categorias,
  (SELECT COUNT(*) FROM tes_cuentas)    AS cuentas;

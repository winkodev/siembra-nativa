-- ============================================================
-- SIEMBRA NATIVA CLUB - Franjas horarias de entrega
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- ABM de rangos horarios (ej: Sábados 09:00–18:00). El socio
-- elige una franja activa al confirmar el pedido; el pedido
-- guarda una FOTO del texto (entrega_franja) para que ediciones
-- o bajas posteriores no alteren pedidos históricos.
-- ============================================================

CREATE TABLE IF NOT EXISTS franjas_horarias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dia         TEXT NOT NULL,            -- ej: 'Sábados', 'Lunes a Viernes'
  hora_desde  TIME NOT NULL,
  hora_hasta  TIME NOT NULL,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (hora_hasta > hora_desde)
);

ALTER TABLE franjas_horarias ENABLE ROW LEVEL SECURITY;

-- Los socios ven solo las franjas activas (para elegir al pedir)
DROP POLICY IF EXISTS "autenticados_ven_franjas_activas" ON franjas_horarias;
CREATE POLICY "autenticados_ven_franjas_activas"
  ON franjas_horarias FOR SELECT
  USING (auth.role() = 'authenticated' AND activa = TRUE);

-- Admin: CRUD completo (incluye inactivas)
DROP POLICY IF EXISTS "admin_crud_franjas" ON franjas_horarias;
CREATE POLICY "admin_crud_franjas"
  ON franjas_horarias FOR ALL
  USING (get_my_role() = 'admin');

-- Foto del horario de entrega elegido al confirmar el pedido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS entrega_franja TEXT;

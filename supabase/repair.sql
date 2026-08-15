-- ============================================================
-- REPAIR: ejecutar si el schema.sql falló a mitad
-- Es seguro correr aunque ya existan algunas tablas
-- ============================================================

-- Tabla profiles (con todos los campos)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  rol             rol_usuario NOT NULL DEFAULT 'socio',
  estado          estado_usuario NOT NULL DEFAULT 'activo',
  fecha_alta      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email           TEXT,
  telefono        TEXT,
  dni             TEXT,
  fecha_nacimiento DATE,
  direccion       TEXT,
  localidad       TEXT,
  provincia       TEXT,
  codigo_postal   TEXT,
  reprocann_numero           TEXT,
  reprocann_categoria        reprocann_categoria,
  reprocann_estado           reprocann_estado NOT NULL DEFAULT 'pendiente',
  reprocann_vencimiento      DATE,
  reprocann_certificado_path TEXT,
  notas_admin     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Función updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at en profiles
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Función y trigger para crear perfil al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'socio')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Tabla geneticas
CREATE TABLE IF NOT EXISTS geneticas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  tipo        tipo_genetica NOT NULL,
  thc         NUMERIC(5,2),
  cbd         NUMERIC(5,2),
  descripcion TEXT,
  imagen_url  TEXT,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla stock
CREATE TABLE IF NOT EXISTS stock (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  genetica_id      UUID NOT NULL REFERENCES geneticas(id) ON DELETE CASCADE,
  cantidad_gramos  NUMERIC(10,2) NOT NULL CHECK (cantidad_gramos >= 0),
  ubicacion        TEXT,
  lote             TEXT,
  fecha_ingreso    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vista stock_publico
CREATE OR REPLACE VIEW stock_publico AS
  SELECT
    g.id          AS genetica_id,
    g.nombre,
    g.tipo,
    g.thc,
    g.cbd,
    g.descripcion,
    g.imagen_url,
    COALESCE(SUM(s.cantidad_gramos), 0) AS stock_total_gramos
  FROM geneticas g
  LEFT JOIN stock s ON s.genetica_id = g.id
  WHERE g.activa = TRUE
  GROUP BY g.id, g.nombre, g.tipo, g.thc, g.cbd, g.descripcion, g.imagen_url;

-- Tabla pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  estado      estado_pedido NOT NULL DEFAULT 'pendiente',
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla pedido_items
CREATE TABLE IF NOT EXISTS pedido_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id        UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  genetica_id      UUID NOT NULL REFERENCES geneticas(id) ON DELETE RESTRICT,
  cantidad_gramos  NUMERIC(10,2) NOT NULL CHECK (cantidad_gramos > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla newsletter
CREATE TABLE IF NOT EXISTS newsletter (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo             TEXT NOT NULL,
  contenido          TEXT NOT NULL,
  imagen_url         TEXT,
  publicado          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_publicacion  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  accion              TEXT NOT NULL,
  recurso             TEXT NOT NULL,
  socio_afectado_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata            JSONB,
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper de rol
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT rol::TEXT FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE geneticas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- Policies profiles
DROP POLICY IF EXISTS "socio_lee_propio_perfil" ON profiles;
CREATE POLICY "socio_lee_propio_perfil" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "socio_edita_propio_perfil" ON profiles;
CREATE POLICY "socio_edita_propio_perfil" ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "admin_lee_todos_perfiles" ON profiles;
CREATE POLICY "admin_lee_todos_perfiles" ON profiles FOR SELECT USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_actualiza_perfiles" ON profiles;
CREATE POLICY "admin_actualiza_perfiles" ON profiles FOR UPDATE USING (get_my_role() = 'admin');

-- Policies geneticas
DROP POLICY IF EXISTS "autenticados_ven_geneticas" ON geneticas;
CREATE POLICY "autenticados_ven_geneticas" ON geneticas FOR SELECT USING (auth.role() = 'authenticated' AND activa = TRUE);

DROP POLICY IF EXISTS "admin_crud_geneticas" ON geneticas;
CREATE POLICY "admin_crud_geneticas" ON geneticas FOR ALL USING (get_my_role() = 'admin');

-- Policies stock
DROP POLICY IF EXISTS "admin_crud_stock" ON stock;
CREATE POLICY "admin_crud_stock" ON stock FOR ALL USING (get_my_role() = 'admin');

-- Policies pedidos
DROP POLICY IF EXISTS "socio_ve_propios_pedidos" ON pedidos;
CREATE POLICY "socio_ve_propios_pedidos" ON pedidos FOR SELECT USING (socio_id = auth.uid());

DROP POLICY IF EXISTS "socio_crea_pedidos" ON pedidos;
CREATE POLICY "socio_crea_pedidos" ON pedidos FOR INSERT WITH CHECK (socio_id = auth.uid());

DROP POLICY IF EXISTS "admin_crud_pedidos" ON pedidos;
CREATE POLICY "admin_crud_pedidos" ON pedidos FOR ALL USING (get_my_role() = 'admin');

-- Policies pedido_items
DROP POLICY IF EXISTS "socio_ve_propios_items" ON pedido_items;
CREATE POLICY "socio_ve_propios_items" ON pedido_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM pedidos WHERE pedidos.id = pedido_items.pedido_id AND pedidos.socio_id = auth.uid())
);

DROP POLICY IF EXISTS "socio_crea_items" ON pedido_items;
CREATE POLICY "socio_crea_items" ON pedido_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM pedidos WHERE pedidos.id = pedido_items.pedido_id AND pedidos.socio_id = auth.uid())
);

DROP POLICY IF EXISTS "admin_crud_pedido_items" ON pedido_items;
CREATE POLICY "admin_crud_pedido_items" ON pedido_items FOR ALL USING (get_my_role() = 'admin');

-- Policies newsletter
DROP POLICY IF EXISTS "autenticados_ven_newsletter_publicado" ON newsletter;
CREATE POLICY "autenticados_ven_newsletter_publicado" ON newsletter FOR SELECT USING (auth.role() = 'authenticated' AND publicado = TRUE);

DROP POLICY IF EXISTS "admin_crud_newsletter" ON newsletter;
CREATE POLICY "admin_crud_newsletter" ON newsletter FOR ALL USING (get_my_role() = 'admin');

-- Policies audit_log
DROP POLICY IF EXISTS "admin_crud_audit_log" ON audit_log;
CREATE POLICY "admin_crud_audit_log" ON audit_log FOR ALL USING (get_my_role() = 'admin');

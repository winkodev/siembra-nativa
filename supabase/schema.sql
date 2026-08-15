-- ============================================================
-- SIEMBRA NATIVA CLUB - Esquema completo de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TIPOS ENUMERADOS
-- ============================================================
CREATE TYPE rol_usuario AS ENUM ('socio', 'admin');
CREATE TYPE estado_usuario AS ENUM ('activo', 'inactivo');
CREATE TYPE reprocann_categoria AS ENUM ('paciente_cultiva', 'tercero_cultivador', 'ong');
CREATE TYPE reprocann_estado AS ENUM ('pendiente', 'aprobado', 'rechazado', 'vencido');
CREATE TYPE tipo_genetica AS ENUM ('indica', 'sativa', 'hibrida');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'aprobado', 'entregado', 'cancelado');

-- ============================================================
-- TABLA: profiles
-- Extiende auth.users con datos del club
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  rol             rol_usuario NOT NULL DEFAULT 'socio',
  estado          estado_usuario NOT NULL DEFAULT 'activo',
  fecha_alta      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Datos de contacto
  email           TEXT,
  telefono        TEXT,
  dni             TEXT,
  fecha_nacimiento DATE,

  -- Dirección
  direccion       TEXT,
  localidad       TEXT,
  provincia       TEXT,
  codigo_postal   TEXT,

  -- Datos REPROCANN (datos sensibles de salud - Ley 25.326)
  reprocann_numero           TEXT,
  reprocann_categoria        reprocann_categoria,
  reprocann_estado           reprocann_estado NOT NULL DEFAULT 'pendiente',
  reprocann_vencimiento      DATE,
  reprocann_certificado_path TEXT, -- Ruta en storage privado, nunca URL directa

  -- Notas internas (solo visibles para admin)
  notas_admin     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'socio')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLA: geneticas
-- Catálogo de variedades disponibles
-- ============================================================
CREATE TABLE geneticas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  tipo        tipo_genetica NOT NULL,
  thc         NUMERIC(5,2), -- porcentaje, ej: 22.50
  cbd         NUMERIC(5,2),
  descripcion TEXT,
  imagen_url  TEXT,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER geneticas_updated_at
  BEFORE UPDATE ON geneticas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLA: stock
-- Inventario por lote y ubicación (solo visible para admin)
-- ============================================================
CREATE TABLE stock (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  genetica_id      UUID NOT NULL REFERENCES geneticas(id) ON DELETE CASCADE,
  cantidad_gramos  NUMERIC(10,2) NOT NULL CHECK (cantidad_gramos >= 0),
  ubicacion        TEXT,       -- bodega/sector, visible solo para admin
  lote             TEXT,
  fecha_ingreso    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vista pública de stock (suma por genética, sin ubicación ni lote)
-- Los socios SOLO ven esta vista
CREATE VIEW stock_publico AS
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

-- ============================================================
-- TABLA: pedidos
-- Cabecera del pedido. Pago es EXTERNO - solo se gestiona estado.
-- Preparado para futura integración con pasarela de pago:
-- agregar columna pago_id, pago_estado, pago_monto sin romper este flujo.
-- ============================================================
CREATE TABLE pedidos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  socio_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  estado      estado_pedido NOT NULL DEFAULT 'pendiente',
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notas       TEXT,
  -- Hook para futura pasarela (Mercado Pago u otro):
  -- pago_referencia_externa TEXT,
  -- pago_estado TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLA: pedido_items
-- Detalle de cada pedido
-- ============================================================
CREATE TABLE pedido_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id        UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  genetica_id      UUID NOT NULL REFERENCES geneticas(id) ON DELETE RESTRICT,
  cantidad_gramos  NUMERIC(10,2) NOT NULL CHECK (cantidad_gramos > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCIÓN: descontar stock al aprobar pedido
-- Descuenta de los lotes más antiguos primero (FIFO)
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
  restante NUMERIC;
  lote_row RECORD;
BEGIN
  FOR item IN
    SELECT genetica_id, cantidad_gramos FROM pedido_items WHERE pedido_id = p_pedido_id
  LOOP
    restante := item.cantidad_gramos;

    FOR lote_row IN
      SELECT id, cantidad_gramos FROM stock
      WHERE genetica_id = item.genetica_id AND cantidad_gramos > 0
      ORDER BY fecha_ingreso ASC
      FOR UPDATE
    LOOP
      EXIT WHEN restante <= 0;

      IF lote_row.cantidad_gramos >= restante THEN
        UPDATE stock SET cantidad_gramos = cantidad_gramos - restante WHERE id = lote_row.id;
        restante := 0;
      ELSE
        restante := restante - lote_row.cantidad_gramos;
        UPDATE stock SET cantidad_gramos = 0 WHERE id = lote_row.id;
      END IF;
    END LOOP;

    IF restante > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para genética %', item.genetica_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TABLA: newsletter
-- ============================================================
CREATE TABLE newsletter (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo             TEXT NOT NULL,
  contenido          TEXT NOT NULL, -- Markdown
  imagen_url         TEXT,
  publicado          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_publicacion  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER newsletter_updated_at
  BEFORE UPDATE ON newsletter
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLA: audit_log
-- Registro de accesos a documentos sensibles (Ley 25.326)
-- ============================================================
CREATE TABLE audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  accion              TEXT NOT NULL,  -- ej: 'ver_certificado', 'aprobar_reprocann'
  recurso             TEXT NOT NULL,  -- ej: 'reprocann_certificado'
  socio_afectado_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata            JSONB,          -- datos adicionales opcionales
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por admin y por socio afectado
CREATE INDEX audit_log_admin_idx ON audit_log(admin_id);
CREATE INDEX audit_log_socio_idx ON audit_log(socio_afectado_id);
CREATE INDEX audit_log_fecha_idx ON audit_log(fecha DESC);

-- ============================================================
-- FUNCIÓN: verificar REPROCANN vencido automáticamente
-- Llamar con un cron job (Supabase pg_cron o Edge Function)
-- ============================================================
CREATE OR REPLACE FUNCTION marcar_reprocann_vencidos()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reprocann_estado = 'vencido'
  WHERE reprocann_estado = 'aprobado'
    AND reprocann_vencimiento IS NOT NULL
    AND reprocann_vencimiento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VISTA: socios con REPROCANN por vencer (próximos 30 días)
-- ============================================================
CREATE VIEW reprocann_por_vencer AS
  SELECT
    id,
    nombre,
    reprocann_numero,
    reprocann_estado,
    reprocann_vencimiento,
    (reprocann_vencimiento - CURRENT_DATE) AS dias_restantes
  FROM profiles
  WHERE
    rol = 'socio'
    AND reprocann_estado = 'aprobado'
    AND reprocann_vencimiento IS NOT NULL
    AND reprocann_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days');

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE geneticas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- Helper: obtener rol del usuario actual
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT rol::TEXT FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -------------------------------------------------------
-- POLICIES: profiles
-- -------------------------------------------------------

-- Socio: solo lee y edita su propio perfil
CREATE POLICY "socio_lee_propio_perfil"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "socio_edita_propio_perfil"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- El socio NO puede cambiar su propio rol ni estado
    AND rol = (SELECT rol FROM profiles WHERE id = auth.uid())
    AND estado = (SELECT estado FROM profiles WHERE id = auth.uid())
  );

-- Admin: lee todos los perfiles
CREATE POLICY "admin_lee_todos_perfiles"
  ON profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- Admin: puede actualizar cualquier perfil (para aprobar REPROCANN, etc.)
CREATE POLICY "admin_actualiza_perfiles"
  ON profiles FOR UPDATE
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: geneticas
-- -------------------------------------------------------

-- Todos los autenticados ven genéticas activas
CREATE POLICY "autenticados_ven_geneticas"
  ON geneticas FOR SELECT
  USING (auth.role() = 'authenticated' AND activa = TRUE);

-- Admin: CRUD completo
CREATE POLICY "admin_crud_geneticas"
  ON geneticas FOR ALL
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: stock
-- -------------------------------------------------------

-- Socios NO ven la tabla stock directamente (usan la vista stock_publico)
-- Solo admin tiene acceso
CREATE POLICY "admin_crud_stock"
  ON stock FOR ALL
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: pedidos
-- -------------------------------------------------------

-- Socio: ve solo sus pedidos
CREATE POLICY "socio_ve_propios_pedidos"
  ON pedidos FOR SELECT
  USING (socio_id = auth.uid());

-- Socio: puede crear pedidos (control REPROCANN en lógica de app)
CREATE POLICY "socio_crea_pedidos"
  ON pedidos FOR INSERT
  WITH CHECK (socio_id = auth.uid());

-- Admin: ve y gestiona todos los pedidos
CREATE POLICY "admin_crud_pedidos"
  ON pedidos FOR ALL
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: pedido_items
-- -------------------------------------------------------

-- Socio: ve items de sus propios pedidos
CREATE POLICY "socio_ve_propios_items"
  ON pedido_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = pedido_items.pedido_id
        AND pedidos.socio_id = auth.uid()
    )
  );

CREATE POLICY "socio_crea_items"
  ON pedido_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = pedido_items.pedido_id
        AND pedidos.socio_id = auth.uid()
    )
  );

CREATE POLICY "admin_crud_pedido_items"
  ON pedido_items FOR ALL
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: newsletter
-- -------------------------------------------------------

-- Todos los autenticados ven newsletters publicados
CREATE POLICY "autenticados_ven_newsletter_publicado"
  ON newsletter FOR SELECT
  USING (auth.role() = 'authenticated' AND publicado = TRUE);

-- Admin: CRUD completo (incluyendo borradores)
CREATE POLICY "admin_crud_newsletter"
  ON newsletter FOR ALL
  USING (get_my_role() = 'admin');

-- -------------------------------------------------------
-- POLICIES: audit_log
-- -------------------------------------------------------

-- Solo admin puede leer/insertar el log de auditoría
CREATE POLICY "admin_crud_audit_log"
  ON audit_log FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- STORAGE: bucket privado para certificados REPROCANN
-- Ejecutar en Supabase Dashboard → Storage → New bucket
-- O vía API con service_role key:
-- ============================================================

-- NOTA: El bucket se crea desde el Dashboard de Supabase o con:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('certificados-reprocann', 'certificados-reprocann', FALSE);
-- FALSE = privado, nunca acceso público directo

-- Policy de storage: socio solo puede subir/ver su propio certificado
-- Admin puede ver cualquier certificado
-- Las URLs se generan como signed URLs de corta duración (ver lib/supabase)

-- En Supabase Dashboard → Storage → certificados-reprocann → Policies:

-- INSERT policy (socio sube su propio certificado):
-- ((bucket_id = 'certificados-reprocann') AND (auth.uid()::text = (storage.foldername(name))[1]))

-- SELECT policy (socio ve su propio certificado):
-- ((bucket_id = 'certificados-reprocann') AND (auth.uid()::text = (storage.foldername(name))[1]))

-- SELECT policy (admin ve todos):
-- ((bucket_id = 'certificados-reprocann') AND (get_my_role() = 'admin'))

-- DELETE policy (admin puede eliminar):
-- ((bucket_id = 'certificados-reprocann') AND (get_my_role() = 'admin'))

-- ============================================================
-- DATOS INICIALES: crear primer admin
-- Ejecutar DESPUÉS de registrarte en la app con tu email:
-- ============================================================

-- UPDATE profiles SET rol = 'admin' WHERE id = 'TU_USER_ID_AQUI';

-- ============================================================
-- CRON JOB: marcar REPROCANN vencidos (opcional, requiere pg_cron)
-- ============================================================
-- SELECT cron.schedule('marcar-reprocann-vencidos', '0 0 * * *', 'SELECT marcar_reprocann_vencidos()');

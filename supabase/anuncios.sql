-- ============================================================
-- SIEMBRA NATIVA CLUB - Anuncios (popup a los socios)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Un anuncio es un mensaje del club que le aparece al socio como popup
-- al entrar, una sola vez (queda registrado en anuncios_vistos), y además
-- llega a su campana de notificaciones. Lo publican los admins.
-- ============================================================

CREATE TABLE IF NOT EXISTS anuncios (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo         TEXT NOT NULL,
  mensaje        TEXT NOT NULL,
  -- activos: todos los socios activos · tienda: solo los que tienen la tienda habilitada
  destinatarios  TEXT NOT NULL DEFAULT 'activos' CHECK (destinatarios IN ('activos', 'tienda')),
  -- Último día en que se muestra (NULL = sin vencimiento)
  vigente_hasta  DATE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anuncios_vistos (
  anuncio_id UUID NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  socio_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visto_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (anuncio_id, socio_id)
);

ALTER TABLE anuncios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios_vistos ENABLE ROW LEVEL SECURITY;

-- Anuncios: los leen todos los logueados (el socio filtra los suyos); los escribe el admin
DROP POLICY IF EXISTS "anuncios_lectura" ON anuncios;
CREATE POLICY "anuncios_lectura" ON anuncios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "anuncios_admin" ON anuncios;
CREATE POLICY "anuncios_admin" ON anuncios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));

-- Vistos: el socio registra y lee los propios; el admin lee todos (para el conteo)
DROP POLICY IF EXISTS "anuncios_vistos_propios" ON anuncios_vistos;
CREATE POLICY "anuncios_vistos_propios" ON anuncios_vistos FOR ALL
  USING (socio_id = auth.uid()) WITH CHECK (socio_id = auth.uid());
DROP POLICY IF EXISTS "anuncios_vistos_admin" ON anuncios_vistos;
CREATE POLICY "anuncios_vistos_admin" ON anuncios_vistos FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- Verificación
-- ============================================================
SELECT (SELECT COUNT(*) FROM anuncios) AS anuncios, (SELECT COUNT(*) FROM anuncios_vistos) AS vistos;

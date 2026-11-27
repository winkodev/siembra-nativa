-- ============================================================
-- SIEMBRA NATIVA CLUB - Newsletter: encuadre de la imagen, lecturas,
-- novedades fijadas y fecha de vencimiento
-- Ejecutar en: Supabase Dashboard → SQL Editor (se puede repetir)
-- Compatible con la versión publicada: solo agrega.
-- ============================================================

-- Punto de la imagen que queda a la vista en la tarjeta (0 a 100, 50 = centro)
ALTER TABLE newsletter
  ADD COLUMN IF NOT EXISTS imagen_pos_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_pos_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS imagen_pos_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (imagen_pos_y BETWEEN 0 AND 100);

-- Fijada: queda primera aunque haya otras más nuevas.
-- vigente_hasta: último día en que se muestra (NULL = siempre)
ALTER TABLE newsletter
  ADD COLUMN IF NOT EXISTS fijada        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vigente_hasta DATE;

-- Qué socio abrió cada novedad (una vez por socio)
CREATE TABLE IF NOT EXISTS newsletter_vistos (
  newsletter_id UUID NOT NULL REFERENCES newsletter(id) ON DELETE CASCADE,
  socio_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visto_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (newsletter_id, socio_id)
);

ALTER TABLE newsletter_vistos ENABLE ROW LEVEL SECURITY;

-- El socio registra y lee las propias; el admin lee todas (para el conteo)
DROP POLICY IF EXISTS "newsletter_vistos_propios" ON newsletter_vistos;
CREATE POLICY "newsletter_vistos_propios" ON newsletter_vistos FOR ALL
  USING (socio_id = auth.uid()) WITH CHECK (socio_id = auth.uid());
DROP POLICY IF EXISTS "newsletter_vistos_admin" ON newsletter_vistos;
CREATE POLICY "newsletter_vistos_admin" ON newsletter_vistos FOR SELECT
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT (SELECT COUNT(*) FROM newsletter WHERE publicado) AS publicadas,
       (SELECT COUNT(*) FROM newsletter_vistos) AS lecturas;

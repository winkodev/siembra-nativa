-- ============================================================
-- Módulo de productos + ubicaciones
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Función updated_at (safe re-run)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── PRODUCTOS ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE categoria_producto AS ENUM ('aceite', 'merchandising', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.productos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  categoria   categoria_producto NOT NULL DEFAULT 'otro',
  precio      NUMERIC(10, 2),
  imagen_url  TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_productos
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_ver_productos"  ON public.productos;
DROP POLICY IF EXISTS "admin_full_productos"  ON public.productos;

CREATE POLICY "socios_ver_productos"
  ON public.productos FOR SELECT
  USING (activo = true);

CREATE POLICY "admin_full_productos"
  ON public.productos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Bucket imágenes productos (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_upload_productos" ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_productos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_productos"  ON storage.objects;

CREATE POLICY "admin_upload_productos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'productos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "admin_delete_productos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'productos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "public_read_productos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos');

-- ── UBICACIONES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ubicaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activa      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER set_updated_at_ubicaciones
  BEFORE UPDATE ON public.ubicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_ubicaciones" ON public.ubicaciones;

CREATE POLICY "admin_full_ubicaciones"
  ON public.ubicaciones FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Seed con valores comunes
INSERT INTO public.ubicaciones (nombre) VALUES
  ('Depósito principal'),
  ('Heladera'),
  ('Estante A'),
  ('Estante B')
ON CONFLICT (nombre) DO NOTHING;

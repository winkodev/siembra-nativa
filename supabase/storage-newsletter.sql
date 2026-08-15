-- ============================================================
-- Bucket PÚBLICO para imágenes de portada del newsletter
-- Ejecutar en Supabase SQL Editor
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter',
  'newsletter',
  TRUE,           -- público: las portadas son contenido publicado
  5242880,        -- 5MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Solo admin puede subir/editar/eliminar portadas
DROP POLICY IF EXISTS "admin_sube_portadas_newsletter" ON storage.objects;
CREATE POLICY "admin_sube_portadas_newsletter"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'newsletter'
  AND get_my_role() = 'admin'
);

DROP POLICY IF EXISTS "admin_actualiza_portadas_newsletter" ON storage.objects;
CREATE POLICY "admin_actualiza_portadas_newsletter"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'newsletter'
  AND get_my_role() = 'admin'
);

DROP POLICY IF EXISTS "admin_elimina_portadas_newsletter" ON storage.objects;
CREATE POLICY "admin_elimina_portadas_newsletter"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'newsletter'
  AND get_my_role() = 'admin'
);

-- Todos pueden ver las portadas (bucket público)
DROP POLICY IF EXISTS "publico_ve_portadas_newsletter" ON storage.objects;
CREATE POLICY "publico_ve_portadas_newsletter"
ON storage.objects FOR SELECT
USING (bucket_id = 'newsletter');

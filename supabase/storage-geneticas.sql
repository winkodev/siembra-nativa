-- ============================================================
-- Bucket PÚBLICO para imágenes de genéticas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'geneticas-imagenes',
  'geneticas-imagenes',
  TRUE,           -- público: las imágenes son visibles para todos
  5242880,        -- 5MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Solo admin puede subir/editar/eliminar imágenes
CREATE POLICY "admin_sube_imagenes_geneticas"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'geneticas-imagenes'
  AND get_my_role() = 'admin'
);

CREATE POLICY "admin_actualiza_imagenes_geneticas"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'geneticas-imagenes'
  AND get_my_role() = 'admin'
);

CREATE POLICY "admin_elimina_imagenes_geneticas"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'geneticas-imagenes'
  AND get_my_role() = 'admin'
);

-- Todos pueden ver las imágenes (bucket público)
CREATE POLICY "publico_ve_imagenes_geneticas"
ON storage.objects FOR SELECT
USING (bucket_id = 'geneticas-imagenes');

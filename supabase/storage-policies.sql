-- ============================================================
-- STORAGE POLICIES - Bucket: certificados-reprocann
-- Ejecutar DESPUÉS de crear el bucket en el Dashboard
-- ============================================================

-- Crear el bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados-reprocann',
  'certificados-reprocann',
  FALSE,          -- PRIVADO: nunca acceso público
  10485760,       -- 10MB máximo por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------
-- Policy: socio puede subir su propio certificado
-- Estructura de path: {user_id}/{filename}
-- -------------------------------------------------------
CREATE POLICY "socio_sube_certificado"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certificados-reprocann'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- -------------------------------------------------------
-- Policy: socio puede ver su propio certificado
-- -------------------------------------------------------
CREATE POLICY "socio_ve_propio_certificado"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certificados-reprocann'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- -------------------------------------------------------
-- Policy: socio puede actualizar su propio certificado
-- -------------------------------------------------------
CREATE POLICY "socio_actualiza_certificado"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'certificados-reprocann'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- -------------------------------------------------------
-- Policy: admin puede ver TODOS los certificados
-- -------------------------------------------------------
CREATE POLICY "admin_ve_todos_certificados"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certificados-reprocann'
  AND get_my_role() = 'admin'
);

-- -------------------------------------------------------
-- Policy: admin puede eliminar certificados
-- -------------------------------------------------------
CREATE POLICY "admin_elimina_certificados"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'certificados-reprocann'
  AND get_my_role() = 'admin'
);

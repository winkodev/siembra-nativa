-- ============================================================
-- SIEMBRA NATIVA CLUB - Secretos de la app
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Credenciales que el superadmin carga desde Configuración → Avisos
-- (usuario y contraseña de aplicación de Gmail, clave de Resend) para
-- no depender de las variables de entorno del servidor.
-- SIN políticas de lectura: ningún usuario logueado puede leer esta
-- tabla, solo el servidor con el service role. La app nunca devuelve
-- el valor al navegador, solo si está cargado o no.
-- ============================================================

CREATE TABLE IF NOT EXISTS secretos_app (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE secretos_app ENABLE ROW LEVEL SECURITY;
-- (sin CREATE POLICY a propósito: RLS activo y sin políticas = nadie salvo service role)

-- ============================================================
-- Verificación
-- ============================================================
SELECT COUNT(*) AS secretos FROM secretos_app;

-- ============================================================
-- Configuración global de la app
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracion_app (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  descripcion TEXT
);

-- Solo admins pueden modificar
ALTER TABLE public.configuracion_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_config" ON public.configuracion_app;
CREATE POLICY "admin_full_config"
  ON public.configuracion_app FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Todos los usuarios autenticados pueden leer la config:
-- getAppConfig() corre con la sesión del socio (límite de gramos, stock mínimo).
-- Sin esta política, los socios leen [] y la app cae a defaults hardcodeados.
DROP POLICY IF EXISTS "config_lectura_autenticados" ON public.configuracion_app;
CREATE POLICY "config_lectura_autenticados"
  ON public.configuracion_app FOR SELECT
  TO authenticated
  USING (true);

-- Valores por defecto
INSERT INTO public.configuracion_app (clave, valor, descripcion) VALUES
  ('stock_minimo_visible', '100',  'Gramos mínimos de stock para que una genética aparezca en el catálogo'),
  ('max_gramos_pedido',    '40',   'Máximo de gramos que un socio puede pedir en un solo pedido')
ON CONFLICT (clave) DO NOTHING;

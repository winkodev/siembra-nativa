-- Fix: el trigger necesita permiso para insertar perfiles nuevos

-- 1. Recrear la función con search_path explícito (requerido en Supabase)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    'socio'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Policy que permite al trigger insertar el perfil propio al registrarse
DROP POLICY IF EXISTS "insertar_propio_perfil" ON public.profiles;
CREATE POLICY "insertar_propio_perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

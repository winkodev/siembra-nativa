-- ============================================================
-- SIEMBRA NATIVA CLUB - Flag superadmin
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Distingue al superadmin de los admins comunes SIN tocar el rol
-- ni las políticas RLS (que dependen de rol = 'admin').
-- Hoy lo usa: editar/eliminar ingresos de stock (solo superadmin).
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS superadmin BOOLEAN NOT NULL DEFAULT false;

-- Asignar el superadmin: la cuenta principal del club
UPDATE profiles SET superadmin = true WHERE email = 'siembranativaltda@gmail.com';

-- Verificación: debe listar exactamente a los superadmins asignados
SELECT id, nombre, email, rol, superadmin FROM profiles WHERE superadmin = true;

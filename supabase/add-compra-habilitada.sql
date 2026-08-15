-- Agrega el campo compra_habilitada a profiles
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS compra_habilitada BOOLEAN NOT NULL DEFAULT false;

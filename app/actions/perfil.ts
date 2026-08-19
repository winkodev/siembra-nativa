'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/types/database';

const perfilSchema = z.object({
  nombre:          z.string().min(2, 'El nombre es requerido'),
  email:           z.string().email('Email inválido').optional().or(z.literal('')),
  telefono:        z.string().optional(),
  dni:             z.string().optional(),
  fecha_nacimiento: z.string().optional(),
  direccion:       z.string().optional(),
  piso_depto:      z.string().optional(),
  localidad:       z.string().optional(),
  provincia:       z.string().optional(),
  codigo_postal:   z.string().optional(),
  // Datos de validación de la dirección (Georef)
  latitud:               z.string().optional(),
  longitud:              z.string().optional(),
  direccion_normalizada: z.string().optional(),
});

export async function guardarPerfil(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const raw = Object.fromEntries(formData);
  const parsed = perfilSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  // Limpiar campos vacíos → null
  const { latitud, longitud, direccion_normalizada, ...resto } = parsed.data;
  const datos: Record<string, unknown> = Object.fromEntries(
    Object.entries(resto).map(([k, v]) => [k, v === '' ? null : v])
  );

  // La dirección solo se marca como validada si vino del autocompletado
  const validada = Boolean(direccion_normalizada && latitud && longitud);
  datos.latitud               = validada ? parseFloat(latitud!) : null;
  datos.longitud              = validada ? parseFloat(longitud!) : null;
  datos.direccion_normalizada = validada ? direccion_normalizada : null;
  datos.direccion_validada_at = validada ? new Date().toISOString() : null;

  const { error } = await supabase
    .from('profiles')
    .update(datos)
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Error al guardar los datos' };
  return { ok: true, data: undefined };
}

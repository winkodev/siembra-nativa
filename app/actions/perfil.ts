'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResponse } from '@/lib/types/database';

// Registra la aceptación de los Términos y Condiciones del socio.
// Idempotente: si ya estaban aceptados, no pisa la fecha original.
export async function aceptarTerminos(): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('profiles')
    .update({ terminos_aceptados_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('terminos_aceptados_at', null);

  if (error) return { ok: false, error: 'Error al registrar la aceptación' };

  // La notificación "Aceptá los términos" deja de tener sentido
  await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('socio_id', user.id)
    .eq('tipo', 'terminos')
    .eq('leida', false);

  revalidatePath('/socio/dashboard');
  revalidatePath('/socio/perfil');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

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

  // Invalida el caché del Inicio: sin esto el banner "completá tu DNI y
  // teléfono" seguía mostrándose con los datos ya guardados
  revalidatePath('/socio/dashboard');
  revalidatePath('/socio/perfil');
  return { ok: true, data: undefined };
}

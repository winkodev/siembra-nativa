'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Tarea, RecurrenciaTarea } from '@/lib/types/database';

// Gestión es solo del superadmin (la RLS también lo exige)
async function superadmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  return data?.rol === 'admin' && data.superadmin ? { supabase, userId: user.id } : null;
}
const NO_AUTORIZADO = { ok: false as const, error: 'Solo el superadmin puede usar Gestión' };

function fechaValida(f: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(f);
}

// Próxima fecha de una tarea repetitiva: mismo día del mes/año siguiente
// (si el mes no tiene ese día, cae en el último día: 31/01 → 28/02)
function siguienteVencimiento(fecha: string, recurrencia: RecurrenciaTarea): string | null {
  if (recurrencia === 'ninguna') return null;
  const [y, m, d] = fecha.split('-').map(Number);
  const base = recurrencia === 'mensual' ? new Date(y, m, 1) : new Date(y + 1, m - 1, 1);
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimo);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export async function crearTarea(input: { titulo: string; notas?: string; vence_at: string; recurrencia: RecurrenciaTarea }): Promise<ActionResponse<Tarea>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: 'Poné un título' };
  if (!fechaValida(input.vence_at)) return { ok: false, error: 'Fecha inválida' };

  const { data, error } = await s.supabase.from('tareas').insert({
    titulo, notas: input.notas?.trim() || null, vence_at: input.vence_at, recurrencia: input.recurrencia,
    serie_id: input.recurrencia !== 'ninguna' ? crypto.randomUUID() : null, created_by: s.userId,
  }).select('*').single();
  if (error || !data) return { ok: false, error: 'Error al crear la tarea. ¿Se ejecutó gestion-tareas.sql?' };

  await registrarAccion(s.supabase, 'tarea_crear', 'gestion', { titulo, vence_at: input.vence_at, recurrencia: input.recurrencia });
  revalidatePath('/admin/gestion');
  revalidatePath('/admin/dashboard');
  return { ok: true, data };
}

export async function editarTarea(id: string, input: { titulo: string; notas?: string; vence_at: string; recurrencia: RecurrenciaTarea }): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: 'Poné un título' };
  if (!fechaValida(input.vence_at)) return { ok: false, error: 'Fecha inválida' };

  const { data: actual } = await s.supabase.from('tareas').select('serie_id, recurrencia').eq('id', id).single();
  if (!actual) return { ok: false, error: 'Tarea no encontrada' };
  // Si pasa a repetitiva y no tenía serie, se le crea una
  const serie_id = input.recurrencia === 'ninguna' ? null : (actual.serie_id ?? crypto.randomUUID());

  const { error } = await s.supabase.from('tareas')
    .update({ titulo, notas: input.notas?.trim() || null, vence_at: input.vence_at, recurrencia: input.recurrencia, serie_id })
    .eq('id', id);
  if (error) return { ok: false, error: 'Error al editar la tarea' };

  await registrarAccion(s.supabase, 'tarea_editar', 'gestion', { titulo });
  revalidatePath('/admin/gestion');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}

// Marcar hecha. Si es repetitiva, crea la siguiente ocurrencia (si no existe ya una pendiente de la serie).
export async function completarTarea(id: string): Promise<ActionResponse<{ siguiente: Tarea | null }>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { data: t } = await s.supabase.from('tareas').select('*').eq('id', id).single();
  if (!t) return { ok: false, error: 'Tarea no encontrada' };
  if (t.hecha_at) return { ok: true, data: { siguiente: null } };

  const { error } = await s.supabase.from('tareas').update({ hecha_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: 'Error al marcar la tarea' };

  let siguiente: Tarea | null = null;
  const prox = siguienteVencimiento(t.vence_at, t.recurrencia);
  if (prox && t.serie_id) {
    const { data: yaHay } = await s.supabase.from('tareas').select('id').eq('serie_id', t.serie_id).is('hecha_at', null).limit(1);
    if (!yaHay || yaHay.length === 0) {
      const { data: nueva } = await s.supabase.from('tareas').insert({
        titulo: t.titulo, notas: t.notas, vence_at: prox, recurrencia: t.recurrencia, serie_id: t.serie_id, created_by: s.userId,
      }).select('*').single();
      siguiente = nueva ?? null;
    }
  }

  await registrarAccion(s.supabase, 'tarea_hecha', 'gestion', { titulo: t.titulo, vence_at: t.vence_at, siguiente: prox });
  revalidatePath('/admin/gestion');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: { siguiente } };
}

export async function reabrirTarea(id: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.from('tareas').update({ hecha_at: null }).eq('id', id);
  if (error) return { ok: false, error: 'Error al reabrir la tarea' };
  revalidatePath('/admin/gestion');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}

// Eliminar una tarea; con `serie` también borra las ocurrencias pendientes de la misma serie
export async function eliminarTarea(id: string, serie = false): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { data: t } = await s.supabase.from('tareas').select('titulo, serie_id').eq('id', id).single();
  if (!t) return { ok: false, error: 'Tarea no encontrada' };

  const q = serie && t.serie_id
    ? s.supabase.from('tareas').delete().eq('serie_id', t.serie_id).is('hecha_at', null)
    : s.supabase.from('tareas').delete().eq('id', id);
  const { error } = await q;
  if (error) return { ok: false, error: 'Error al eliminar la tarea' };

  await registrarAccion(s.supabase, 'tarea_eliminar', 'gestion', { titulo: t.titulo, serie });
  revalidatePath('/admin/gestion');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}

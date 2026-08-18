'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResponse } from '@/lib/types/database';

// Marca como leídas todas las notificaciones del socio actual
export async function marcarNotificacionesLeidas(): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('socio_id', user.id)
    .eq('leida', false);

  if (error) return { ok: false, error: 'Error al actualizar las notificaciones' };

  revalidatePath('/socio/dashboard');
  return { ok: true, data: undefined };
}

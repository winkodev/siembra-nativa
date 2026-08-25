'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, TipoConsulta } from '@/lib/types/database';

const TIPOS_VALIDOS: TipoConsulta[] = ['general', 'pedidos', 'reprocann', 'pagos'];

// Socio: dejar una consulta para que el club lo contacte
export async function crearConsulta(
  tipo: TipoConsulta,
  mensaje: string
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const texto = mensaje.trim();
  if (!texto) return { ok: false, error: 'Escribí tu consulta' };
  if (texto.length > 2000) return { ok: false, error: 'La consulta es demasiado larga (máx. 2000 caracteres)' };
  if (!TIPOS_VALIDOS.includes(tipo)) return { ok: false, error: 'Tipo de consulta inválido' };

  // Freno anti-spam: máximo 5 consultas pendientes por socio
  const { count } = await supabase
    .from('consultas')
    .select('id', { count: 'exact', head: true })
    .eq('socio_id', user.id)
    .eq('estado', 'pendiente');
  if ((count ?? 0) >= 5) {
    return { ok: false, error: 'Ya tenés 5 consultas pendientes. Esperá a que te contactemos.' };
  }

  const { error } = await supabase
    .from('consultas')
    .insert({ socio_id: user.id, tipo, mensaje: texto });

  if (error) return { ok: false, error: 'Error al enviar la consulta' };

  revalidatePath('/socio/consultas');
  return { ok: true, data: undefined };
}

// Admin: responder (texto breve opcional) y marcar atendida
export async function atenderConsulta(
  consultaId: string,
  respuesta: string
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { data: perfil } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (perfil?.rol !== 'admin') return { ok: false, error: 'No autorizado' };

  const texto = respuesta.trim() || null;

  const { data: consulta, error } = await supabase
    .from('consultas')
    .update({
      estado: 'atendida',
      respuesta: texto,
      atendida_por: user.id,
      atendida_at: new Date().toISOString(),
    })
    .eq('id', consultaId)
    .eq('estado', 'pendiente') // no pisar una ya atendida por otro admin
    .select('socio_id')
    .single();

  if (error || !consulta) return { ok: false, error: 'La consulta no existe o ya fue atendida' };

  // Notificación in-app para el socio
  await supabase.from('notificaciones').insert({
    socio_id: consulta.socio_id,
    tipo: 'consulta',
    titulo: 'Tu consulta fue atendida',
    mensaje: texto ?? 'El equipo del club va a contactarte a la brevedad.',
  });

  await registrarAccion(supabase, 'atender_consulta', 'consultas', { consulta_id: consultaId }, consulta.socio_id);
  revalidatePath('/admin/consultas');
  revalidatePath('/socio/consultas');
  return { ok: true, data: undefined };
}

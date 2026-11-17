'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Anuncio } from '@/lib/types/database';

// Verifica que quien ejecuta sea admin y devuelve su ID
async function verificarAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return data?.rol === 'admin' ? user.id : null;
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

// Publicar un anuncio: queda activo para el popup y además llega a la campana
// de cada socio destinatario.
export async function crearAnuncio(input: {
  titulo: string; mensaje: string; destinatarios: 'activos' | 'tienda'; vigente_hasta?: string | null;
}): Promise<ActionResponse<{ anuncio: Anuncio; notificados: number }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const titulo = input.titulo.trim();
  const mensaje = input.mensaje.trim();
  if (!titulo) return { ok: false, error: 'Poné un título' };
  if (!mensaje) return { ok: false, error: 'Escribí el mensaje' };
  if (mensaje.length > 2000) return { ok: false, error: 'El mensaje es demasiado largo (máx. 2000 caracteres)' };
  const vigente = input.vigente_hasta && /^\d{4}-\d{2}-\d{2}$/.test(input.vigente_hasta) ? input.vigente_hasta : null;
  if (vigente && vigente < hoyISO()) return { ok: false, error: 'La fecha "hasta" ya pasó' };

  const service = createServiceClient();
  const { data: anuncio, error } = await service.from('anuncios').insert({
    titulo, mensaje, destinatarios: input.destinatarios, vigente_hasta: vigente, created_by: adminId,
  }).select('*').single();
  if (error || !anuncio) return { ok: false, error: 'Error al publicar. ¿Se ejecutó anuncios.sql en Supabase?' };

  // Copia en la campana de cada destinatario
  let q = service.from('profiles').select('id').eq('rol', 'socio').eq('estado', 'activo');
  if (input.destinatarios === 'tienda') q = q.eq('compra_habilitada', true);
  const { data: socios } = await q;
  if (socios && socios.length > 0) {
    await service.from('notificaciones').insert(socios.map(s => ({ socio_id: s.id, titulo, mensaje })));
  }

  await registrarAccion(createClient(), 'crear_anuncio', 'anuncios', { titulo, destinatarios: input.destinatarios, vigente_hasta: vigente, socios: socios?.length ?? 0 });
  revalidatePath('/admin/newsletter/anuncios');
  return { ok: true, data: { anuncio: anuncio as Anuncio, notificados: socios?.length ?? 0 } };
}

export async function toggleAnuncio(id: string, activo: boolean): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };
  const { error } = await createServiceClient().from('anuncios').update({ activo }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar el anuncio' };
  await registrarAccion(createClient(), activo ? 'activar_anuncio' : 'desactivar_anuncio', 'anuncios', { anuncio_id: id });
  revalidatePath('/admin/newsletter/anuncios');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Socio
// ------------------------------------------------------------

// Anuncios vigentes que el socio todavía no vio (más viejos primero)
export async function misAnunciosPendientes(): Promise<ActionResponse<Anuncio[]>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const [{ data: perfil }, { data: anuncios }, { data: vistos }] = await Promise.all([
    supabase.from('profiles').select('compra_habilitada, created_at').eq('id', user.id).single(),
    supabase.from('anuncios').select('*').eq('activo', true)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoyISO()}`)
      .order('created_at', { ascending: true }),
    supabase.from('anuncios_vistos').select('anuncio_id').eq('socio_id', user.id),
  ]);

  const ya = new Set((vistos ?? []).map(v => v.anuncio_id));
  const pendientes = ((anuncios ?? []) as Anuncio[]).filter(a =>
    !ya.has(a.id) && (a.destinatarios === 'activos' || perfil?.compra_habilitada)
  );
  return { ok: true, data: pendientes };
}

// "Entendido": no se vuelve a mostrar como popup (sigue en la campana)
export async function marcarAnuncioVisto(anuncioId: string): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('anuncios_vistos')
    .upsert({ anuncio_id: anuncioId, socio_id: user.id }, { onConflict: 'anuncio_id,socio_id', ignoreDuplicates: true });
  if (error) return { ok: false, error: 'Error al registrar' };
  return { ok: true, data: undefined };
}

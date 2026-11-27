'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Newsletter } from '@/lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

async function verificarAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return p?.rol === 'admin' ? supabase : null;
}

// Sube la portada al bucket público 'newsletter' y devuelve su URL pública
async function subirPortada(
  supabase: SupabaseClient<Database>,
  imagen: File
): Promise<{ url: string } | { error: string }> {
  const ext  = imagen.name.split('.').pop();
  const path = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('newsletter').upload(path, imagen, { cacheControl: '3600', upsert: false });
  if (error) return { error: 'Error al subir la imagen de portada' };
  const { data } = supabase.storage.from('newsletter').getPublicUrl(path);
  return { url: data.publicUrl };
}

// Encuadre de la imagen: 0 a 100, 50 si no viene
function posicion(fd: FormData, k: string): number {
  const n = parseFloat(String(fd.get(k) ?? ''));
  return isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
}

// Último día en que se muestra: YYYY-MM-DD o null
function vigencia(fd: FormData): string | null {
  const v = String(fd.get('vigente_hasta') ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// Resumen corto del contenido para la campana
function resumen(md: string): string {
  const t = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function revalidar() {
  revalidatePath('/admin/newsletter');
  revalidatePath('/socio/dashboard');
}

export async function crearNewsletter(fd: FormData): Promise<ActionResponse<Newsletter>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  let imagen_url: string | null = null;
  const imagen = fd.get('imagen') as File | null;
  if (imagen && imagen.size > 0) {
    const res = await subirPortada(supabase, imagen);
    if ('error' in res) return { ok: false, error: res.error };
    imagen_url = res.url;
  }

  const { data, error } = await supabase
    .from('newsletter')
    .insert({
      titulo:    (fd.get('titulo') as string).trim(),
      contenido: (fd.get('contenido') as string).trim(),
      imagen_url,
      imagen_pos_x: posicion(fd, 'imagen_pos_x'),
      imagen_pos_y: posicion(fd, 'imagen_pos_y'),
      vigente_hasta: vigencia(fd),
      publicado: false,
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al crear el artículo' };

  await registrarAccion(supabase, 'crear_articulo', 'newsletter', { titulo: data.titulo });
  revalidar();
  return { ok: true, data };
}

export async function actualizarNewsletter(fd: FormData): Promise<ActionResponse<Newsletter>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const id = fd.get('id') as string;

  let imagen_url: string | undefined = undefined;
  const imagen = fd.get('imagen') as File | null;
  if (imagen && imagen.size > 0) {
    const res = await subirPortada(supabase, imagen);
    if ('error' in res) return { ok: false, error: res.error };
    imagen_url = res.url;
  }

  const update: Record<string, any> = {
    titulo:    (fd.get('titulo') as string).trim(),
    contenido: (fd.get('contenido') as string).trim(),
    imagen_pos_x: posicion(fd, 'imagen_pos_x'),
    imagen_pos_y: posicion(fd, 'imagen_pos_y'),
    vigente_hasta: vigencia(fd),
  };
  if (imagen_url !== undefined) update.imagen_url = imagen_url;

  const { data, error } = await supabase
    .from('newsletter')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al actualizar el artículo' };

  await registrarAccion(supabase, 'editar_articulo', 'newsletter', { titulo: data.titulo });
  revalidar();
  return { ok: true, data };
}

export async function togglePublicado(id: string, publicado: boolean): Promise<ActionResponse<Newsletter>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const update: Record<string, any> = { publicado };

  // Al publicar por primera vez se fija la fecha de publicación (se conserva al republicar)
  let primeraVez = false;
  if (publicado) {
    const { data: actual } = await supabase.from('newsletter').select('fecha_publicacion').eq('id', id).single();
    primeraVez = !actual?.fecha_publicacion;
    if (primeraVez) update.fecha_publicacion = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('newsletter')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al cambiar el estado de publicación' };

  // Primera publicación: aviso en la campana de cada socio activo (al republicar no se repite)
  let notificados = 0;
  if (primeraVez) {
    const service = createServiceClient();
    const { data: socios } = await service.from('profiles').select('id').eq('rol', 'socio').eq('estado', 'activo');
    if (socios && socios.length > 0) {
      const { error: errNotif } = await service.from('notificaciones').insert(socios.map(s => ({
        socio_id: s.id, tipo: 'newsletter', titulo: `Novedad: ${data.titulo}`, mensaje: `${resumen(data.contenido)} Leela completa en el inicio.`,
      })));
      if (!errNotif) notificados = socios.length;
    }
  }

  await registrarAccion(supabase, publicado ? 'publicar_articulo' : 'despublicar_articulo', 'newsletter', { titulo: data.titulo, notificados });
  revalidar();
  return { ok: true, data };
}

// Fijar o desfijar: la fijada queda primera en el inicio del socio
export async function fijarNewsletter(id: string, fijada: boolean): Promise<ActionResponse<Newsletter>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };
  const { data, error } = await supabase.from('newsletter').update({ fijada }).eq('id', id).select().single();
  if (error || !data) return { ok: false, error: 'Error al fijar. ¿Se ejecutó newsletter-mejoras.sql?' };
  await registrarAccion(supabase, fijada ? 'fijar_articulo' : 'desfijar_articulo', 'newsletter', { titulo: data.titulo });
  revalidar();
  return { ok: true, data };
}

// Socio: registra que abrió una novedad (una vez; para el conteo de lecturas)
export async function marcarNewsletterVisto(id: string): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };
  const { error } = await supabase.from('newsletter_vistos')
    .upsert({ newsletter_id: id, socio_id: user.id }, { onConflict: 'newsletter_id,socio_id', ignoreDuplicates: true });
  return error ? { ok: false, error: 'Error al registrar' } : { ok: true, data: undefined };
}

export async function eliminarNewsletter(id: string): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('newsletter').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar el artículo' };

  await registrarAccion(supabase, 'eliminar_articulo', 'newsletter', { id });
  revalidar();
  return { ok: true, data: undefined };
}

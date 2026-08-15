'use server';

import { createClient } from '@/lib/supabase/server';
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
  if (publicado) {
    const { data: actual } = await supabase.from('newsletter').select('fecha_publicacion').eq('id', id).single();
    if (!actual?.fecha_publicacion) update.fecha_publicacion = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('newsletter')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al cambiar el estado de publicación' };

  await registrarAccion(supabase, publicado ? 'publicar_articulo' : 'despublicar_articulo', 'newsletter', { titulo: data.titulo });
  revalidar();
  return { ok: true, data };
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

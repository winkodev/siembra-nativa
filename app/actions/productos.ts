'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Producto } from '@/lib/types/database';

async function verificarAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return p?.rol === 'admin' ? supabase : null;
}

export async function crearProducto(fd: FormData): Promise<ActionResponse<Producto>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  let imagen_url: string | null = null;
  const imagen = fd.get('imagen') as File | null;

  if (imagen && imagen.size > 0) {
    const ext  = imagen.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('productos').upload(path, imagen, { cacheControl: '3600', upsert: false });
    if (upErr) return { ok: false, error: 'Error al subir la imagen' };
    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(path);
    imagen_url = urlData.publicUrl;
  }

  const precioStr = fd.get('precio') as string;
  const stockStr  = fd.get('stock') as string;

  const { data, error } = await supabase
    .from('productos')
    .insert({
      nombre:      (fd.get('nombre') as string).trim(),
      descripcion: (fd.get('descripcion') as string).trim() || null,
      categoria:   fd.get('categoria') as any,
      precio:      precioStr ? parseFloat(precioStr) : null,
      stock:       parseInt(stockStr) || 0,
      imagen_url,
      activo:      true,
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al crear el producto' };

  await registrarAccion(supabase, 'crear_producto', 'productos', { nombre: data.nombre });
  revalidatePath('/admin/productos');
  revalidatePath('/socio/tienda');
  return { ok: true, data };
}

export async function actualizarProducto(fd: FormData): Promise<ActionResponse<Producto>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const id = fd.get('id') as string;

  let imagen_url: string | undefined = undefined;
  const imagen = fd.get('imagen') as File | null;

  if (imagen && imagen.size > 0) {
    const ext  = imagen.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('productos').upload(path, imagen, { cacheControl: '3600', upsert: false });
    if (upErr) return { ok: false, error: 'Error al subir la imagen' };
    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(path);
    imagen_url = urlData.publicUrl;
  }

  const precioStr = fd.get('precio') as string;
  const stockStr  = fd.get('stock') as string;

  const update: Record<string, any> = {
    nombre:      (fd.get('nombre') as string).trim(),
    descripcion: (fd.get('descripcion') as string).trim() || null,
    categoria:   fd.get('categoria'),
    precio:      precioStr ? parseFloat(precioStr) : null,
    stock:       parseInt(stockStr) || 0,
  };
  if (imagen_url !== undefined) update.imagen_url = imagen_url;

  const { data, error } = await supabase
    .from('productos')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al actualizar el producto' };

  await registrarAccion(supabase, 'editar_producto', 'productos', { nombre: data.nombre });
  revalidatePath('/admin/productos');
  revalidatePath('/socio/tienda');
  return { ok: true, data };
}

export async function eliminarProducto(id: string): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar el producto' };

  await registrarAccion(supabase, 'eliminar_producto', 'productos', { id });
  revalidatePath('/admin/productos');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

export async function toggleProductoActivo(id: string, activo: boolean): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('productos').update({ activo }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar el estado' };

  await registrarAccion(supabase, activo ? 'activar_producto' : 'desactivar_producto', 'productos', { id });
  revalidatePath('/admin/productos');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

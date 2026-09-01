'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse } from '@/lib/types/database';

// ============================================================
// GENÉTICAS
// ============================================================

const geneticaSchema = z.object({
  nombre:      z.string().min(2, 'El nombre es requerido'),
  tipo:        z.enum(['indica', 'sativa', 'hibrida']),
  thc:         z.string().optional().transform(v => v ? parseFloat(v) : null),
  cbd:         z.string().optional().transform(v => v ? parseFloat(v) : null),
  descripcion: z.string().optional().transform(v => v || null),
  calidad:     z.string().optional().transform(v => v === 'regular' || v === 'premium' ? v : null),
  cultivo:     z.string().optional().transform(v => v === 'indoor' || v === 'outdoor' ? v : null),
  precio_gramo: z.string().optional().transform(v => v ? parseFloat(v) : null),
  banco:       z.string().optional().transform(v => v?.trim() || null),
  // Checkbox: llega 'on' si está tildado, ausente si no
  novedad:     z.string().optional().transform(v => v === 'on'),
});

export async function crearGenetica(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const raw = Object.fromEntries(formData);
  const parsed = geneticaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  let imagen_url: string | null = null;

  // Subir imagen si se adjuntó
  const imagen = formData.get('imagen') as File | null;
  if (imagen && imagen.size > 0) {
    const ext  = imagen.name.split('.').pop() ?? 'jpg';
    const path = `${Date.now()}-${parsed.data.nombre.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('geneticas-imagenes')
      .upload(path, imagen, { upsert: true });

    if (uploadError) return { ok: false, error: 'Error al subir la imagen' };

    const { data: urlData } = supabase.storage.from('geneticas-imagenes').getPublicUrl(path);
    imagen_url = urlData.publicUrl;
  }

  const { error } = await supabase.from('geneticas').insert({
    ...parsed.data,
    imagen_url,
  });

  if (error) return { ok: false, error: 'Error al crear la genética' };

  await registrarAccion(supabase, 'crear_genetica', 'geneticas', { nombre: parsed.data.nombre });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

export async function editarGenetica(
  id: string,
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const raw = Object.fromEntries(formData);
  const parsed = geneticaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  let imagen_url: string | undefined;

  // Subir nueva imagen si se adjuntó
  const imagen = formData.get('imagen') as File | null;
  if (imagen && imagen.size > 0) {
    const ext  = imagen.name.split('.').pop() ?? 'jpg';
    const path = `${Date.now()}-${parsed.data.nombre.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('geneticas-imagenes')
      .upload(path, imagen, { upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('geneticas-imagenes').getPublicUrl(path);
      imagen_url = urlData.publicUrl;
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (imagen_url) updateData.imagen_url = imagen_url;

  const { error } = await supabase.from('geneticas').update(updateData).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar la genética' };

  await registrarAccion(supabase, 'editar_genetica', 'geneticas', { nombre: parsed.data.nombre });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

export async function toggleGeneticaActiva(id: string, activa: boolean): Promise<ActionResponse> {
  const supabase = createClient();
  const { error } = await supabase.from('geneticas').update({ activa }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar' };

  await registrarAccion(supabase, activa ? 'activar_genetica' : 'desactivar_genetica', 'geneticas', { id });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

export async function eliminarGenetica(id: string): Promise<ActionResponse> {
  const supabase = createClient();
  // Verificar que no tenga stock ni pedidos activos
  const { count: stockCount } = await supabase
    .from('stock')
    .select('*', { count: 'exact', head: true })
    .eq('genetica_id', id)
    .gt('cantidad_gramos', 0);

  if (stockCount && stockCount > 0) {
    return { ok: false, error: 'No se puede eliminar: tiene stock disponible. Desactivala en cambio.' };
  }

  const { error } = await supabase.from('geneticas').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar la genética' };

  await registrarAccion(supabase, 'eliminar_genetica', 'geneticas', { id });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

// ============================================================
// STOCK
// ============================================================

// Editar/eliminar ingresos de stock queda reservado al superadmin:
// un admin común solo puede registrar ingresos nuevos.
async function esSuperadmin(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('superadmin').eq('id', user.id).single();
  return Boolean(data?.superadmin);
}

const stockSchema = z.object({
  genetica_id:     z.string().uuid('Seleccioná una genética'),
  cantidad_gramos: z.string().transform(v => parseFloat(v)).pipe(z.number().positive('La cantidad debe ser mayor a 0')),
  ubicacion:       z.string().optional().transform(v => v || null),
  lote:            z.string().optional().transform(v => v || null),
  fecha_ingreso:   z.string().refine(v => !isNaN(Date.parse(v)), 'Fecha inválida'),
});

export async function agregarStock(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const raw = Object.fromEntries(formData);
  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { error } = await supabase.from('stock').insert(parsed.data);
  if (error) return { ok: false, error: 'Error al registrar el ingreso de stock' };

  await registrarAccion(supabase, 'agregar_stock', 'stock', {
    genetica_id: parsed.data.genetica_id,
    cantidad_gramos: parsed.data.cantidad_gramos,
    lote: parsed.data.lote,
  });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

export async function editarStock(
  id: string,
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createClient();
  if (!(await esSuperadmin(supabase))) {
    return { ok: false, error: 'Solo el superadmin puede editar ingresos de stock' };
  }

  const raw = Object.fromEntries(formData);
  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  // Editar re-declara lo INGRESADO del lote; lo ya consumido se preserva
  // (restante nuevo = ingresado nuevo − consumido hasta ahora)
  const { data: actual } = await supabase
    .from('stock')
    .select('cantidad_inicial, cantidad_gramos')
    .eq('id', id)
    .single();

  if (!actual) return { ok: false, error: 'Registro de stock no encontrado' };

  const consumido = Math.max(actual.cantidad_inicial - actual.cantidad_gramos, 0);
  const nuevoIngresado = parsed.data.cantidad_gramos;

  if (nuevoIngresado < consumido) {
    return { ok: false, error: `Este lote ya dispensó ${consumido}g: el ingreso no puede ser menor a eso.` };
  }

  const { error } = await supabase
    .from('stock')
    .update({
      ...parsed.data,
      cantidad_inicial: nuevoIngresado,
      cantidad_gramos:  nuevoIngresado - consumido,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'Error al actualizar el stock' };

  await registrarAccion(supabase, 'editar_stock', 'stock', {
    lote: parsed.data.lote,
    cantidad_gramos: parsed.data.cantidad_gramos,
  });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

// Mover un lote a otra ubicación (solo superadmin, como editar/eliminar)
export async function moverStockUbicacion(id: string, ubicacion: string): Promise<ActionResponse> {
  const supabase = createClient();
  if (!(await esSuperadmin(supabase))) {
    return { ok: false, error: 'Solo el superadmin puede mover lotes de ubicación' };
  }

  const destino = ubicacion.trim() || null;

  // La ubicación destino debe existir y estar activa (o quedar sin ubicación)
  if (destino) {
    const { data: ubi } = await supabase
      .from('ubicaciones')
      .select('id')
      .eq('nombre', destino)
      .eq('activa', true)
      .maybeSingle();
    if (!ubi) return { ok: false, error: 'La ubicación destino no existe o está inactiva' };
  }

  const { data: actual } = await supabase
    .from('stock')
    .select('ubicacion, lote')
    .eq('id', id)
    .single();
  if (!actual) return { ok: false, error: 'Registro de stock no encontrado' };

  if ((actual.ubicacion ?? null) === destino) {
    return { ok: false, error: 'El lote ya está en esa ubicación' };
  }

  const { error } = await supabase.from('stock').update({ ubicacion: destino }).eq('id', id);
  if (error) return { ok: false, error: 'Error al mover el lote' };

  await registrarAccion(supabase, 'mover_stock', 'stock', {
    lote: actual.lote,
    desde: actual.ubicacion,
    hasta: destino,
  });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

export async function eliminarStock(id: string): Promise<ActionResponse> {
  const supabase = createClient();
  if (!(await esSuperadmin(supabase))) {
    return { ok: false, error: 'Solo el superadmin puede eliminar ingresos de stock' };
  }
  const { error } = await supabase.from('stock').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar el registro' };

  await registrarAccion(supabase, 'eliminar_stock', 'stock', { id });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

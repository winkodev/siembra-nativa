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

// Costo del ingreso: solo lo pagado por gramo, en pesos o dólares
const numero = z.string().optional().transform(v => (v ? parseFloat(v) : NaN));
const costoSchema = z.object({
  costo_gramo:      numero.pipe(z.number({ message: 'Indicá el costo por gramo' }).positive('El costo por gramo debe ser mayor a 0')),
  costo_moneda:     z.enum(['ARS', 'USD']),
  costo_cotizacion: numero.transform(n => (n > 0 ? n : null)),
}).refine(c => c.costo_moneda === 'ARS' || c.costo_cotizacion, 'Indicá la cotización del dólar');
const compraSchema = z.object({
  proveedor: z.string().trim().min(1, 'Indicá a quién se le compró'),
  vence_at:  z.string().optional().transform(v => v || null),
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

  const costo = costoSchema.safeParse(raw);
  if (!costo.success) return { ok: false, error: costo.error.errors[0].message };
  const compra = compraSchema.safeParse(raw);
  if (!compra.success) return { ok: false, error: compra.error.errors[0].message };

  // La base crea el lote y la deuda del club juntos
  const { error } = await supabase.rpc('ingresar_stock', {
    p_genetica_id: parsed.data.genetica_id, p_gramos: parsed.data.cantidad_gramos,
    p_ubicacion: parsed.data.ubicacion, p_lote: parsed.data.lote, p_fecha: parsed.data.fecha_ingreso,
    p_moneda: costo.data.costo_moneda, p_costo_gramo: costo.data.costo_gramo, p_cotizacion: costo.data.costo_cotizacion,
    p_proveedor: compra.data.proveedor, p_vence: compra.data.vence_at,
  });
  if (error) return { ok: false, error: error.message };

  await registrarAccion(supabase, 'agregar_stock', 'stock', {
    genetica_id: parsed.data.genetica_id,
    cantidad_gramos: parsed.data.cantidad_gramos,
    lote: parsed.data.lote,
    costo_gramo: costo.data.costo_gramo, moneda: costo.data.costo_moneda, proveedor: compra.data.proveedor,
  });
  revalidatePath('/admin/inventario');
  revalidatePath('/admin/finanzas', 'layout');
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
    .select('cantidad_inicial, cantidad_gramos, costo_gramo, genetica_id')
    .eq('id', id)
    .single();

  if (!actual) return { ok: false, error: 'Registro de stock no encontrado' };

  const consumido = Math.max(actual.cantidad_inicial - actual.cantidad_gramos, 0);
  const nuevoIngresado = parsed.data.cantidad_gramos;

  if (nuevoIngresado < consumido) {
    return { ok: false, error: `Este lote ya dispensó ${consumido}g: el ingreso no puede ser menor a eso.` };
  }

  // Lote con costo: primero se corrige el costo y la deuda (valida lo ya pagado)
  if (actual.costo_gramo != null) {
    if (parsed.data.genetica_id !== actual.genetica_id && consumido > 0) {
      return { ok: false, error: 'Este lote ya tuvo salidas: no se puede cambiar la genética.' };
    }
    const costo = costoSchema.safeParse(raw);
    if (!costo.success) return { ok: false, error: costo.error.errors[0].message };
    const { error: errCosto } = await supabase.rpc('corregir_costo_lote', {
      p_stock_id: id, p_gramos: nuevoIngresado, p_costo_gramo: costo.data.costo_gramo, p_cotizacion: costo.data.costo_cotizacion,
      p_moneda: costo.data.costo_moneda,
    });
    if (errCosto) return { ok: false, error: errCosto.message };
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
  // La deuda de la compra se anula con el ingreso, salvo que ya tenga pagos
  const { data: lote } = await supabase.from('stock').select('deuda_id').eq('id', id).maybeSingle();
  if (lote?.deuda_id) {
    const { data: pagos } = await supabase.from('tes_movimientos').select('id').eq('deuda_id', lote.deuda_id).limit(1);
    if (pagos && pagos.length > 0) {
      return { ok: false, error: 'La compra de este lote ya tiene pagos: eliminá primero esos movimientos en Tesorería' };
    }
  }
  const { error } = await supabase.from('stock').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar el registro' };
  if (lote?.deuda_id) {
    const { error: errDeuda } = await supabase.from('tes_deudas').update({ anulada: true }).eq('id', lote.deuda_id);
    if (errDeuda) return { ok: false, error: 'El ingreso se eliminó pero no se pudo anular su deuda: anulala en Tesorería' };
  }

  await registrarAccion(supabase, 'eliminar_stock', 'stock', { id });
  revalidatePath('/admin/inventario');
  return { ok: true, data: undefined };
}

// Salida manual de stock (solo superadmin): pedido informal, merma, muestra.
// La base descuenta FIFO y registra la salida; acá solo se audita.
export async function egresoManualStock(geneticaId: string, gramos: number, motivo: string): Promise<ActionResponse> {
  const supabase = createClient();
  if (!(await esSuperadmin(supabase))) {
    return { ok: false, error: 'Solo el superadmin puede registrar salidas manuales' };
  }
  if (!(gramos > 0)) return { ok: false, error: 'Indicá una cantidad mayor a 0' };
  if (!motivo.trim()) return { ok: false, error: 'Indicá el motivo de la salida' };

  const { error } = await supabase.rpc('egreso_manual_stock', {
    p_genetica_id: geneticaId, p_gramos: gramos, p_motivo: motivo.trim(),
  });
  if (error) return { ok: false, error: error.message };

  await registrarAccion(supabase, 'egreso_stock', 'stock', { genetica_id: geneticaId, gramos, motivo: motivo.trim() });
  revalidatePath('/admin/inventario');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

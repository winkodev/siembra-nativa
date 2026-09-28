'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Cupon, CuponConProducto, TipoCupon } from '@/lib/types/database';

// Verifica que el usuario sea admin y devuelve su ID
async function verificarAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return data?.rol === 'admin' ? user.id : null;
}

// Trae el producto de regalo de cada cupón (nombre/precio/stock actuales)
async function conProducto(cupones: Cupon[]): Promise<CuponConProducto[]> {
  const ids = Array.from(new Set(cupones.map(c => c.producto_id).filter(Boolean))) as string[];
  if (ids.length === 0) return cupones.map(c => ({ ...c, producto: null }));

  const service = createServiceClient();
  const { data: productos } = await service
    .from('productos_publico')
    .select('id, nombre, precio, categoria, stock')
    .in('id', ids);

  const map = new Map((productos ?? []).map(p => [p.id, p]));
  return cupones.map(c => {
    const p = c.producto_id ? map.get(c.producto_id) : null;
    return { ...c, producto: p ? { nombre: p.nombre, precio: p.precio, categoria: p.categoria, stock: p.stock } : null };
  });
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

export interface NuevoCupon {
  socio_id:    string;
  tipo:        TipoCupon;
  valor?:      number | null;
  producto_id?: string | null;
  cantidad?:   number | null;
  mensaje:     string;
  vence_at?:   string | null;   // YYYY-MM-DD
}

export async function crearCupon(input: NuevoCupon): Promise<ActionResponse<CuponConProducto>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const mensaje = input.mensaje.trim();
  if (!mensaje) return { ok: false, error: 'Escribí el mensaje para el socio' };

  // Validaciones por tipo (la base también las chequea con un CHECK)
  const fila: Record<string, unknown> = {
    socio_id: input.socio_id, tipo: input.tipo, mensaje, creado_por: adminId,
    vence_at: input.vence_at ? `${input.vence_at}T23:59:59-03:00` : null,
  };
  if (input.tipo === 'porcentaje') {
    if (!input.valor || input.valor <= 0 || input.valor > 100) return { ok: false, error: 'El porcentaje tiene que estar entre 1 y 100' };
    fila.valor = input.valor;
  } else if (input.tipo === 'monto') {
    if (!input.valor || input.valor <= 0) return { ok: false, error: 'Ingresá un monto mayor a 0' };
    fila.valor = input.valor;
  } else if (input.tipo === 'producto_gratis') {
    if (!input.producto_id) return { ok: false, error: 'Elegí el producto de regalo' };
    fila.producto_id = input.producto_id;
    fila.cantidad = Math.max(1, Math.floor(input.cantidad ?? 1));
  }

  const service = createServiceClient();
  const { data, error } = await service.from('cupones').insert(fila).select('*').single();
  if (error || !data) return { ok: false, error: 'Error al crear el cupón' };

  // Aviso in-app: el popup aparece cuando el socio entre
  await service.from('notificaciones').insert({
    socio_id: input.socio_id,
    titulo:   'Tenés un regalo del club 🎁',
    mensaje:  'Abrí tu carrito para usarlo en tu próximo pedido.',
  });

  await registrarAccion(createClient(), 'crear_cupon', 'cupones', { cupon_id: data.id, tipo: input.tipo }, input.socio_id);
  revalidatePath('/admin/socios');
  revalidatePath('/socio/dashboard');
  const [cupon] = await conProducto([data as Cupon]);
  return { ok: true, data: cupon };
}

export async function anularCupon(cuponId: string): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { data, error } = await service
    .from('cupones')
    .update({ estado: 'anulado' })
    .eq('id', cuponId)
    .eq('estado', 'disponible')   // un cupón usado no se anula
    .select('socio_id')
    .single();
  if (error || !data) return { ok: false, error: 'El cupón ya fue usado o no existe' };

  await registrarAccion(createClient(), 'anular_cupon', 'cupones', { cupon_id: cuponId }, data.socio_id);
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}

export async function listarCuponesSocio(socioId: string): Promise<ActionResponse<CuponConProducto[]>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { data, error } = await service
    .from('cupones')
    .select('*')
    .eq('socio_id', socioId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: 'Error al cargar los cupones' };
  return { ok: true, data: await conProducto((data ?? []) as Cupon[]) };
}

// ------------------------------------------------------------
// Socio
// ------------------------------------------------------------

// Cupones disponibles y no vencidos del socio actual (RLS: solo los propios)
export async function misCupones(): Promise<ActionResponse<CuponConProducto[]>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { data, error } = await supabase
    .from('cupones')
    .select('*')
    .eq('socio_id', user.id)
    .eq('estado', 'disponible')
    .or(`vence_at.is.null,vence_at.gte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: 'Error al cargar los cupones' };
  return { ok: true, data: await conProducto((data ?? []) as Cupon[]) };
}

// El popup "Tenés un regalo" se muestra una sola vez por cupón
export async function marcarCuponVisto(cuponId: string): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('cupones')
    .update({ visto_at: new Date().toISOString() })
    .eq('id', cuponId)
    .eq('socio_id', user.id);
  if (error) return { ok: false, error: 'Error al marcar el cupón' };
  return { ok: true, data: undefined };
}

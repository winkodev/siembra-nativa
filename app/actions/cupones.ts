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

// ------------------------------------------------------------
// Cupones masivos ("Cupón para todos"): un cupón individual por socio,
// todos con el mismo lote_id. Cada uno sigue siendo personal y de un uso.
// ------------------------------------------------------------

export type DestinatariosLote = 'activos' | 'tienda' | 'reprocann';

export interface NuevoCuponMasivo extends Omit<NuevoCupon, 'socio_id'> {
  destinatarios: DestinatariosLote;
}

export interface LoteCupones {
  lote_id:     string;
  created_at:  string;
  tipo:        TipoCupon;
  valor:       number | null;
  cantidad:    number | null;
  producto:    string | null;
  mensaje:     string;
  total:       number;
  usados:      number;
  disponibles: number;
  anulados:    number;
}

export async function crearCuponMasivo(input: NuevoCuponMasivo): Promise<ActionResponse<{ creados: number }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const mensaje = input.mensaje.trim();
  if (!mensaje) return { ok: false, error: 'Escribí el mensaje para los socios' };

  // Mismas validaciones que el cupón individual
  const base: Record<string, unknown> = {
    tipo: input.tipo, mensaje, creado_por: adminId,
    vence_at: input.vence_at ? `${input.vence_at}T23:59:59-03:00` : null,
  };
  if (input.tipo === 'porcentaje') {
    if (!input.valor || input.valor <= 0 || input.valor > 100) return { ok: false, error: 'El porcentaje tiene que estar entre 1 y 100' };
    base.valor = input.valor;
  } else if (input.tipo === 'monto') {
    if (!input.valor || input.valor <= 0) return { ok: false, error: 'Ingresá un monto mayor a 0' };
    base.valor = input.valor;
  } else if (input.tipo === 'producto_gratis') {
    if (!input.producto_id) return { ok: false, error: 'Elegí el producto de regalo' };
    base.producto_id = input.producto_id;
    base.cantidad = Math.max(1, Math.floor(input.cantidad ?? 1));
  }

  // Destinatarios: socios activos, y según el filtro con tienda o REPROCANN aprobado
  const service = createServiceClient();
  let q = service.from('profiles').select('id').eq('rol', 'socio').eq('estado', 'activo');
  if (input.destinatarios === 'tienda')    q = q.eq('compra_habilitada', true);
  if (input.destinatarios === 'reprocann') q = q.eq('reprocann_estado', 'aprobado');
  const { data: socios, error: errSocios } = await q;
  if (errSocios) return { ok: false, error: 'Error al buscar los socios' };
  if (!socios || socios.length === 0) return { ok: false, error: 'No hay socios que cumplan el criterio' };

  const loteId = crypto.randomUUID();
  const filas = socios.map(s => ({ ...base, socio_id: s.id, lote_id: loteId }));
  const { error } = await service.from('cupones').insert(filas);
  if (error) return { ok: false, error: 'Error al crear los cupones' };

  await service.from('notificaciones').insert(socios.map(s => ({
    socio_id: s.id,
    titulo:   'Tenés un regalo del club 🎁',
    mensaje:  'Abrí tu carrito para usarlo en tu próximo pedido.',
  })));

  await registrarAccion(createClient(), 'crear_cupon_masivo', 'cupones', {
    lote_id: loteId, tipo: input.tipo, destinatarios: input.destinatarios, cantidad_socios: socios.length,
  });
  revalidatePath('/admin/socios');
  revalidatePath('/socio/dashboard');
  return { ok: true, data: { creados: socios.length } };
}

// Últimos lotes con su uso (para el modal "Cupón para todos")
export async function listarLotes(): Promise<ActionResponse<LoteCupones[]>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { data, error } = await service
    .from('cupones')
    .select('lote_id, created_at, tipo, valor, cantidad, producto_id, mensaje, estado')
    .not('lote_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return { ok: false, error: 'Error al cargar los lotes' };

  const ids = Array.from(new Set((data ?? []).map(c => c.producto_id).filter(Boolean))) as string[];
  const { data: productos } = ids.length
    ? await service.from('productos').select('id, nombre').in('id', ids)
    : { data: [] as { id: string; nombre: string }[] };
  const nombreProd = new Map((productos ?? []).map(p => [p.id, p.nombre]));

  const lotes = new Map<string, LoteCupones>();
  for (const c of data ?? []) {
    const id = c.lote_id as string;
    let l = lotes.get(id);
    if (!l) {
      l = {
        lote_id: id, created_at: c.created_at, tipo: c.tipo as TipoCupon, valor: c.valor, cantidad: c.cantidad,
        producto: c.producto_id ? nombreProd.get(c.producto_id) ?? null : null, mensaje: c.mensaje,
        total: 0, usados: 0, disponibles: 0, anulados: 0,
      };
      lotes.set(id, l);
    }
    l.total++;
    if (c.estado === 'usado') l.usados++;
    else if (c.estado === 'disponible') l.disponibles++;
    else l.anulados++;
  }
  return { ok: true, data: Array.from(lotes.values()).slice(0, 20) };
}

// Anula los cupones del lote que todavía no se usaron
export async function anularLote(loteId: string): Promise<ActionResponse<{ anulados: number }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { data, error } = await service
    .from('cupones')
    .update({ estado: 'anulado' })
    .eq('lote_id', loteId)
    .eq('estado', 'disponible')
    .select('id');
  if (error) return { ok: false, error: 'Error al anular el lote' };

  await registrarAccion(createClient(), 'anular_cupon_masivo', 'cupones', { lote_id: loteId, anulados: data?.length ?? 0 });
  revalidatePath('/admin/socios');
  return { ok: true, data: { anulados: data?.length ?? 0 } };
}

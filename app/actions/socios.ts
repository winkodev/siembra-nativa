'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, FichaSocio, SocioNota, TipoNotaSocio } from '@/lib/types/database';

// Verifica que el usuario sea admin y devuelve su ID
async function verificarAdmin(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  return data?.rol === 'admin' ? user.id : null;
}

export async function toggleEstadoSocio(socioId: string, estado: 'activo' | 'inactivo'): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();

  // La cuenta principal del club (superadmin) no se puede desactivar
  if (estado === 'inactivo') {
    const { data: target } = await service.from('profiles').select('superadmin').eq('id', socioId).single();
    if (target?.superadmin) {
      return { ok: false, error: 'La cuenta principal del club no se puede desactivar' };
    }
  }

  const patch = estado === 'inactivo'
    ? { estado, compra_habilitada: false }
    : { estado };

  const { error } = await service.from('profiles').update(patch).eq('id', socioId);
  if (error) return { ok: false, error: `Error al actualizar estado: ${error.message}` };

  await registrarAccion(createClient(), estado === 'activo' ? 'activar_socio' : 'desactivar_socio', 'socios', undefined, socioId);
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}

// Aprobar REPROCANN habilita la tienda automáticamente
export async function aprobarReprocann(socioId: string): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { error } = await service
    .from('profiles')
    .update({ reprocann_estado: 'aprobado', compra_habilitada: true })
    .eq('id', socioId);

  if (error) return { ok: false, error: `Error al aprobar: ${error.message}` };

  await registrarAccion(createClient(), 'aprobar_reprocann', 'reprocann', undefined, socioId);
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}

// Revocar REPROCANN deshabilita la tienda automáticamente
export async function rechazarReprocann(socioId: string): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();
  const { error } = await service
    .from('profiles')
    .update({ reprocann_estado: 'rechazado', compra_habilitada: false })
    .eq('id', socioId);

  if (error) return { ok: false, error: `Error al revocar: ${error.message}` };

  await registrarAccion(createClient(), 'rechazar_reprocann', 'reprocann', undefined, socioId);
  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}

// Corrige la fecha de vencimiento del REPROCANN. Si la fecha nueva es
// futura y el estado era "vencido", se re-aprueba (certificado renovado).
export async function actualizarVencimientoReprocann(
  socioId: string,
  fecha: string  // YYYY-MM-DD
): Promise<ActionResponse<{ reaprobado: boolean }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'Fecha inválida' };

  const service = createServiceClient();
  const { data: actual } = await service
    .from('profiles')
    .select('reprocann_estado')
    .eq('id', socioId)
    .single();

  if (!actual) return { ok: false, error: 'Socio no encontrado' };

  const esFutura   = fecha >= new Date().toISOString().slice(0, 10);
  const reaprobado = actual.reprocann_estado === 'vencido' && esFutura;

  const patch: Record<string, unknown> = { reprocann_vencimiento: fecha };
  if (reaprobado) {
    patch.reprocann_estado = 'aprobado';
    patch.compra_habilitada = true;
  }

  const { error } = await service.from('profiles').update(patch).eq('id', socioId);
  if (error) return { ok: false, error: 'Error al actualizar el vencimiento' };

  await registrarAccion(createClient(), 'editar_vencimiento_reprocann', 'reprocann', { fecha }, socioId);
  revalidatePath('/admin/socios');
  return { ok: true, data: { reaprobado } };
}

// ------------------------------------------------------------
// Ficha de actividad + log de notas del socio
// ------------------------------------------------------------

export async function obtenerFichaSocio(socioId: string): Promise<ActionResponse<FichaSocio>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const supabase = createClient();
  const [{ data: pedidos }, { data: items }, { data: notas }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, estado, created_at')
      .eq('socio_id', socioId)
      .order('created_at', { ascending: false }),
    // Items de los pedidos ENTREGADOS del socio (lo efectivamente retirado)
    supabase
      .from('pedido_items')
      .select('cantidad_gramos, cantidad_unidades, pedidos!inner(socio_id, estado)')
      .eq('pedidos.socio_id', socioId)
      .eq('pedidos.estado', 'entregado'),
    supabase
      .from('socio_notas')
      .select('*')
      .eq('socio_id', socioId)
      .order('created_at', { ascending: false }),
  ]);

  const listaItems = (items ?? []) as { cantidad_gramos: number | null; cantidad_unidades: number | null }[];
  const gramos     = listaItems.reduce((s, i) => s + (i.cantidad_gramos ?? 0), 0);
  const unidades   = listaItems.reduce((s, i) => s + (i.cantidad_unidades ?? 0), 0);
  const entregados = (pedidos ?? []).filter(p => p.estado === 'entregado').length;

  return {
    ok: true,
    data: {
      pedidos_total:      pedidos?.length ?? 0,
      pedidos_entregados: entregados,
      gramos_retirados:   gramos,
      unidades_retiradas: unidades,
      promedio_gramos:    entregados > 0 ? gramos / entregados : 0,
      ultimo_pedido:      pedidos?.[0]?.created_at ?? null,
      notas:              (notas ?? []) as SocioNota[],
    },
  };
}

export async function agregarNotaSocio(
  socioId: string,
  tipo: TipoNotaSocio,
  contenido: string
): Promise<ActionResponse<SocioNota>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };
  if (!contenido.trim()) return { ok: false, error: 'La nota está vacía' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('socio_notas')
    .insert({ socio_id: socioId, admin_id: adminId, tipo, contenido: contenido.trim() })
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al guardar la nota' };

  await registrarAccion(supabase, 'agregar_nota', 'socio_notas', { tipo }, socioId);
  revalidatePath('/admin/socios');
  return { ok: true, data };
}

export async function eliminarNotaSocio(notaId: string): Promise<ActionResponse> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const supabase = createClient();
  const { error } = await supabase.from('socio_notas').delete().eq('id', notaId);
  if (error) return { ok: false, error: 'Error al eliminar la nota' };

  revalidatePath('/admin/socios');
  return { ok: true, data: undefined };
}

// Genera URL firmada de 5 minutos para ver el certificado REPROCANN
export async function obtenerCertificadoUrl(socioId: string, path: string): Promise<ActionResponse<{ url: string }>> {
  const adminId = await verificarAdmin();
  if (!adminId) return { ok: false, error: 'No autorizado' };

  const service = createServiceClient();

  // Registrar en audit_log (Ley 25.326)
  await service.from('audit_log').insert({
    admin_id: adminId,
    accion: 'ver_certificado',
    recurso: 'reprocann_certificado',
    socio_afectado_id: socioId,
    metadata: { path },
  });

  const { data, error } = await service.storage
    .from('certificados-reprocann')
    .createSignedUrl(path, 300);

  if (error || !data) return { ok: false, error: 'No se pudo generar el acceso al certificado' };
  return { ok: true, data: { url: data.signedUrl } };
}

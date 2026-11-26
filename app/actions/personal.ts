'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, TipoPersonal, TipoPagoPersonal } from '@/lib/types/database';

// Personal y objetivos son solo del superadmin (la RLS y las funciones también lo exigen)
async function superadmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  return data?.rol === 'admin' && data.superadmin ? { supabase, userId: user.id } : null;
}
const NO_AUTORIZADO = { ok: false as const, error: 'Solo el superadmin puede usar Personal' };

const PRIMER_MES = 'El primer sueldo a pagar no puede ser anterior al ingreso';
const fechaOk = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);
const positivo = (n: number) => typeof n === 'number' && isFinite(n) && n > 0;

function refrescar() {
  revalidatePath('/admin/gestion', 'layout');
  revalidatePath('/admin/finanzas', 'layout');
  revalidatePath('/admin/dashboard');
}

// Alta: solo usuarios con rol admin
export async function crearPersonal(input: { profile_id: string; tipo: TipoPersonal; cargo?: string; fecha_ingreso: string; primer_mes: string; sueldo?: number }): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!fechaOk(input.fecha_ingreso)) return { ok: false, error: 'Fecha de ingreso inválida' };
  if (input.tipo === 'empleado' && !positivo(input.sueldo ?? 0)) return { ok: false, error: 'Indicá el sueldo base' };
  const desde = `${input.primer_mes.slice(0, 7)}-01`;
  if (input.tipo === 'empleado' && !fechaOk(desde)) return { ok: false, error: 'Mes inválido' };
  if (input.tipo === 'empleado' && desde.slice(0, 7) < input.fecha_ingreso.slice(0, 7)) return { ok: false, error: PRIMER_MES };

  const { data: perfil } = await s.supabase.from('profiles').select('nombre, rol').eq('id', input.profile_id).single();
  if (!perfil || perfil.rol !== 'admin') return { ok: false, error: 'Solo se pueden cargar usuarios admin' };

  const { data: p, error } = await s.supabase.from('personal').insert({
    profile_id: input.profile_id, nombre: perfil.nombre, tipo: input.tipo, cargo: input.cargo?.trim() || null,
    fecha_ingreso: input.fecha_ingreso, created_by: s.userId,
  }).select('id').single();
  if (error || !p) return { ok: false, error: error?.code === '23505' ? 'Esa persona ya está cargada' : 'Error al guardar. ¿Se ejecutó personal-costos-objetivos.sql?' };

  if (input.tipo === 'empleado') {
    const { error: e2 } = await s.supabase.from('personal_sueldos').insert({
      personal_id: p.id, desde, monto: input.sueldo!, created_by: s.userId,
    });
    if (e2) {
      // Sin sueldo el alta queda a medias: se deshace
      await s.supabase.from('personal').delete().eq('id', p.id);
      return { ok: false, error: 'Error al guardar el sueldo' };
    }
  }
  await registrarAccion(s.supabase, 'personal_alta', 'personal', { nombre: perfil.nombre, tipo: input.tipo, sueldo: input.sueldo ?? null });
  refrescar();
  return { ok: true, data: undefined };
}

// Editar datos. El sueldo base solo se corrige mientras no haya aumentos ni pagos.
export async function editarPersonal(id: string, input: { cargo?: string; fecha_ingreso: string; primer_mes: string; activo: boolean; sueldo?: number }): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!fechaOk(input.fecha_ingreso)) return { ok: false, error: 'Fecha de ingreso inválida' };
  const { data: p } = await s.supabase.from('personal').select('nombre, tipo').eq('id', id).single();
  if (!p) return { ok: false, error: 'Persona no encontrada' };

  if (p.tipo === 'empleado') {
    const desde = `${input.primer_mes.slice(0, 7)}-01`;
    if (!fechaOk(desde)) return { ok: false, error: 'Mes inválido' };
    if (desde.slice(0, 7) < input.fecha_ingreso.slice(0, 7)) return { ok: false, error: PRIMER_MES };
    const [{ data: sueldos }, { data: pagos }] = await Promise.all([
      s.supabase.from('personal_sueldos').select('*').eq('personal_id', id).order('desde').order('created_at'),
      s.supabase.from('personal_pagos').select('tipo, periodo').eq('personal_id', id).is('anulado_at', null).order('periodo'),
    ]);
    const inicial = sueldos?.[0];
    if (inicial && sueldos) {
      if (sueldos[1] && desde > sueldos[1].desde) return { ok: false, error: 'El primer sueldo a pagar no puede ser posterior al primer aumento' };
      if ((pagos ?? []).some(g => g.tipo === 'sueldo' && g.periodo < desde)) return { ok: false, error: 'Ya hay sueldos pagados antes de ese mes' };
      const corregir = input.sueldo != null && Number(input.sueldo) !== Number(inicial.monto);
      if (corregir && (sueldos.length > 1 || (pagos ?? []).length > 0)) return { ok: false, error: 'El sueldo ya tiene aumentos o pagos: cambialo con un aumento' };
      if (corregir && !positivo(input.sueldo!)) return { ok: false, error: 'Indicá el sueldo base' };
      const { error } = await s.supabase.from('personal_sueldos')
        .update({ desde, ...(corregir ? { monto: input.sueldo } : {}) }).eq('id', inicial.id);
      if (error) return { ok: false, error: 'Error al guardar el sueldo' };
    }
  }

  const { error } = await s.supabase.from('personal')
    .update({ cargo: input.cargo?.trim() || null, fecha_ingreso: input.fecha_ingreso, activo: input.activo }).eq('id', id);
  if (error) return { ok: false, error: 'Error al guardar' };
  await registrarAccion(s.supabase, 'personal_editar', 'personal', { nombre: p.nombre, activo: input.activo });
  refrescar();
  return { ok: true, data: undefined };
}

// Aumento en % para las personas elegidas, desde un mes
export async function aplicarAumento(ids: string[], porcentaje: number, desdeMes: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (ids.length === 0) return { ok: false, error: 'Elegí al menos una persona' };
  if (!positivo(porcentaje)) return { ok: false, error: 'El porcentaje tiene que ser mayor a 0' };
  const desde = `${desdeMes.slice(0, 7)}-01`;
  if (!fechaOk(desde)) return { ok: false, error: 'Mes inválido' };

  const [{ data: sueldos }, { data: personas }] = await Promise.all([
    s.supabase.from('personal_sueldos').select('*').in('personal_id', ids).order('desde', { ascending: false }).order('created_at', { ascending: false }),
    s.supabase.from('personal').select('id, nombre').in('id', ids),
  ]);
  const filas = [];
  const detalle = [];
  for (const p of personas ?? []) {
    const actual = (sueldos ?? []).find(x => x.personal_id === p.id);
    if (!actual) return { ok: false, error: `${p.nombre} no tiene sueldo cargado` };
    if (desde < actual.desde) return { ok: false, error: `${p.nombre} ya tiene un sueldo vigente desde un mes posterior` };
    const monto = Math.round(Number(actual.monto) * (1 + porcentaje / 100));
    filas.push({ personal_id: p.id, desde, monto, porcentaje, created_by: s.userId });
    detalle.push({ nombre: p.nombre, antes: Number(actual.monto), despues: monto });
  }
  const { error } = await s.supabase.from('personal_sueldos').insert(filas);
  if (error) return { ok: false, error: 'Error al aplicar el aumento' };
  await registrarAccion(s.supabase, 'personal_aumento', 'personal', { porcentaje, desde, detalle });
  refrescar();
  return { ok: true, data: undefined };
}

// Deshacer el último aumento cargado (el sueldo inicial no se borra)
export async function quitarUltimoAumento(personalId: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { data: ultimo } = await s.supabase.from('personal_sueldos').select('*').eq('personal_id', personalId)
    .order('desde', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!ultimo || ultimo.porcentaje == null) return { ok: false, error: 'No hay aumentos para quitar' };
  const { data: pagos } = await s.supabase.from('personal_pagos').select('id').eq('personal_id', personalId)
    .is('anulado_at', null).gte('periodo', ultimo.desde).limit(1);
  if (pagos && pagos.length > 0) return { ok: false, error: 'Ya se pagó un sueldo con este aumento: anulá primero ese pago' };
  const { error } = await s.supabase.from('personal_sueldos').delete().eq('id', ultimo.id);
  if (error) return { ok: false, error: 'Error al quitar el aumento' };
  await registrarAccion(s.supabase, 'personal_aumento_quitar', 'personal', { porcentaje: ultimo.porcentaje, desde: ultimo.desde });
  refrescar();
  return { ok: true, data: undefined };
}

export async function pagarPersonal(input: {
  personal_id: string; nombre: string; tipo: TipoPagoPersonal; periodo: string; base: number; extra: number;
  retiros: number; monto: number; cuenta_id: string; fecha: string; nota?: string;
}): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!fechaOk(input.periodo) || !fechaOk(input.fecha)) return { ok: false, error: 'Fecha inválida' };
  const { error } = await s.supabase.rpc('pagar_personal', {
    p_personal_id: input.personal_id, p_tipo: input.tipo, p_periodo: input.periodo, p_base: input.base, p_extra: input.extra,
    p_retiros: input.retiros, p_monto: input.monto, p_cuenta_id: input.cuenta_id || null, p_fecha: input.fecha, p_nota: input.nota?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  await registrarAccion(s.supabase, 'personal_pago', 'personal', {
    nombre: input.nombre, tipo: input.tipo, periodo: input.periodo, extra: input.extra, retiros: input.retiros, monto: input.monto,
  });
  refrescar();
  return { ok: true, data: undefined };
}

export async function anularPago(id: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.rpc('anular_pago_personal', { p_pago_id: id });
  if (error) return { ok: false, error: error.message };
  await registrarAccion(s.supabase, 'personal_pago_anular', 'personal', { pago_id: id });
  refrescar();
  return { ok: true, data: undefined };
}

export async function registrarRetiro(input: { personal_id: string; nombre: string; genetica_id: string; gramos: number; precio: number; fecha: string; nota?: string }): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!positivo(input.gramos) || !positivo(input.precio)) return { ok: false, error: 'Gramos y precio tienen que ser mayores a 0' };
  if (!fechaOk(input.fecha)) return { ok: false, error: 'Fecha inválida' };
  const { error } = await s.supabase.rpc('registrar_retiro_personal', {
    p_personal_id: input.personal_id, p_genetica_id: input.genetica_id, p_gramos: input.gramos,
    p_precio: input.precio, p_fecha: input.fecha, p_nota: input.nota?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  await registrarAccion(s.supabase, 'personal_retiro', 'personal', {
    nombre: input.nombre, genetica_id: input.genetica_id, gramos: input.gramos, total: input.gramos * input.precio,
  });
  refrescar();
  revalidatePath('/admin/inventario');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

export async function anularRetiro(id: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.rpc('anular_retiro_personal', { p_retiro_id: id });
  if (error) return { ok: false, error: error.message };
  await registrarAccion(s.supabase, 'personal_retiro_anular', 'personal', { retiro_id: id });
  refrescar();
  revalidatePath('/admin/inventario');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

// Objetivos: incluir o excluir una genética de la reposición
export async function cambiarReponer(geneticaId: string, reponer: boolean): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.from('geneticas').update({ reponer }).eq('id', geneticaId);
  if (error) return { ok: false, error: 'Error al guardar' };
  await registrarAccion(s.supabase, 'objetivo_genetica', 'geneticas', { genetica_id: geneticaId, reponer });
  revalidatePath('/admin/finanzas/objetivos');
  revalidatePath('/admin/dashboard');
  return { ok: true, data: undefined };
}

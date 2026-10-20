'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type { ActionResponse, Moneda, TesCuenta, TesDeuda, TesMovimiento, TesCategoria } from '@/lib/types/database';

// Todas las actions de tesorería son solo del superadmin (la RLS también lo exige)
async function superadmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  return data?.rol === 'admin' && data.superadmin ? { supabase, userId: user.id } : null;
}

const NO_AUTORIZADO = { ok: false as const, error: 'Solo el superadmin puede usar Tesorería' };

function montoValido(n: number | null | undefined): n is number {
  return typeof n === 'number' && isFinite(n) && n > 0;
}
function fechaValida(f: string | null | undefined): string {
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// Cuentas
// ------------------------------------------------------------

// Crear cuenta con saldo inicial (blanqueo) en cada moneda
export async function crearCuenta(input: { nombre: string; descripcion?: string; saldoARS?: number; saldoUSD?: number }): Promise<ActionResponse<TesCuenta>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, error: 'Poné un nombre a la cuenta' };

  const { data: cuenta, error } = await s.supabase
    .from('tes_cuentas')
    .insert({ nombre, descripcion: input.descripcion?.trim() || null })
    .select('*').single();
  if (error || !cuenta) return { ok: false, error: 'Error al crear la cuenta. ¿Se ejecutó tesoreria.sql?' };

  const iniciales = ([['ARS', input.saldoARS], ['USD', input.saldoUSD]] as const)
    .filter(([, m]) => montoValido(m))
    .map(([moneda, monto]) => ({
      tipo: 'inicial' as const, cuenta_id: cuenta.id, moneda, monto: monto as number,
      concepto: 'Saldo inicial', created_by: s.userId,
    }));
  if (iniciales.length > 0) {
    const { error: e2 } = await s.supabase.from('tes_movimientos').insert(iniciales);
    if (e2) return { ok: false, error: 'La cuenta se creó pero falló el saldo inicial' };
  }

  await registrarAccion(s.supabase, 'tes_crear_cuenta', 'tesoreria', { nombre, saldoARS: input.saldoARS ?? 0, saldoUSD: input.saldoUSD ?? 0 });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: cuenta };
}

export async function editarCuenta(id: string, input: { nombre: string; descripcion?: string; activa?: boolean }): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, error: 'Poné un nombre a la cuenta' };
  const { error } = await s.supabase.from('tes_cuentas')
    .update({ nombre, descripcion: input.descripcion?.trim() || null, ...(input.activa != null ? { activa: input.activa } : {}) })
    .eq('id', id);
  if (error) return { ok: false, error: 'Error al editar la cuenta' };
  await registrarAccion(s.supabase, 'tes_editar_cuenta', 'tesoreria', { nombre });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Movimientos
// ------------------------------------------------------------

export async function crearMovimiento(input: {
  tipo: 'ingreso' | 'egreso';
  fecha?: string;
  cuenta_id: string;
  moneda: Moneda;
  monto: number;
  categoria_id?: string | null;
  deuda_id?: string | null;    // egreso que paga una deuda
  concepto: string;
  nota?: string;
}): Promise<ActionResponse<TesMovimiento>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!montoValido(input.monto)) return { ok: false, error: 'El monto tiene que ser mayor a 0' };
  const concepto = input.concepto.trim();
  if (!concepto) return { ok: false, error: 'Indicá el concepto' };

  // Una deuda se paga (a_pagar → egreso) o se cobra (a_cobrar → ingreso) en su propia moneda
  if (input.deuda_id) {
    const { data: deuda } = await s.supabase.from('tes_deudas').select('moneda, anulada, sentido').eq('id', input.deuda_id).single();
    if (!deuda || deuda.anulada) return { ok: false, error: 'La deuda no existe o está anulada' };
    if (deuda.sentido === 'a_pagar' && input.tipo !== 'egreso') return { ok: false, error: 'Una deuda del club se paga con un egreso' };
    if (deuda.sentido === 'a_cobrar' && input.tipo !== 'ingreso') return { ok: false, error: 'Una deuda a favor se cobra con un ingreso' };
    if (deuda.moneda !== input.moneda) return { ok: false, error: `Esa deuda es en ${deuda.moneda}: el pago tiene que ser en la misma moneda` };
  }

  const { data, error } = await s.supabase.from('tes_movimientos').insert({
    tipo: input.tipo, fecha: fechaValida(input.fecha), cuenta_id: input.cuenta_id, moneda: input.moneda, monto: input.monto,
    categoria_id: input.categoria_id || null, deuda_id: input.deuda_id || null,
    concepto, nota: input.nota?.trim() || null, created_by: s.userId,
  }).select('*').single();
  if (error || !data) return { ok: false, error: 'Error al registrar el movimiento' };

  await registrarAccion(s.supabase, `tes_${input.tipo}`, 'tesoreria', { concepto, moneda: input.moneda, monto: input.monto });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data };
}

// Transferencia entre cuentas, misma moneda
export async function crearTransferencia(input: {
  fecha?: string; cuenta_id: string; cuenta_destino_id: string; moneda: Moneda; monto: number; concepto?: string; nota?: string;
}): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!montoValido(input.monto)) return { ok: false, error: 'El monto tiene que ser mayor a 0' };
  if (input.cuenta_id === input.cuenta_destino_id) return { ok: false, error: 'Elegí dos cuentas distintas' };

  const { error } = await s.supabase.from('tes_movimientos').insert({
    tipo: 'transferencia', fecha: fechaValida(input.fecha),
    cuenta_id: input.cuenta_id, moneda: input.moneda, monto: input.monto,
    cuenta_destino_id: input.cuenta_destino_id, moneda_destino: input.moneda, monto_destino: input.monto,
    concepto: input.concepto?.trim() || 'Transferencia entre cuentas', nota: input.nota?.trim() || null, created_by: s.userId,
  });
  if (error) return { ok: false, error: 'Error al registrar la transferencia' };

  await registrarAccion(s.supabase, 'tes_transferencia', 'tesoreria', { moneda: input.moneda, monto: input.monto });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// Cambio de moneda: sale `monto` en `moneda` de cuenta_id y entra `monto_destino`
// en la otra moneda en cuenta_destino_id (puede ser la misma cuenta)
export async function crearCambio(input: {
  fecha?: string; cuenta_id: string; moneda: Moneda; monto: number;
  cuenta_destino_id: string; monto_destino: number; nota?: string;
}): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  if (!montoValido(input.monto) || !montoValido(input.monto_destino)) return { ok: false, error: 'Los montos tienen que ser mayores a 0' };

  const monedaDestino: Moneda = input.moneda === 'ARS' ? 'USD' : 'ARS';
  // Tipo de cambio siempre expresado en pesos por dólar
  const tipoCambio = input.moneda === 'ARS' ? input.monto / input.monto_destino : input.monto_destino / input.monto;
  const concepto = input.moneda === 'ARS'
    ? `Compra de USD ${input.monto_destino.toLocaleString('es-AR')} a $${tipoCambio.toFixed(2)}`
    : `Venta de USD ${input.monto.toLocaleString('es-AR')} a $${tipoCambio.toFixed(2)}`;

  const { error } = await s.supabase.from('tes_movimientos').insert({
    tipo: 'cambio', fecha: fechaValida(input.fecha),
    cuenta_id: input.cuenta_id, moneda: input.moneda, monto: input.monto,
    cuenta_destino_id: input.cuenta_destino_id, moneda_destino: monedaDestino, monto_destino: input.monto_destino,
    tipo_cambio: Math.round(tipoCambio * 10000) / 10000,
    concepto, nota: input.nota?.trim() || null, created_by: s.userId,
  });
  if (error) return { ok: false, error: 'Error al registrar el cambio' };

  await registrarAccion(s.supabase, 'tes_cambio', 'tesoreria', { concepto });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// Eliminar un movimiento cargado por error (queda en auditoría)
export async function eliminarMovimiento(id: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { data: mov } = await s.supabase.from('tes_movimientos').select('tipo, concepto, moneda, monto, pedido_id').eq('id', id).single();
  if (!mov) return { ok: false, error: 'Movimiento no encontrado' };
  const { error } = await s.supabase.from('tes_movimientos').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar el movimiento' };
  await registrarAccion(s.supabase, 'tes_eliminar_movimiento', 'tesoreria', { tipo: mov.tipo, concepto: mov.concepto, moneda: mov.moneda, monto: mov.monto, pedido_id: mov.pedido_id });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Deudas
// ------------------------------------------------------------

export async function crearDeuda(input: { acreedor: string; sentido: 'a_pagar' | 'a_cobrar'; moneda: Moneda; monto: number; vence_at?: string | null; nota?: string }): Promise<ActionResponse<TesDeuda>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const acreedor = input.acreedor.trim();
  if (!acreedor) return { ok: false, error: 'Indicá a quién se le debe' };
  if (!montoValido(input.monto)) return { ok: false, error: 'El monto tiene que ser mayor a 0' };

  const { data, error } = await s.supabase.from('tes_deudas').insert({
    acreedor, sentido: input.sentido, moneda: input.moneda, monto: input.monto,
    vence_at: input.vence_at || null, nota: input.nota?.trim() || null, created_by: s.userId,
  }).select('*').single();
  if (error || !data) return { ok: false, error: 'Error al registrar la deuda' };

  await registrarAccion(s.supabase, 'tes_crear_deuda', 'tesoreria', { acreedor, sentido: input.sentido, moneda: input.moneda, monto: input.monto });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data };
}

export async function anularDeuda(id: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.from('tes_deudas').update({ anulada: true }).eq('id', id);
  if (error) return { ok: false, error: 'Error al anular la deuda' };
  await registrarAccion(s.supabase, 'tes_anular_deuda', 'tesoreria', { deuda_id: id });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Categorías y configuración
// ------------------------------------------------------------

export async function crearCategoria(nombre: string, tipo: 'ingreso' | 'egreso'): Promise<ActionResponse<TesCategoria>> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const n = nombre.trim();
  if (!n) return { ok: false, error: 'Poné un nombre' };
  const { data, error } = await s.supabase.from('tes_categorias').insert({ nombre: n, tipo }).select('*').single();
  if (error || !data) return { ok: false, error: 'Error al crear la categoría (¿ya existe?)' };
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data };
}

export async function toggleCategoria(id: string, activa: boolean): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.from('tes_categorias').update({ activa }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar la categoría' };
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

// Cuenta donde entran solos los cobros de pedidos ('' = no registrar)
export async function guardarCuentaCobros(cuentaId: string): Promise<ActionResponse> {
  const s = await superadmin();
  if (!s) return NO_AUTORIZADO;
  const { error } = await s.supabase.from('configuracion_app').upsert({ clave: 'tes_cuenta_cobros', valor: cuentaId }, { onConflict: 'clave' });
  if (error) return { ok: false, error: 'Error al guardar la configuración' };
  await registrarAccion(s.supabase, 'tes_cuenta_cobros', 'tesoreria', { cuenta_id: cuentaId || null });
  revalidatePath('/admin/finanzas/tesoreria');
  return { ok: true, data: undefined };
}

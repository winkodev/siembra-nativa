'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import { formatFranja, labelDias } from '@/lib/utils';
import type { ActionResponse, Ubicacion, FranjaHoraria, FechaBloqueada } from '@/lib/types/database';
import { CLAVES_PAGO, type DatosPago } from '@/lib/supabase/config';
import { enviarEmailPrueba } from '@/lib/email';
import { CLAVES_SECRETO_EMAIL, type ProveedorEmail, type ClaveSecretoEmail } from '@/lib/avisos';

export async function guardarConfigApp(clave: string, valor: string): Promise<ActionResponse> {
  // Las claves de pago tienen su propia action con chequeo de superadmin
  if (clave.startsWith('pago_')) return { ok: false, error: 'Usá la pestaña Pagos para estos datos' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autorizado' };
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (p?.rol !== 'admin') return { ok: false, error: 'No autorizado' };

  const { error } = await supabase
    .from('configuracion_app')
    .upsert({ clave, valor }, { onConflict: 'clave' });

  if (error) return { ok: false, error: 'Error al guardar la configuración' };

  await registrarAccion(supabase, 'editar_config', 'configuracion', { clave, valor });
  revalidatePath('/admin/configuracion');
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

async function verificarAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return p?.rol === 'admin' ? supabase : null;
}

export async function crearUbicacion(nombre: string, descripcion: string | null): Promise<ActionResponse<Ubicacion>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { data, error } = await supabase
    .from('ubicaciones')
    .insert({ nombre, descripcion })
    .select()
    .single();

  if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe una ubicación con ese nombre' : 'Error al crear la ubicación' };

  await registrarAccion(supabase, 'crear_ubicacion', 'ubicaciones', { nombre });
  revalidatePath('/admin/configuracion');
  return { ok: true, data };
}

export async function actualizarUbicacion(id: string, nombre: string, descripcion: string | null): Promise<ActionResponse<Ubicacion>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { data, error } = await supabase
    .from('ubicaciones')
    .update({ nombre, descripcion })
    .eq('id', id)
    .select()
    .single();

  if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe una ubicación con ese nombre' : 'Error al actualizar' };

  await registrarAccion(supabase, 'editar_ubicacion', 'ubicaciones', { nombre });
  revalidatePath('/admin/configuracion');
  return { ok: true, data };
}

export async function eliminarUbicacion(id: string): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('ubicaciones').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar la ubicación' };

  await registrarAccion(supabase, 'eliminar_ubicacion', 'ubicaciones', { id });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: undefined };
}

export async function toggleUbicacionActiva(id: string, activa: boolean): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('ubicaciones').update({ activa }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar el estado' };
  revalidatePath('/admin/configuracion');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Franjas horarias de entrega
// ------------------------------------------------------------

function validarFranja(dias: number[], desde: string, hasta: string): string | null {
  if (dias.length === 0 || dias.some(d => d < 0 || d > 6)) return 'Elegí al menos un día de la semana';
  if (!desde || !hasta) return 'Indicá el horario desde y hasta';
  if (hasta <= desde) return 'El horario "hasta" debe ser mayor que "desde"';
  return null;
}

export async function crearFranja(dias: number[], desde: string, hasta: string): Promise<ActionResponse<FranjaHoraria>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const invalida = validarFranja(dias, desde, hasta);
  if (invalida) return { ok: false, error: invalida };

  // `dia` queda como etiqueta derivada de los días (compatibilidad con pedidos viejos)
  const { data, error } = await supabase
    .from('franjas_horarias')
    .insert({ dia: labelDias(dias), dias_semana: dias, hora_desde: desde, hora_hasta: hasta })
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al crear la franja horaria' };

  await registrarAccion(supabase, 'crear_franja', 'franjas', { franja: formatFranja(data) });
  revalidatePath('/admin/configuracion');
  return { ok: true, data };
}

export async function actualizarFranja(id: string, dias: number[], desde: string, hasta: string): Promise<ActionResponse<FranjaHoraria>> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const invalida = validarFranja(dias, desde, hasta);
  if (invalida) return { ok: false, error: invalida };

  const { data, error } = await supabase
    .from('franjas_horarias')
    .update({ dia: labelDias(dias), dias_semana: dias, hora_desde: desde, hora_hasta: hasta })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return { ok: false, error: 'Error al actualizar la franja horaria' };

  await registrarAccion(supabase, 'editar_franja', 'franjas', { franja: formatFranja(data) });
  revalidatePath('/admin/configuracion');
  return { ok: true, data };
}

export async function toggleFranjaActiva(id: string, activa: boolean): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('franjas_horarias').update({ activa }).eq('id', id);
  if (error) return { ok: false, error: 'Error al actualizar el estado' };

  await registrarAccion(supabase, activa ? 'activar_franja' : 'desactivar_franja', 'franjas', { id });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: undefined };
}

export async function eliminarFranja(id: string): Promise<ActionResponse> {
  const supabase = await verificarAdmin();
  if (!supabase) return { ok: false, error: 'No autorizado' };

  const { error } = await supabase.from('franjas_horarias').delete().eq('id', id);
  if (error) return { ok: false, error: 'Error al eliminar la franja horaria' };

  await registrarAccion(supabase, 'eliminar_franja', 'franjas', { id });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Datos de pago (alias / CBU): solo el superadmin los puede cambiar.
// Se guardan en configuracion_app, así el cambio aplica al instante
// en la pantalla de nuevo pedido del socio.
// ------------------------------------------------------------

export async function guardarDatosPago(datos: DatosPago): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autorizado' };
  const { data: p } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  if (p?.rol !== 'admin' || !p.superadmin) return { ok: false, error: 'Solo el superadmin puede cambiar los datos de pago' };

  // CBU: 22 dígitos exactos si se carga (el alias es texto libre)
  const cbu = datos.pago_cbu.replace(/\s/g, '');
  if (cbu && !/^\d{22}$/.test(cbu)) return { ok: false, error: 'El CBU debe tener 22 dígitos' };

  const filas = CLAVES_PAGO.map(clave => ({
    clave,
    valor: clave === 'pago_cbu' ? cbu : datos[clave].trim(),
  }));
  const { error } = await supabase.from('configuracion_app').upsert(filas, { onConflict: 'clave' });
  if (error) return { ok: false, error: 'Error al guardar los datos de pago' };

  await registrarAccion(supabase, 'editar_datos_pago', 'configuracion', { alias: datos.pago_alias.trim(), cbu });
  revalidatePath('/admin/configuracion');
  revalidatePath('/socio/pedidos/nuevo');
  return { ok: true, data: undefined };
}

// Configuración → Avisos: manda un email de prueba con el método elegido
export async function probarEmailAviso(to: string, proveedor: ProveedorEmail): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autorizado' };
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (p?.rol !== 'admin') return { ok: false, error: 'No autorizado' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) return { ok: false, error: 'Dirección inválida' };

  const ok = await enviarEmailPrueba(to.trim(), proveedor);
  if (!ok) return { ok: false, error: 'No se pudo enviar. Revisá que el método elegido tenga sus variables cargadas en el servidor.' };
  return { ok: true, data: undefined };
}

// Superadmin: guardar credenciales de envío en secretos_app (solo si no hay
// variable de entorno para esa clave). Un valor vacío no toca lo guardado.
export async function guardarCredencialesEmail(valores: Partial<Record<ClaveSecretoEmail, string>>): Promise<ActionResponse> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autorizado' };
  const { data: p } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  if (p?.rol !== 'admin' || !p.superadmin) return { ok: false, error: 'Solo el superadmin puede cargar credenciales' };

  const filas = CLAVES_SECRETO_EMAIL
    .filter(k => (valores[k] ?? '').trim() !== '')
    .map(k => ({ clave: k, valor: k === 'GMAIL_APP_PASSWORD' ? valores[k]!.replace(/\s/g, '') : valores[k]!.trim(), updated_at: new Date().toISOString() }));
  if (filas.length === 0) return { ok: true, data: undefined };

  const { error } = await createServiceClient().from('secretos_app').upsert(filas, { onConflict: 'clave' });
  if (error) return { ok: false, error: 'Error al guardar. ¿Se ejecutó secretos-app.sql en Supabase?' };

  await registrarAccion(supabase, 'editar_credenciales_email', 'configuracion', { claves: filas.map(f => f.clave).join(', ') });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Días bloqueados para entregas (solo superadmin)
// ------------------------------------------------------------

async function superadminBloqueos() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol, superadmin').eq('id', user.id).single();
  return p?.rol === 'admin' && p.superadmin ? { supabase, userId: user.id } : null;
}

const fechaOk = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);

// Bloquear o desbloquear un día entero (franjaId null) o una franja puntual de un día
export async function toggleBloqueoFecha(fecha: string, franjaId: string | null, bloquear: boolean, motivo?: string): Promise<ActionResponse<FechaBloqueada | null>> {
  const s = await superadminBloqueos();
  if (!s) return { ok: false, error: 'Solo el superadmin puede bloquear días' };
  if (!fechaOk(fecha)) return { ok: false, error: 'Fecha inválida' };

  if (bloquear) {
    const { data, error } = await s.supabase.from('fechas_bloqueadas')
      .insert({ fecha, franja_id: franjaId, motivo: motivo?.trim() || null, created_by: s.userId })
      .select('*').single();
    if (error || !data) return { ok: false, error: 'No se pudo bloquear (¿ya estaba bloqueado? ¿se ejecutó fechas-bloqueadas.sql?)' };
    await registrarAccion(s.supabase, 'bloquear_fecha', 'franjas', { fecha, franja_id: franjaId, motivo: motivo?.trim() || null });
    revalidatePath('/admin/configuracion');
    return { ok: true, data };
  }

  const q = s.supabase.from('fechas_bloqueadas').delete().eq('fecha', fecha);
  const { error } = franjaId ? await q.eq('franja_id', franjaId) : await q.is('franja_id', null);
  if (error) return { ok: false, error: 'No se pudo desbloquear' };
  await registrarAccion(s.supabase, 'desbloquear_fecha', 'franjas', { fecha, franja_id: franjaId });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: null };
}

// Bloquear un rango de días enteros (vacaciones). Los ya bloqueados se saltean.
export async function bloquearRangoFechas(desde: string, hasta: string, motivo?: string): Promise<ActionResponse<FechaBloqueada[]>> {
  const s = await superadminBloqueos();
  if (!s) return { ok: false, error: 'Solo el superadmin puede bloquear días' };
  if (!fechaOk(desde) || !fechaOk(hasta)) return { ok: false, error: 'Fechas inválidas' };
  if (hasta < desde) return { ok: false, error: 'La fecha "hasta" tiene que ser igual o posterior a "desde"' };

  const dias: string[] = [];
  const [y, m, d] = desde.split('-').map(Number);
  for (let i = 0; i < 120; i++) {
    const x = new Date(y, m - 1, d + i);
    const f = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    if (f > hasta) break;
    dias.push(f);
  }
  if (dias.length === 0) return { ok: false, error: 'Rango vacío' };

  const { data: existentes } = await s.supabase.from('fechas_bloqueadas').select('fecha').in('fecha', dias).is('franja_id', null);
  const ya = new Set((existentes ?? []).map(e => e.fecha));
  const nuevos = dias.filter(f => !ya.has(f)).map(fecha => ({ fecha, franja_id: null, motivo: motivo?.trim() || null, created_by: s.userId }));
  if (nuevos.length === 0) return { ok: true, data: [] };

  const { data, error } = await s.supabase.from('fechas_bloqueadas').insert(nuevos).select('*');
  if (error) return { ok: false, error: 'No se pudo bloquear el rango. ¿Se ejecutó fechas-bloqueadas.sql?' };

  await registrarAccion(s.supabase, 'bloquear_rango', 'franjas', { desde, hasta, motivo: motivo?.trim() || null, dias: nuevos.length });
  revalidatePath('/admin/configuracion');
  return { ok: true, data: (data ?? []) as FechaBloqueada[] };
}

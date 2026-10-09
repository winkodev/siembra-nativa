'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import { formatFranja, labelDias } from '@/lib/utils';
import type { ActionResponse, Ubicacion, FranjaHoraria } from '@/lib/types/database';
import { CLAVES_PAGO, type DatosPago } from '@/lib/supabase/config';
import { enviarEmailPrueba } from '@/lib/email';
import type { ProveedorEmail } from '@/lib/avisos';

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

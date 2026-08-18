'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getAppConfig } from '@/lib/supabase/config';
import { revalidatePath } from 'next/cache';
import { registrarAccion } from '@/lib/audit';
import type {
  ActionResponse, CarritoItem, EstadoPedido,
} from '@/lib/types/database';

export async function crearPedido(
  items: CarritoItem[],
  notas: string,
  franjaId?: string | null
): Promise<ActionResponse<{ pedido_id: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  if (items.length === 0) return { ok: false, error: 'El pedido está vacío' };

  // Toda la validación (habilitación, límite, stock neto de reservas,
  // franja) y la creación ocurren en UNA función SQL con lock:
  // dos confirmaciones simultáneas ya no pueden reservar el mismo stock
  const payload = items.map(i =>
    i.tipo_item === 'genetica'
      ? { tipo: 'genetica', id: i.id, cantidad: i.cantidad_gramos }
      : { tipo: 'producto', id: i.id, cantidad: i.cantidad_unidades }
  );

  const { data, error } = await supabase.rpc('crear_pedido', {
    p_items: payload,
    p_notas: notas || null,
    p_franja_id: franjaId ?? null,
  });

  if (error || !data) {
    // Los RAISE EXCEPTION de la función llegan con el mensaje ya legible
    return { ok: false, error: error?.message ?? 'Error al crear el pedido' };
  }

  revalidatePath('/socio/pedidos');
  // El pedido pendiente reserva stock: la tienda debe reflejarlo
  revalidatePath('/socio/tienda');
  return { ok: true, data: { pedido_id: data.pedido_id } };
}

// Desde qué estados se puede pasar a cada estado destino
const transicionesValidas: Record<'aprobado' | 'entregado' | 'cancelado', EstadoPedido[]> = {
  aprobado:  ['pendiente'],
  entregado: ['aprobado'],
  cancelado: ['pendiente', 'aprobado'],
};

export async function cambiarEstadoPedido(
  pedidoId: string,
  nuevoEstado: 'aprobado' | 'entregado' | 'cancelado'
): Promise<ActionResponse> {
  const supabase = createClient();

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('estado, comprobante_path, socio_id, numero, entrega_franja')
    .eq('id', pedidoId)
    .single();

  if (!pedido) return { ok: false, error: 'Pedido no encontrado' };

  // Guard de transiciones: evita doble aprobación (descuento doble de stock)
  // y saltos inválidos como pendiente → entregado
  if (!transicionesValidas[nuevoEstado].includes(pedido.estado)) {
    return { ok: false, error: `El pedido ya no está en un estado que permita marcarlo como ${nuevoEstado}.` };
  }

  // Si el comprobante es obligatorio, no se puede aprobar sin él
  if (nuevoEstado === 'aprobado') {
    const config = await getAppConfig();
    if (config.comprobante_obligatorio && !pedido.comprobante_path) {
      return { ok: false, error: 'No se puede aprobar: el socio todavía no cargó el comprobante de pago.' };
    }
  }

  // Al entregar se registra el momento real de la dispensa (para estadísticas)
  const cambios: { estado: EstadoPedido; fecha_entregado?: string } = { estado: nuevoEstado };
  if (nuevoEstado === 'entregado') cambios.fecha_entregado = new Date().toISOString();

  // Lock optimista: solo actualiza si el estado no cambió desde la lectura
  // (dos pestañas aprobando a la vez → solo una gana)
  const { data: actualizado } = await supabase
    .from('pedidos')
    .update(cambios)
    .eq('id', pedidoId)
    .eq('estado', pedido.estado)
    .select('id')
    .single();

  if (!actualizado) {
    return { ok: false, error: 'El pedido fue modificado desde otra sesión. Recargá la página.' };
  }

  if (nuevoEstado === 'aprobado') {
    // Descuento real de stock (FIFO flores + unidades productos)
    const { error: stockError } = await supabase.rpc('descontar_stock_pedido', {
      p_pedido_id: pedidoId,
    });
    if (stockError) {
      // Revertir la aprobación si no hay stock físico suficiente
      await supabase.from('pedidos').update({ estado: 'pendiente' }).eq('id', pedidoId);
      return { ok: false, error: 'Error al descontar stock: ' + stockError.message };
    }
  }

  if (nuevoEstado === 'cancelado' && pedido.estado === 'aprobado') {
    // El pedido ya había descontado stock: devolverlo
    const { error: restError } = await supabase.rpc('restaurar_stock_pedido', {
      p_pedido_id: pedidoId,
    });
    if (restError) {
      return { ok: false, error: 'Pedido cancelado, pero falló la devolución de stock: ' + restError.message };
    }
  }

  // Notificación in-app para el socio (confirmado / entregado)
  if (nuevoEstado === 'aprobado' || nuevoEstado === 'entregado') {
    const numeroTxt = pedido.numero != null ? `#${String(pedido.numero).padStart(4, '0')}` : '';
    await supabase.from('notificaciones').insert(
      nuevoEstado === 'aprobado'
        ? {
            socio_id: pedido.socio_id,
            titulo: `Tu pedido ${numeroTxt} fue confirmado`,
            mensaje: pedido.entrega_franja
              ? `El club confirmó tu pedido. Entrega: ${pedido.entrega_franja}.`
              : 'El club confirmó tu pedido y lo está preparando.',
          }
        : {
            socio_id: pedido.socio_id,
            titulo: `Tu pedido ${numeroTxt} fue entregado`,
            mensaje: '¡Gracias! Cualquier consulta, escribile al club.',
          }
    );
    revalidatePath('/socio/dashboard');
  }

  await registrarAccion(supabase, `pedido_${nuevoEstado}`, 'pedidos', { pedido_id: pedidoId }, pedido.socio_id);
  revalidatePath('/admin/pedidos');
  revalidatePath('/socio/pedidos');
  // Aprobar/cancelar cambia la disponibilidad visible en tienda
  revalidatePath('/socio/tienda');
  return { ok: true, data: undefined };
}

// ------------------------------------------------------------
// Comprobante de pago
// ------------------------------------------------------------

export async function subirComprobante(
  fd: FormData
): Promise<ActionResponse<{ comprobante_path: string; comprobante_subido_at: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const pedidoId = fd.get('pedido_id') as string;
  const archivo  = fd.get('comprobante') as File | null;
  if (!archivo || archivo.size === 0) return { ok: false, error: 'Seleccioná un archivo' };

  // El pedido debe ser propio (RLS solo muestra los del socio) y estar activo
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, socio_id, estado')
    .eq('id', pedidoId)
    .single();

  if (!pedido || pedido.socio_id !== user.id) {
    return { ok: false, error: 'Pedido no encontrado' };
  }
  if (pedido.estado === 'entregado' || pedido.estado === 'cancelado') {
    return { ok: false, error: 'Este pedido ya no admite comprobante' };
  }

  // Path: {user_id}/{pedido_id}.{ext} — upsert permite reemplazarlo
  const ext  = archivo.name.split('.').pop();
  const path = `${user.id}/${pedidoId}.${ext}`;
  const { error: upError } = await supabase.storage
    .from('comprobantes-pago')
    .upload(path, archivo, { upsert: true });

  if (upError) return { ok: false, error: 'Error al subir el comprobante' };

  // El socio no tiene UPDATE sobre pedidos (RLS): con la propiedad ya
  // verificada, el registro del path se hace con el service client
  const subidoAt = new Date().toISOString();
  const admin = createServiceClient();
  const { error: updError } = await admin
    .from('pedidos')
    .update({ comprobante_path: path, comprobante_subido_at: subidoAt })
    .eq('id', pedidoId);

  if (updError) return { ok: false, error: 'Error al registrar el comprobante' };

  revalidatePath('/socio/pedidos');
  revalidatePath('/admin/pedidos');
  return { ok: true, data: { comprobante_path: path, comprobante_subido_at: subidoAt } };
}

export async function verComprobante(pedidoId: string): Promise<ActionResponse<{ url: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (p?.rol !== 'admin') return { ok: false, error: 'No autorizado' };

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('comprobante_path, socio_id')
    .eq('id', pedidoId)
    .single();

  if (!pedido?.comprobante_path) return { ok: false, error: 'El pedido no tiene comprobante cargado' };

  // Registrar acceso a documento financiero (mismo criterio que certificados)
  await supabase.from('audit_log').insert({
    admin_id: user.id,
    accion: 'ver_comprobante_pago',
    recurso: 'comprobante_pago',
    socio_afectado_id: pedido.socio_id,
    metadata: { pedido_id: pedidoId },
  });

  // URL firmada válida por 5 minutos
  const { data: signed } = await supabase.storage
    .from('comprobantes-pago')
    .createSignedUrl(pedido.comprobante_path, 300);

  if (!signed?.signedUrl) return { ok: false, error: 'No se pudo generar el acceso al comprobante' };
  return { ok: true, data: { url: signed.signedUrl } };
}

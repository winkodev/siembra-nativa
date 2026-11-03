import { createServiceClient } from '@/lib/supabase/server';

// ------------------------------------------------------------
// Cobros de pedidos → Tesorería.
// Al pasar un pedido a Listo entra un ingreso en la cuenta configurada
// (Configuración → tes_cuenta_cobros). Al cancelarlo o revertirlo a
// pendiente, ese ingreso se elimina. Se usa el service role porque lo
// ejecuta cualquier admin (la tesorería es solo del superadmin).
// Best-effort: nunca interrumpe el cambio de estado del pedido.
// ------------------------------------------------------------

// Registra el cobro de un pedido si hay cuenta configurada y todavía no está.
// Devuelve true si insertó, false si no correspondía o ya existía.
export async function registrarCobroPedido(pedidoId: string, adminId: string, fecha?: string): Promise<boolean> {
  try {
    const service = createServiceClient();
    const { data: cfg } = await service.from('configuracion_app').select('valor').eq('clave', 'tes_cuenta_cobros').maybeSingle();
    const cuentaId = cfg?.valor;
    if (!cuentaId) return false;

    // Ya registrado: no duplicar (el índice único parcial por pedido no sirve para upsert)
    const { data: existente } = await service.from('tes_movimientos').select('id').eq('pedido_id', pedidoId).maybeSingle();
    if (existente) return false;

    const { data: pedido } = await service
      .from('pedidos')
      .select('numero, monto_total, manual, cliente_nombre, socio:profiles!socio_id(nombre)')
      .eq('id', pedidoId)
      .single();
    if (!pedido || !pedido.monto_total || pedido.monto_total <= 0) return false;

    const { data: cat } = await service.from('tes_categorias').select('id').eq('nombre', 'Cobro de pedidos').eq('tipo', 'ingreso').maybeSingle();
    const socio = (pedido as unknown as { socio: { nombre: string } | null }).socio;
    const quien = pedido.manual ? (pedido.cliente_nombre ?? 'pedido manual') : (socio?.nombre ?? 'socio');

    const { error } = await service.from('tes_movimientos').insert({
      tipo: 'ingreso',
      ...(fecha ? { fecha } : {}),
      cuenta_id: cuentaId,
      moneda: 'ARS',
      monto: pedido.monto_total,
      categoria_id: cat?.id ?? null,
      pedido_id: pedidoId,
      concepto: `Pedido #${String(pedido.numero).padStart(4, '0')} · ${quien}`,
      created_by: adminId || null,
    });
    return !error;
  } catch {
    // La tesorería nunca rompe el flujo de pedidos
    return false;
  }
}

export async function revertirCobroPedido(pedidoId: string): Promise<void> {
  try {
    await createServiceClient().from('tes_movimientos').delete().eq('pedido_id', pedidoId);
  } catch {
    // idem
  }
}

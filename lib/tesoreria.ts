import { createServiceClient } from '@/lib/supabase/server';

// ------------------------------------------------------------
// Cobros de pedidos → Tesorería.
// Al aprobar un pedido entra un ingreso en la cuenta configurada
// (Configuración → tes_cuenta_cobros). Al cancelarlo o revertirlo a
// pendiente, ese ingreso se elimina. Se usa el service role porque lo
// ejecuta cualquier admin (la tesorería es solo del superadmin).
// Best-effort: nunca interrumpe el cambio de estado del pedido.
// ------------------------------------------------------------

export async function registrarCobroPedido(pedidoId: string, adminId: string): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: cfg } = await service.from('configuracion_app').select('valor').eq('clave', 'tes_cuenta_cobros').single();
    const cuentaId = cfg?.valor;
    if (!cuentaId) return;

    const { data: pedido } = await service
      .from('pedidos')
      .select('numero, monto_total, manual, cliente_nombre, socio:profiles!socio_id(nombre)')
      .eq('id', pedidoId)
      .single();
    if (!pedido || !pedido.monto_total || pedido.monto_total <= 0) return;

    const { data: cat } = await service.from('tes_categorias').select('id').eq('nombre', 'Cobro de pedidos').eq('tipo', 'ingreso').maybeSingle();
    const socio = (pedido as unknown as { socio: { nombre: string } | null }).socio;
    const quien = pedido.manual ? (pedido.cliente_nombre ?? 'pedido manual') : (socio?.nombre ?? 'socio');

    // Índice único por pedido: si ya está registrado, no duplica
    await service.from('tes_movimientos').upsert({
      tipo: 'ingreso',
      cuenta_id: cuentaId,
      moneda: 'ARS',
      monto: pedido.monto_total,
      categoria_id: cat?.id ?? null,
      pedido_id: pedidoId,
      concepto: `Pedido #${String(pedido.numero).padStart(4, '0')} · ${quien}`,
      created_by: adminId,
    }, { onConflict: 'pedido_id', ignoreDuplicates: true });
  } catch {
    // La tesorería nunca rompe el flujo de pedidos
  }
}

export async function revertirCobroPedido(pedidoId: string): Promise<void> {
  try {
    await createServiceClient().from('tes_movimientos').delete().eq('pedido_id', pedidoId);
  } catch {
    // idem
  }
}

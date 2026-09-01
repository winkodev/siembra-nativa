import { createClient } from '@/lib/supabase/server';
import { AdminDashboardClient } from './AdminDashboardClient';
import type { MetricasAdmin } from '@/lib/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard Admin' };

export default async function AdminDashboardPage() {
  const supabase = createClient();

  // Métricas en paralelo
  const [
    { count: sociosActivos },
    { count: pedidosPendientes },
    { data: stockData },
    { count: reprocannVencer },
    { count: reprocannVencidos },
    { count: consultasPendientes },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('rol', 'socio').eq('estado', 'activo'),

    supabase.from('pedidos').select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),

    supabase.from('stock').select('cantidad_gramos'),

    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('reprocann_estado', 'aprobado')
      .gte('reprocann_vencimiento', new Date().toISOString().split('T')[0])
      .lte('reprocann_vencimiento', new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]),

    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('reprocann_estado', 'vencido'),

    supabase.from('consultas').select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ]);

  const stockTotal = stockData?.reduce((acc, s) => acc + (s.cantidad_gramos ?? 0), 0) ?? 0;

  const metricas: MetricasAdmin = {
    socios_activos:       sociosActivos ?? 0,
    pedidos_pendientes:   pedidosPendientes ?? 0,
    stock_total_gramos:   stockTotal,
    reprocann_por_vencer: reprocannVencer ?? 0,
    reprocann_vencidos:   reprocannVencidos ?? 0,
  };

  const hoy   = new Date().toISOString().split('T')[0];
  const en90  = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  // Listas de trabajo: documentación pendiente, REPROCANN por vencer,
  // pedidos por aprobar y pedidos aprobados por entregar
  const selectPedido = `
    id, numero, created_at, comprobante_path,
    profiles!socio_id ( nombre ),
    pedido_items ( cantidad_gramos, cantidad_unidades )
  `;

  const [
    { data: pendientes },
    { data: porVencer },
    { data: porAprobar },
    { data: porEntregar },
    { data: porArmar },
    { count: porArmarCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre, reprocann_estado, reprocann_numero, created_at')
      .eq('reprocann_estado', 'pendiente')
      .eq('rol', 'socio')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('id, nombre, reprocann_numero, reprocann_vencimiento')
      .eq('rol', 'socio')
      .eq('reprocann_estado', 'aprobado')
      .gte('reprocann_vencimiento', hoy)
      .lte('reprocann_vencimiento', en90)
      .order('reprocann_vencimiento', { ascending: true }),
    supabase
      .from('pedidos')
      .select(selectPedido)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('pedidos')
      .select(selectPedido)
      .eq('estado', 'aprobado')
      .order('created_at', { ascending: true })
      .limit(5),
    // Por armar: pago ya verificado por el club pero todavía sin armar
    supabase
      .from('pedidos')
      .select(selectPedido)
      .eq('estado', 'pendiente')
      .not('comprobante_ok_at', 'is', null)
      .is('armado_at', null)
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .not('comprobante_ok_at', 'is', null)
      .is('armado_at', null),
  ]);

  return (
    <AdminDashboardClient
      metricas={metricas}
      pendientes={pendientes ?? []}
      porVencer={porVencer ?? []}
      porAprobar={(porAprobar as any[]) ?? []}
      porEntregar={(porEntregar as any[]) ?? []}
      porArmar={(porArmar as any[]) ?? []}
      porArmarCount={porArmarCount ?? 0}
      consultasPendientes={consultasPendientes ?? 0}
    />
  );
}

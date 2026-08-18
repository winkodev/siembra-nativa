import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TiendaClient } from './TiendaClient';
import { getAppConfig } from '@/lib/supabase/config';
import type { Producto, StockPublico } from '@/lib/types/database';

export const metadata = { title: 'Catálogo' };

export default async function TiendaPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();
  // Flores + productos activos, en paralelo. Ambas vistas ya restan
  // lo reservado por pedidos pendientes (reserva virtual).
  const [{ data: geneticas }, { data: productos }, config] = await Promise.all([
    supabase.from('stock_publico').select('*').order('nombre'),
    supabase.from('productos_publico').select('*').eq('activo', true).order('created_at', { ascending: false }),
    getAppConfig(),
  ]);

  // Solo mostrar genéticas que superan el stock mínimo visible (config admin)
  const flores = ((geneticas ?? []) as StockPublico[]).filter(
    g => g.stock_total_gramos >= config.stock_minimo_visible
  );

  return (
    <TiendaClient
      flores={flores}
      productos={(productos as Producto[]) ?? []}
      puedeHacerPedidos={profile.compra_habilitada}
    />
  );
}

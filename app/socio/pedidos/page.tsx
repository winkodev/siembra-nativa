import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { HistorialPedidosClient } from './HistorialPedidosClient';
import type { PedidoConItems } from '@/lib/types/database';

export const metadata = { title: 'Mis pedidos' };

export default async function PedidosPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      *,
      pedido_items (
        *,
        geneticas ( nombre, tipo ),
        productos ( nombre, categoria )
      )
    `)
    .eq('socio_id', profile.id)
    .order('created_at', { ascending: false });

  return <HistorialPedidosClient pedidos={(pedidos as PedidoConItems[]) ?? []} />;
}

import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminPedidosClient } from './AdminPedidosClient';
import type { PedidoConItems } from '@/lib/types/database';

export const metadata = { title: 'Gestión de pedidos' };

export default async function AdminPedidosPage() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') redirect('/socio/dashboard');

  const supabase = createClient();

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(`
      *,
      pedido_items (
        *,
        geneticas ( nombre, tipo ),
        productos ( nombre, categoria )
      ),
      profiles!socio_id ( nombre, dni )
    `)
    .order('created_at', { ascending: false });

  return <AdminPedidosClient pedidos={(pedidos as any[]) ?? []} />;
}

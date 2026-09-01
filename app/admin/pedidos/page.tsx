import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminPedidosClient } from './AdminPedidosClient';
import type { PedidoConItems } from '@/lib/types/database';

export const metadata = { title: 'Gestión de pedidos' };

export default async function AdminPedidosPage({ searchParams }: {
  searchParams?: { filtro?: string };
}) {
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
      profiles!socio_id ( nombre, dni, telefono, direccion, piso_depto, localidad, provincia, codigo_postal, latitud, longitud ),
      armado:profiles!armado_por ( nombre ),
      comprobante_ok:profiles!comprobante_ok_por ( nombre )
    `)
    .order('created_at', { ascending: false });

  return <AdminPedidosClient pedidos={(pedidos as any[]) ?? []} filtroInicial={searchParams?.filtro} />;
}

import { createClient, getProfile } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { DetalleProductoClient } from './DetalleProductoClient';
import type { Producto } from '@/lib/types/database';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase.from('productos').select('nombre').eq('id', params.id).single();
  return { title: data?.nombre ?? 'Producto' };
}

export default async function DetalleProductoPage({ params }: Props) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const supabase = createClient();
  // Vista con stock neto de reservas (pedidos pendientes)
  const { data: producto } = await supabase
    .from('productos_publico')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!producto || !producto.activo) notFound();

  return (
    <DetalleProductoClient
      producto={producto as Producto}
      puedeHacerPedidos={profile.compra_habilitada}
    />
  );
}
